import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { validateProposalDraft } from "@/lib/domain/guardrails"
import type {
  GuardrailIssueDraft,
  PricingCatalogForModel,
} from "@/lib/domain/types"
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

async function requestReviewForVersion(input: {
  proposalId: string
  versionId: string
  leadName: string
  projectType: string
  totalCents: number
  blocked: boolean
  issues: GuardrailIssueDraft[]
  slackThreadTs?: string
}) {
  const internalUrl = proposalUrl(input.proposalId)
  const summaryText = buildProposalReviewText({
    leadName: input.leadName,
    projectType: input.projectType,
    totalCents: input.totalCents,
    blocked: input.blocked,
  })
  const request = {
    proposalId: input.proposalId,
    versionId: input.versionId,
    summaryText,
    blocks: buildProposalReviewBlocks({
      proposalId: input.proposalId,
      versionId: input.versionId,
      internalUrl,
      leadName: input.leadName,
      projectType: input.projectType,
      totalCents: input.totalCents,
      issues: input.issues,
    }),
    totalCents: input.totalCents,
    warnings: warningsFromIssues(input.issues),
    blockers: blockersFromIssues(input.issues),
    internalProposalUrl: internalUrl,
  }

  if (input.slackThreadTs) {
    return review.postRevisionUpdate({
      ...request,
      slackThreadTs: input.slackThreadTs,
    })
  }

  return review.requestReview(request)
}

export async function reviseProposalFromFeedback(input: {
  proposalId: string
  instructions: string
  source: string
  actorId?: string
  reviewId?: string | null
  slackChannelId?: string
  slackThreadTs?: string
}): Promise<void> {
  const proposalForRevision = await prisma.proposal.findUnique({
    where: { id: input.proposalId },
    include: { lead: true },
  })

  if (!proposalForRevision) {
    return
  }

  if (!proposalForRevision.currentVersionId) {
    return
  }

  const revision = await prisma.revisionRequest.create({
    data: {
      proposalId: proposalForRevision.id,
      reviewId: input.reviewId ?? null,
      instructions: input.instructions,
      source: input.source,
      slackUserId: input.source === "slack-thread" ? input.actorId : undefined,
      status: "PROCESSING",
    },
  })

  try {
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposalForRevision.id },
        data: { status: "REVISING" },
      }),
      prisma.lead.update({
        where: { id: proposalForRevision.leadId },
        data: { status: "REVISING" },
      }),
    ])

    const [proposal, photos, pricingItems] = await Promise.all([
      prisma.proposal.findUnique({
        where: { id: proposalForRevision.id },
        include: {
          lead: true,
          versions: {
            where: { id: proposalForRevision.currentVersionId },
            take: 1,
          },
        },
      }),
      prisma.photo.findMany({
        where: { leadId: proposalForRevision.leadId },
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
    const measurementAudit = await proposalAi.auditMeasurements({
      lead: leadForAi,
      photoUrls: photos.map((photo) => photo.url),
      pricingCatalog: toPricingCatalogForModel(pricingItems),
      draft,
    })
    const validation = validateProposalDraft({
      pricingItems,
      budgetMinCents: proposal.lead.budgetMinCents,
      budgetMaxCents: proposal.lead.budgetMaxCents,
      draft,
      measurementAudit,
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
        rawModelJson: toJsonValue({
          ...draft,
          measurementAudit,
        }),
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

    if (input.reviewId) {
      await prisma.proposalReview.update({
        where: { id: input.reviewId },
        data: { status: "SUPERSEDED", decidedAt: new Date() },
      })
    }

    const reviewThread = await requestReviewForVersion({
      proposalId: proposal.id,
      versionId: version.id,
      leadName: proposal.lead.name,
      projectType: proposal.lead.projectType,
      totalCents: validation.totalCents,
      blocked: validation.blocked,
      issues: validation.issues,
      slackThreadTs: input.slackThreadTs,
    })

    const nextStatus = validation.blocked ? "BLOCKED" : "PENDING_REVIEW"

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
        data: {
          currentVersionId: version.id,
          totalCents: validation.totalCents,
          confidence: draft.confidence,
          status: nextStatus,
        },
      }),
      prisma.lead.update({
        where: { id: proposal.leadId },
        data: { status: nextStatus },
      }),
      prisma.revisionRequest.update({
        where: { id: revision.id },
        data: { status: "APPLIED" },
      }),
    ])
  } catch (error) {
    const message = conciseError(error)

    await prisma.revisionRequest.update({
      where: { id: revision.id },
      data: { status: "FAILED", error: message },
    })

    if (input.slackChannelId && input.slackThreadTs) {
      await review.postThreadMessage({
        slackChannelId: input.slackChannelId,
        slackThreadTs: input.slackThreadTs,
        text: `I could not revise this proposal: ${message}`,
      })
    }

    throw new Error(message)
  }
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
    orderBy: { requestedAt: "desc" },
  })

  if (!activeReview) {
    return
  }

  await reviseProposalFromFeedback({
    proposalId: activeReview.proposalId,
    reviewId: activeReview.id,
    instructions: input.instructions,
    source: "slack-thread",
    actorId: input.slackUserId,
    slackChannelId: input.slackChannelId,
    slackThreadTs: input.slackThreadTs,
  })
}
