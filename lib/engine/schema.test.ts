import { describe, expect, it } from "vitest"

import { measurementAuditResultSchema, proposalDraftSchema } from "./schema"

describe("proposalDraftSchema", () => {
  it("defaults the timeline for proposal versions created before timeline support", () => {
    const result = proposalDraftSchema.parse({
      executiveSummary:
        "Premium backyard patio proposal with pavers and site preparation.",
      customerMessage:
        "Thanks for trusting Greenscape Pro with your backyard transformation.",
      lineItems: [
        {
          sku: "PAVER-SF",
          quantity: 500,
          quantitySource: "USER",
          confidence: 0.9,
          notes: "Measured during the site walk.",
        },
      ],
      assumptions: [],
      unknowns: [],
      renderBrief: null,
      confidence: 0.9,
    })

    expect(result.timeline).toBe("Timeline to be confirmed during review.")
  })
})

describe("measurementAuditResultSchema", () => {
  it("accepts schema-valid measurement audit output", () => {
    const result = measurementAuditResultSchema.parse({
      issues: [
        {
          sku: "PAVER-SF",
          severity: "BLOCKING",
          code: "NO_SCALE_REFERENCE",
          message: "Photo-only paver square footage needs confirmation.",
          modelSuggestedQuantity: null,
          confidence: 0.42,
          reason:
            "Photos show a patio area but no scale reference or explicit square footage was provided.",
        },
      ],
      overallRisk: "HIGH",
      summary: "One blocking measurement issue needs human review.",
    })

    expect(result.issues[0]?.code).toBe("NO_SCALE_REFERENCE")
    expect(result.issues[0]?.modelSuggestedQuantity).toBeNull()
  })

  it("rejects invalid measurement audit confidence", () => {
    expect(() =>
      measurementAuditResultSchema.parse({
        issues: [
          {
            sku: "TURF-SF",
            severity: "WARNING",
            code: "MEASUREMENT_NEEDS_CONFIRMATION",
            message: "Confirm turf square footage.",
            modelSuggestedQuantity: 600,
            confidence: 1.2,
            reason: "The notes and photos do not clearly support the estimate.",
          },
        ],
        overallRisk: "MEDIUM",
        summary: "Review turf measurement.",
      })
    ).toThrow()
  })
})
