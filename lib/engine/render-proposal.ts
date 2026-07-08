import { prisma } from "@/lib/db"
import type { MoneyCents } from "@/lib/domain/types"
import { env } from "@/lib/env"

type JsonRecord = Record<string, unknown>

export type ProposalLineItemView = {
  sku: string
  category: string
  name: string
  description: string
  unit: string
  quantity: number
  quantitySource?: string
  unitPriceCents: MoneyCents
  totalCents: MoneyCents
  confidence?: number
  reviewRequired?: boolean
  notes?: string | null
}

export type GuardrailIssueView = {
  severity: string
  code: string
  message: string
  metadata?: unknown
}

export type InternalProposalView = {
  id: string
  status: string
  totalCents: MoneyCents
  confidence: number
  publicUrl: string
  createdAt: Date
  updatedAt: Date
  lead: {
    id: string
    name: string
    email: string
    phone: string | null
    address: string | null
    projectType: string
    budgetMinCents: MoneyCents | null
    budgetMaxCents: MoneyCents | null
    notes: string
    status: string
  }
  currentVersion: {
    id: string
    versionNumber: number
    executiveSummary: string
    customerMessage: string
    renderBrief: string | null
    totalCents: MoneyCents
    confidence: number
    assumptions: string[]
    unknowns: string[]
    createdAt: Date
  }
  lineItems: ProposalLineItemView[]
  guardrails: GuardrailIssueView[]
  review: {
    status: string
    channel: string
    slackChannelId: string | null
    slackMessageTs: string | null
    slackThreadTs: string | null
    requestedAt: Date
    decidedAt: Date | null
    decidedBy: string | null
  } | null
}

export type PublicProposalView = {
  id: string
  status: string
  totalCents: MoneyCents
  lead: {
    name: string
    address: string | null
    projectType: string
  }
  currentVersion: {
    executiveSummary: string
    customerMessage: string
    assumptions: string[]
    unknowns: string[]
  }
  lineItems: ProposalLineItemView[]
}

export function formatMoneyCents(amount: MoneyCents): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringArrayFromRaw(
  rawModelJson: unknown,
  key: "assumptions" | "unknowns"
): string[] {
  if (!isRecord(rawModelJson)) return []
  const value = rawModelJson[key]
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  )
}

function publicProposalUrl(publicToken: string): string {
  return `${env.APP_BASE_URL}/p/${publicToken}`
}

async function getCurrentVersion(currentVersionId: string) {
  return prisma.proposalVersion.findUnique({
    where: { id: currentVersionId },
    include: {
      lineItems: {
        include: { pricingItem: true },
        orderBy: { sku: "asc" },
      },
      guardrails: {
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      },
    },
  })
}

function toLineItems(
  lineItems: NonNullable<
    Awaited<ReturnType<typeof getCurrentVersion>>
  >["lineItems"],
  includeInternal: boolean
): ProposalLineItemView[] {
  return lineItems.map((item) => ({
    sku: item.sku,
    category: item.pricingItem.category,
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    ...(includeInternal ? { quantitySource: item.quantitySource } : {}),
    unitPriceCents: item.unitPriceCents,
    totalCents: item.totalCents,
    ...(includeInternal ? { confidence: Number(item.confidence) } : {}),
    ...(includeInternal ? { reviewRequired: item.reviewRequired } : {}),
    ...(includeInternal ? { notes: item.notes } : {}),
  }))
}

export async function getInternalProposalView(
  proposalId: string
): Promise<InternalProposalView | null> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lead: true,
      reviews: {
        orderBy: { requestedAt: "desc" },
        take: 1,
      },
    },
  })

  if (!proposal?.currentVersionId) return null

  const currentVersion = await getCurrentVersion(proposal.currentVersionId)
  if (!currentVersion) return null

  const review = proposal.reviews[0] ?? null

  return {
    id: proposal.id,
    status: proposal.status,
    totalCents: proposal.totalCents,
    confidence: Number(proposal.confidence),
    publicUrl: publicProposalUrl(proposal.publicToken),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    lead: {
      id: proposal.lead.id,
      name: proposal.lead.name,
      email: proposal.lead.email,
      phone: proposal.lead.phone,
      address: proposal.lead.address,
      projectType: proposal.lead.projectType,
      budgetMinCents: proposal.lead.budgetMinCents,
      budgetMaxCents: proposal.lead.budgetMaxCents,
      notes: proposal.lead.notes,
      status: proposal.lead.status,
    },
    currentVersion: {
      id: currentVersion.id,
      versionNumber: currentVersion.versionNumber,
      executiveSummary: currentVersion.executiveSummary,
      customerMessage: currentVersion.customerMessage,
      renderBrief: currentVersion.renderBrief,
      totalCents: currentVersion.totalCents,
      confidence: Number(currentVersion.confidence),
      assumptions: stringArrayFromRaw(
        currentVersion.rawModelJson,
        "assumptions"
      ),
      unknowns: stringArrayFromRaw(currentVersion.rawModelJson, "unknowns"),
      createdAt: currentVersion.createdAt,
    },
    lineItems: toLineItems(currentVersion.lineItems, true),
    guardrails: currentVersion.guardrails.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      metadata: issue.metadata,
    })),
    review: review
      ? {
          status: review.status,
          channel: review.channel,
          slackChannelId: review.slackChannelId,
          slackMessageTs: review.slackMessageTs,
          slackThreadTs: review.slackThreadTs,
          requestedAt: review.requestedAt,
          decidedAt: review.decidedAt,
          decidedBy: review.decidedBy,
        }
      : null,
  }
}

export async function getPublicProposalView(
  publicToken: string
): Promise<PublicProposalView | null> {
  const proposal = await prisma.proposal.findUnique({
    where: { publicToken },
    include: { lead: true },
  })

  if (!proposal?.currentVersionId) return null

  const currentVersion = await getCurrentVersion(proposal.currentVersionId)
  if (!currentVersion) return null

  return {
    id: proposal.id,
    status: proposal.status,
    totalCents: proposal.totalCents,
    lead: {
      name: proposal.lead.name,
      address: proposal.lead.address,
      projectType: proposal.lead.projectType,
    },
    currentVersion: {
      executiveSummary: currentVersion.executiveSummary,
      customerMessage: currentVersion.customerMessage,
      assumptions: stringArrayFromRaw(
        currentVersion.rawModelJson,
        "assumptions"
      ),
      unknowns: stringArrayFromRaw(currentVersion.rawModelJson, "unknowns"),
    },
    lineItems: toLineItems(currentVersion.lineItems, false),
  }
}
