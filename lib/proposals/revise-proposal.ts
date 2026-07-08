import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { validateProposalDraft } from "@/lib/domain/guardrails"
import type { PricingCatalogForModel } from "@/lib/domain/types"
import { env } from "@/lib/env"
import { proposalAi } from "@/lib/proposal"
import { proposalDraftSchema } from "@/lib/proposals/schema"
import {
  buildProposalReviewBlocks,
  buildProposalReviewText,
} from "@/lib/proposals/slack-blocks"
import { review } from "@/lib/review"

const AI_MODEL_LABEL = "selected-proposal-ai"
const PROMPT_VERSION = "proposal-revision-v1"

function toJsonValue(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
}

function proposalUrl(proposalId: string): string {
  return `${env.APP_BASE_URL}/proposals/${proposalId}`
}

function toPricingCatalogForModel(
  pricingItems: PricingCatalogForModel[]
): PricingCatalogForModel[] {
  return pricingItems.map((item) => ({
    sku: item.sku,
    category: item.category,
    name: item.name,
    description: item.description,
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
  }))
}

function conciseError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Revision failed"
  return message.length > 500 ? `${message.slice(0, 497)}...` : message
}

function blockersFromIssues(
  issues: Array<{ severity: string; code: string; message: string }>
): string[] {
  return issues
    .filter((issue) => issue.severity === "BLOCKING")
    .map((issue) => `${issue.code}: ${issue.message}`)
}

function warningsFromIssues(
  issues: Array<{ severity: string; code: string; message: string }>
): string[] {
  return issues
    .filter((issue) => issue.severity === "WARNING")
    .map((issue) => `${issue.code}: ${issue.message}`)
}

export async function reviseProposalFromSlackThread(input: {
  slackChannelId: string
  slackThreadTs: string
  slackUserId?: string
  instructions: string
}): Promise<void> {
  const activeReview = await prisma.proposalReview.findFirst({
    where: {
      slackChannelId: input.slackChannelId,
      slackThreadTs: input.slackThreadTs,
      status: "REQUESTED",
    },
    include: {
      proposal: { include: { lead: true } },
      version: true,
    },
    orderBy: { requestedAt: "desc" },
  })

  if (!activeReview) {
    return
  }

  const revision = await prisma.revisionRequest.create({
    data: {
      proposalId: activeReview.proposalId,
      reviewId: activeReview.id,
      instructions: input.instructions,
      slackUserId: input.slackUserId,
      status: "PROCESSING",
    },
  })

  try {
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: activeReview.proposalId },
        data: { status: "REVISING" },
      }),
      prisma.lead.update({
        where: { id: activeReview.proposal.leadId },
        data: { status: "REVISING" },
      }),
    ])

    const [proposal, photos, pricingItems] = await Promise.all([
      prisma.proposal.findUnique({
        where: { id: activeReview.proposalId },
        include: {
          lead: true,
          versions: {
            where: {
              id:
                activeReview.proposal.currentVersionId ??
                activeReview.versionId,
            },
            take: 1,
          },
        },
      }),
      prisma.photo.findMany({
        where: { leadId: activeReview.proposal.leadId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.pricingItem.findMany({
        where: { active: true },
        select: {
          id: true,
          sku: true,
          category: true,
          name: true,
          description: true,
          unit: true,
          unitPriceCents: true,
          active: true,
          requiresMeasurement: true,
          requiresReview: true,
          tags: true,
        },
        orderBy: { sku: "asc" },
      }),
    ])

    if (!proposal) {
      throw new Error("Proposal not found for revision")
    }

    const currentVersion = proposal.versions[0]
    if (!currentVersion) {
      throw new Error("Current proposal version not found for revision")
    }

    const previousDraft = proposalDraftSchema.parse(currentVersion.rawModelJson)
    const leadForAi = {
      name: proposal.lead.name,
      email: proposal.lead.email,
      phone: proposal.lead.phone,
      address: proposal.lead.address,
      projectType: proposal.lead.projectType,
      budgetMinCents: proposal.lead.budgetMinCents,
      budgetMaxCents: proposal.lead.budgetMaxCents,
      notes: proposal.lead.notes,
    }
    const rawDraft = await proposalAi.reviseProposal({
      lead: leadForAi,
      photoUrls: photos.map((photo) => photo.url),
      pricingCatalog: toPricingCatalogForModel(pricingItems),
      previousDraft,
      revisionInstructions: input.instructions,
    })
    const draft = proposalDraftSchema.parse(rawDraft)
    const validation = validateProposalDraft({
      pricingItems,
      budgetMinCents: proposal.lead.budgetMinCents,
      budgetMaxCents: proposal.lead.budgetMaxCents,
      draft,
    })

    const version = await prisma.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        versionNumber: currentVersion.versionNumber + 1,
        aiModel: AI_MODEL_LABEL,
        promptVersion: PROMPT_VERSION,
        executiveSummary: draft.executiveSummary,
        customerMessage: draft.customerMessage,
        renderBrief: draft.renderBrief,
        totalCents: validation.totalCents,
        confidence: draft.confidence,
        rawModelJson: toJsonValue(draft),
      },
    })

    if (validation.lineItems.length > 0) {
      await prisma.proposalLineItem.createMany({
        data: validation.lineItems.map((lineItem) => ({
          versionId: version.id,
          pricingItemId: lineItem.pricingItemId,
          sku: lineItem.sku,
          name: lineItem.name,
          description: lineItem.description,
          unit: lineItem.unit,
          quantity: lineItem.quantity,
          quantitySource: lineItem.quantitySource,
          unitPriceCents: lineItem.unitPriceCents,
          totalCents: lineItem.totalCents,
          confidence: lineItem.confidence,
          reviewRequired: lineItem.reviewRequired,
          notes: lineItem.notes,
        })),
      })
    }

    if (validation.issues.length > 0) {
      await prisma.guardrailIssue.createMany({
        data: validation.issues.map((issue) => ({
          versionId: version.id,
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          metadata: issue.metadata ? toJsonValue(issue.metadata) : undefined,
        })),
      })
    }

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        currentVersionId: version.id,
        totalCents: validation.totalCents,
        confidence: draft.confidence,
      },
    })

    await prisma.proposalReview.update({
      where: { id: activeReview.id },
      data: { status: "SUPERSEDED", decidedAt: new Date() },
    })

    if (validation.blocked) {
      await prisma.$transaction([
        prisma.proposal.update({
          where: { id: proposal.id },
          data: { status: "BLOCKED" },
        }),
        prisma.lead.update({
          where: { id: proposal.leadId },
          data: { status: "BLOCKED" },
        }),
      ])

      const blockers = blockersFromIssues(validation.issues)
      await review.postThreadMessage({
        slackChannelId: input.slackChannelId,
        slackThreadTs: input.slackThreadTs,
        text:
          `I revised the proposal, but guardrails blocked it from review. ` +
          `Blockers: ${blockers.length > 0 ? blockers.join("; ") : "unknown guardrail failure"}.`,
      })
    } else {
      const internalUrl = proposalUrl(proposal.id)
      const summaryText = buildProposalReviewText({
        leadName: proposal.lead.name,
        projectType: proposal.lead.projectType,
        totalCents: validation.totalCents,
        blocked: false,
      })
      const reviewThread = await review.postRevisionUpdate({
        proposalId: proposal.id,
        versionId: version.id,
        summaryText,
        blocks: buildProposalReviewBlocks({
          proposalId: proposal.id,
          versionId: version.id,
          internalUrl,
          leadName: proposal.lead.name,
          projectType: proposal.lead.projectType,
          totalCents: validation.totalCents,
          issues: validation.issues,
        }),
        totalCents: validation.totalCents,
        warnings: warningsFromIssues(validation.issues),
        blockers: blockersFromIssues(validation.issues),
        internalProposalUrl: internalUrl,
        slackThreadTs: input.slackThreadTs,
      })

      await prisma.$transaction([
        prisma.proposalReview.create({
          data: {
            proposalId: proposal.id,
            versionId: version.id,
            channel: reviewThread.channel,
            status: "REQUESTED",
            slackChannelId: reviewThread.slackChannelId,
            slackMessageTs: reviewThread.slackMessageTs,
            slackThreadTs: reviewThread.slackThreadTs,
          },
        }),
        prisma.proposal.update({
          where: { id: proposal.id },
          data: { status: "PENDING_REVIEW" },
        }),
        prisma.lead.update({
          where: { id: proposal.leadId },
          data: { status: "PENDING_REVIEW" },
        }),
      ])
    }

    await prisma.revisionRequest.update({
      where: { id: revision.id },
      data: { status: "APPLIED" },
    })
  } catch (error) {
    const message = conciseError(error)

    await prisma.revisionRequest.update({
      where: { id: revision.id },
      data: { status: "FAILED", error: message },
    })

    await review.postThreadMessage({
      slackChannelId: input.slackChannelId,
      slackThreadTs: input.slackThreadTs,
      text: `I could not revise this proposal: ${message}`,
    })
  }
}
