import { indexPricingItems } from "@/lib/domain/pricing"
import type {
  GuardrailIssueDraft,
  PricingCatalogItem,
  ValidatedLineItem,
  ValidationResult,
} from "@/lib/domain/types"
import type { MeasurementAuditResult, ProposalDraft } from "@/lib/engine/types"

const BUSINESS_MIN_TOTAL_CENTS = 800_000
const BUSINESS_MAX_TOTAL_CENTS = 12_000_000
const RENDER_REQUIRED_THRESHOLD_CENTS = 3_000_000
const MIN_DRAFT_CONFIDENCE = 0.7
const MIN_LINE_CONFIDENCE = 0.7

export function validateProposalDraft(input: {
  pricingItems: PricingCatalogItem[]
  budgetMinCents?: number | null
  budgetMaxCents?: number | null
  draft: ProposalDraft
  measurementAudit?: MeasurementAuditResult | null
}): ValidationResult {
  const pricingBySku = indexPricingItems(input.pricingItems)
  const issues: GuardrailIssueDraft[] = []
  const lineItems: ValidatedLineItem[] = []

  for (const lineItem of input.draft.lineItems) {
    const pricingItem = pricingBySku.get(lineItem.sku)

    if (!pricingItem) {
      issues.push({
        severity: "BLOCKING",
        code: "UNKNOWN_SKU",
        message: `${lineItem.sku} is not an active pricing catalog SKU.`,
        metadata: { sku: lineItem.sku },
      })
      continue
    }

    const totalCents = Math.round(
      pricingItem.unitPriceCents * lineItem.quantity
    )
    const reviewReasons: string[] = []

    if (pricingItem.requiresReview) {
      reviewReasons.push("catalog_review_required")
      issues.push({
        severity: "WARNING",
        code: "CATALOG_REVIEW_REQUIRED",
        message: `${lineItem.sku} requires manual pricing review.`,
        metadata: { sku: lineItem.sku },
      })
    }

    if (lineItem.confidence < MIN_LINE_CONFIDENCE) {
      reviewReasons.push("low_line_confidence")
      issues.push({
        severity: "WARNING",
        code: "LOW_LINE_CONFIDENCE",
        message: `${lineItem.sku} line item confidence is below ${MIN_LINE_CONFIDENCE}.`,
        metadata: { sku: lineItem.sku, confidence: lineItem.confidence },
      })
    }

    lineItems.push({
      pricingItemId: pricingItem.id,
      sku: pricingItem.sku,
      name: pricingItem.name,
      description: pricingItem.description,
      unit: pricingItem.unit,
      quantity: lineItem.quantity,
      quantitySource: lineItem.quantitySource,
      unitPriceCents: pricingItem.unitPriceCents,
      totalCents,
      confidence: lineItem.confidence,
      reviewRequired: reviewReasons.length > 0,
      notes: lineItem.notes,
    })
  }

  const totalCents = lineItems.reduce(
    (sum, lineItem) => sum + lineItem.totalCents,
    0
  )
  if (totalCents < BUSINESS_MIN_TOTAL_CENTS) {
    issues.push({
      severity: "BLOCKING",
      code: "TOTAL_BELOW_BUSINESS_MIN",
      message:
        "Proposal total is below Greenscape Pro's $8,000 minimum project range.",
      metadata: {
        totalCents,
        minimumCents: BUSINESS_MIN_TOTAL_CENTS,
      },
    })
  }

  if (totalCents > BUSINESS_MAX_TOTAL_CENTS) {
    issues.push({
      severity: "BLOCKING",
      code: "TOTAL_ABOVE_BUSINESS_MAX",
      message:
        "Proposal total is above Greenscape Pro's $120,000 standard project range.",
      metadata: {
        totalCents,
        maximumCents: BUSINESS_MAX_TOTAL_CENTS,
      },
    })
  }

  if (
    input.budgetMinCents != null &&
    input.budgetMinCents >= 0 &&
    totalCents < input.budgetMinCents
  ) {
    issues.push({
      severity: "WARNING",
      code: "UNDER_BUDGET_MIN",
      message: "Proposal total is below the customer's stated budget range.",
      metadata: {
        totalCents,
        budgetMinCents: input.budgetMinCents,
      },
    })
  }

  if (
    input.budgetMaxCents != null &&
    input.budgetMaxCents >= 0 &&
    totalCents > input.budgetMaxCents
  ) {
    issues.push({
      severity: "WARNING",
      code: "OVER_BUDGET_MAX",
      message: "Proposal total is above the customer's stated budget range.",
      metadata: {
        totalCents,
        budgetMaxCents: input.budgetMaxCents,
      },
    })
  }

  if (input.draft.confidence < MIN_DRAFT_CONFIDENCE) {
    issues.push({
      severity: "BLOCKING",
      code: "LOW_DRAFT_CONFIDENCE",
      message: `Draft confidence is below ${MIN_DRAFT_CONFIDENCE}.`,
      metadata: { confidence: input.draft.confidence },
    })
  }

  if (totalCents > RENDER_REQUIRED_THRESHOLD_CENTS) {
    issues.push({
      severity: "WARNING",
      code: "RENDER_REQUIRED",
      message: "Projects over $30,000 require a 3D render before sending.",
      metadata: {
        totalCents,
        thresholdCents: RENDER_REQUIRED_THRESHOLD_CENTS,
      },
    })
  }

  const draftLineItemsBySku = new Map(
    input.draft.lineItems.map((lineItem) => [lineItem.sku, lineItem])
  )

  for (const auditIssue of input.measurementAudit?.issues ?? []) {
    const pricingItem = pricingBySku.get(auditIssue.sku)
    const draftLineItem = draftLineItemsBySku.get(auditIssue.sku)

    // Audit output is model-generated. Ignore issues for lines that are not
    // actually in this draft instead of allowing hallucinated SKUs to block it.
    if (!pricingItem || !draftLineItem) continue

    if (auditIssue.code === "NO_SCALE_REFERENCE") {
      const unit = pricingItem.unit.toLowerCase()
      const isPhotoOnlyMeasuredUnit =
        pricingItem.requiresMeasurement &&
        (unit === "sf" || unit === "lf") &&
        draftLineItem.quantitySource === "AI_ESTIMATE"

      // A missing photo scale is irrelevant to user/manual measurements and
      // count-based items. Enforce this rule in code rather than trusting the
      // auditor to apply it consistently.
      if (!isPhotoOnlyMeasuredUnit) continue
    }

    issues.push({
      severity: auditIssue.severity,
      code: auditIssue.code,
      message: auditIssue.message,
      metadata: {
        sku: auditIssue.sku,
        modelSuggestedQuantity: auditIssue.modelSuggestedQuantity,
        confidence: auditIssue.confidence,
        reason: auditIssue.reason,
        auditSummary: input.measurementAudit?.summary,
        auditOverallRisk: input.measurementAudit?.overallRisk,
      },
    })
  }

  return {
    blocked: issues.some((issue) => issue.severity === "BLOCKING"),
    totalCents,
    lineItems,
    issues,
  }
}
