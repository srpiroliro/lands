import { describe, expect, it } from "vitest"

import { measurementAuditResultSchema } from "./schema"

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
