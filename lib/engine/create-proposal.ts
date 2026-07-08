import crypto from "node:crypto"

import type { Prisma } from "@prisma/client"

import { crm } from "@/lib/crm"
import { prisma } from "@/lib/db"
import { validateProposalDraft } from "@/lib/domain/guardrails"
import type { PricingCatalogForModel } from "@/lib/domain/types"
import { env } from "@/lib/env"
import type { LeadIntakeInput } from "@/lib/intake/types"
import { media } from "@/lib/media"
import { proposalAi } from "@/lib/proposal"
import { proposalDraftSchema } from "@/lib/engine/schema"
import type { ProposalCreateResult } from "@/lib/engine/types"
import { review } from "@/lib/review"

const AI_MODEL_LABEL = "selected-proposal-ai"
const PROMPT_VERSION = "proposal-draft-v1"

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

export async function createProposal(
  input: LeadIntakeInput
): Promise<ProposalCreateResult> {
  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      projectType: input.projectType,
      budgetMinCents: input.budgetMinCents,
      budgetMaxCents: input.budgetMaxCents,
      notes: input.notes,
      status: "DRAFTING",
    },
  })

  const storedPhotos = []
  for (const file of input.photos) {
    storedPhotos.push(await media.saveLeadPhoto({ leadId: lead.id, file }))
  }

  if (storedPhotos.length > 0) {
    await prisma.photo.createMany({
      data: storedPhotos.map((photo) => ({
        leadId: lead.id,
        url: photo.url,
        downloadUrl: photo.downloadUrl,
        pathname: photo.pathname,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
      })),
    })
  }

  const pricingItems = await prisma.pricingItem.findMany({
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
  })

  const leadForAi = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    projectType: input.projectType,
    budgetMinCents: input.budgetMinCents,
    budgetMaxCents: input.budgetMaxCents,
    notes: input.notes,
  }
  const rawDraft = await proposalAi.draftProposal({
    lead: leadForAi,
    photoUrls: storedPhotos.map((photo) => photo.url),
    pricingCatalog: toPricingCatalogForModel(pricingItems),
  })
  const draft = proposalDraftSchema.parse(rawDraft)
  const measurementAudit = await proposalAi.auditMeasurements({
    lead: leadForAi,
    photoUrls: storedPhotos.map((photo) => photo.url),
    pricingCatalog: toPricingCatalogForModel(pricingItems),
    draft,
  })
  const validation = validateProposalDraft({
    pricingItems,
    budgetMinCents: input.budgetMinCents,
    budgetMaxCents: input.budgetMaxCents,
    draft,
    measurementAudit,
  })

  const publicToken = crypto.randomBytes(24).toString("hex")
  const proposal = await prisma.proposal.create({
    data: {
      leadId: lead.id,
      publicToken,
      status: "DRAFT",
      totalCents: validation.totalCents,
      confidence: draft.confidence,
    },
  })

  const version = await prisma.proposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNumber: 1,
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

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { currentVersionId: version.id },
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

  const internalUrl = proposalUrl(proposal.id)
  const reviewThread = await review.requestProposalReview({
    proposalId: proposal.id,
    versionId: version.id,
    internalProposalUrl: internalUrl,
    leadName: lead.name,
    projectType: lead.projectType,
    totalCents: validation.totalCents,
    blocked: validation.blocked,
    issues: validation.issues,
  })

  const nextStatus = validation.blocked ? "BLOCKED" : "PENDING_REVIEW"

  await prisma.proposalReview.create({
    data: {
      proposalId: proposal.id,
      versionId: version.id,
      channel: reviewThread.channel,
      status: "REQUESTED",
      slackChannelId: reviewThread.slackChannelId,
      slackMessageTs: reviewThread.slackMessageTs,
      slackThreadTs: reviewThread.slackThreadTs,
    },
  })

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status: nextStatus },
    }),
    prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: nextStatus },
    }),
  ])

  await crm.upsertLead({
    leadId: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
  })
  await crm.attachProposalLink({
    leadId: lead.id,
    proposalId: proposal.id,
    url: internalUrl,
  })

  return { proposalId: proposal.id, versionId: version.id, blocked: false }
}
