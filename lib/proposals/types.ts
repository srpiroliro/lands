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
