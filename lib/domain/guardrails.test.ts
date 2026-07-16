import { describe, expect, it } from "vitest"

import { validateProposalDraft } from "./guardrails"
import type { PricingCatalogItem } from "./types"
import type { MeasurementAuditResult, ProposalDraft } from "../engine/types"

const pricingItems: PricingCatalogItem[] = [
  {
    id: "price-paver",
    sku: "PAVER-SF",
    category: "hardscape",
    name: "Premium pavers",
    description: "Installed premium pavers",
    unit: "sf",
    unitPriceCents: 2_000,
    active: true,
    requiresMeasurement: true,
    requiresReview: false,
    tags: [],
  },
]

const draft: ProposalDraft = {
  executiveSummary:
    "Premium backyard patio proposal with pavers and site preparation.",
  customerMessage:
    "Thanks for trusting Greenscape Pro with your backyard transformation.",
  lineItems: [
    {
      sku: "PAVER-SF",
      quantity: 500,
      quantitySource: "AI_ESTIMATE",
      confidence: 0.9,
      notes: "Estimated patio square footage from customer photos.",
    },
  ],
  assumptions: [],
  unknowns: [],
  renderBrief: null,
  confidence: 0.9,
}

const measurementAudit: MeasurementAuditResult = {
  issues: [
    {
      sku: "PAVER-SF",
      severity: "BLOCKING",
      code: "NO_SCALE_REFERENCE",
      message: "Confirm paver square footage before sending.",
      modelSuggestedQuantity: null,
      confidence: 0.36,
      reason: "Photos show the patio area but include no scale reference.",
    },
  ],
  overallRisk: "HIGH",
  summary: "Photo-only square footage has no reliable scale reference.",
}

describe("validateProposalDraft measurement audit conversion", () => {
  it("converts measurement audit issues into guardrails without changing pricing", () => {
    const validation = validateProposalDraft({
      pricingItems,
      draft,
      measurementAudit,
    })

    expect(validation.totalCents).toBe(1_000_000)
    expect(validation.blocked).toBe(true)
    expect(validation.issues).toContainEqual({
      severity: "BLOCKING",
      code: "NO_SCALE_REFERENCE",
      message: "Confirm paver square footage before sending.",
      metadata: {
        sku: "PAVER-SF",
        modelSuggestedQuantity: null,
        confidence: 0.36,
        reason: "Photos show the patio area but include no scale reference.",
        auditSummary:
          "Photo-only square footage has no reliable scale reference.",
        auditOverallRisk: "HIGH",
      },
    })
  })

  it("ignores no-scale findings for user measurements and count items", () => {
    const measuredDraft: ProposalDraft = {
      ...draft,
      lineItems: [
        {
          ...draft.lineItems[0]!,
          quantitySource: "USER",
          notes: "Marcus measured 20 ft by 25 ft during the site walk.",
        },
        {
          sku: "LIGHT-EA",
          quantity: 8,
          quantitySource: "AI_ESTIMATE",
          confidence: 0.9,
          notes: "Eight fixtures requested in the site-walk notes.",
        },
      ],
    }
    const lightingItem: PricingCatalogItem = {
      id: "price-light",
      sku: "LIGHT-EA",
      category: "lighting",
      name: "Landscape lighting fixture",
      description: "Installed low-voltage fixture",
      unit: "ea",
      unitPriceCents: 28_500,
      active: true,
      requiresMeasurement: false,
      requiresReview: false,
      tags: [],
    }
    const falsePositiveAudit: MeasurementAuditResult = {
      issues: [
        measurementAudit.issues[0]!,
        {
          sku: "LIGHT-EA",
          severity: "BLOCKING",
          code: "NO_SCALE_REFERENCE",
          message: "Confirm lighting quantity before sending.",
          modelSuggestedQuantity: null,
          confidence: 0.3,
          reason: "No scale reference is visible in the photos.",
        },
      ],
      overallRisk: "HIGH",
      summary: "The model incorrectly requested photo scale references.",
    }

    const validation = validateProposalDraft({
      pricingItems: [...pricingItems, lightingItem],
      draft: measuredDraft,
      measurementAudit: falsePositiveAudit,
    })

    expect(validation.blocked).toBe(false)
    expect(validation.issues).toEqual([])
  })
})
