import type { MoneyCents, QuantitySource } from "@/lib/domain/types"

export type AiLineItemDraft = {
  sku: string
  quantity: number
  quantitySource: QuantitySource
  confidence: number
  notes: string
}

export type ProposalDraft = {
  executiveSummary: string
  customerMessage: string
  lineItems: AiLineItemDraft[]
  assumptions: string[]
  unknowns: string[]
  renderBrief: string | null
  confidence: number
}

export type MeasurementAuditIssue = {
  sku: string
  severity: "WARNING" | "BLOCKING"
  code:
    | "MEASUREMENT_NEEDS_CONFIRMATION"
    | "NO_SCALE_REFERENCE"
    | "MEASUREMENT_DISAGREEMENT"
    | "UNIT_MISMATCH_RISK"
  message: string
  modelSuggestedQuantity: number | null
  confidence: number
  reason: string
}

export type MeasurementAuditResult = {
  issues: MeasurementAuditIssue[]
  overallRisk: "LOW" | "MEDIUM" | "HIGH"
  summary: string
}

export type ProposalCreateResult = {
  proposalId: string
  versionId: string
  blocked: boolean
}

export type ProposalViewLineItem = {
  sku: string
  category?: string
  name: string
  description: string
  unit: string
  quantity: number
  unitPriceCents: MoneyCents
  totalCents: MoneyCents
  reviewRequired: boolean
}
