export type MoneyCents = number

export type PricingCatalogItem = {
  id: string
  sku: string
  category: string
  name: string
  description: string
  unit: string
  unitPriceCents: MoneyCents
  active: boolean
  requiresMeasurement: boolean
  requiresReview: boolean
  tags: string[]
}

export type PricingCatalogForModel = Pick<
  PricingCatalogItem,
  "sku" | "category" | "name" | "description" | "unit" | "unitPriceCents"
>

export type QuantitySource = "USER" | "AI_ESTIMATE" | "CATALOG_DEFAULT" | "MANUAL_OVERRIDE"
export type GuardrailSeverity = "INFO" | "WARNING" | "BLOCKING"

export type GuardrailIssueDraft = {
  severity: GuardrailSeverity
  code: string
  message: string
  metadata?: Record<string, unknown>
}

export type ValidatedLineItem = {
  pricingItemId: string
  sku: string
  name: string
  description: string
  unit: string
  quantity: number
  quantitySource: QuantitySource
  unitPriceCents: MoneyCents
  totalCents: MoneyCents
  confidence: number
  reviewRequired: boolean
  notes: string
}

export type ValidationResult = {
  blocked: boolean
  totalCents: MoneyCents
  lineItems: ValidatedLineItem[]
  issues: GuardrailIssueDraft[]
}
