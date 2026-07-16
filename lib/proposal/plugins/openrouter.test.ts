import { describe, expect, it, vi } from "vitest"

function stubEnv() {
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@example.com:5432/db")
  vi.stubEnv("DIRECT_URL", "postgres://user:pass@example.com:5432/db")
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token")
  vi.stubEnv("OPENROUTER_API_KEY", "openrouter-token")
  vi.stubEnv("OPENROUTER_MODEL", "first-model")
  vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "fallback-model")
  vi.stubEnv("OPENROUTER_SITE_URL", "http://localhost:3000")
  vi.stubEnv("OPENROUTER_APP_NAME", "Greenscape Proposal Builder")
  vi.stubEnv("SLACK_BOT_TOKEN", "slack-token")
  vi.stubEnv("SLACK_SIGNING_SECRET", "slack-secret")
  vi.stubEnv("SLACK_REVIEW_CHANNEL_ID", "C123")
}

describe("openRouterProposalAiPlugin.auditMeasurements", () => {
  it("requests measurement audit JSON with OpenRouter fallback models", async () => {
    vi.resetModules()
    stubEnv()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server error",
        text: async () => "first model failed",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  issues: [
                    {
                      sku: "PAVER-SF",
                      severity: "BLOCKING",
                      code: "NO_SCALE_REFERENCE",
                      message: "Confirm square footage from photos.",
                      modelSuggestedQuantity: null,
                      confidence: 0.4,
                      reason:
                        "No scale reference is visible in the supplied photos.",
                    },
                  ],
                  overallRisk: "HIGH",
                  summary: "One blocker requires measurement confirmation.",
                }),
              },
            },
          ],
        }),
      })

    vi.stubGlobal("fetch", fetchMock)

    const { openRouterProposalAiPlugin } = await import("./openrouter")

    const result = await openRouterProposalAiPlugin.auditMeasurements({
      lead: {
        name: "Avery Customer",
        email: "avery@example.com",
        phone: "555-0100",
        address: "123 Palm Lane",
        projectType: "Patio",
        budgetMinCents: 10_000_00,
        budgetMaxCents: 20_000_00,
        notes: "Customer wants a paver patio. Photos only, no dimensions.",
      },
      photoUrls: ["https://example.com/photo.jpg"],
      pricingCatalog: [
        {
          sku: "PAVER-SF",
          category: "hardscape",
          name: "Premium pavers",
          description: "Installed premium pavers",
          unit: "sf",
          unitPriceCents: 2_000,
        },
      ],
      draft: {
        executiveSummary:
          "Premium backyard patio proposal with pavers and site preparation.",
        customerMessage:
          "Thanks for trusting Greenscape Pro with your backyard transformation.",
        timeline: "4–6 weeks after material selection.",
        lineItems: [
          {
            sku: "PAVER-SF",
            quantity: 500,
            quantitySource: "AI_ESTIMATE",
            confidence: 0.9,
            notes: "Estimated from photos.",
          },
        ],
        assumptions: ["Paver patio size estimated from photos."],
        unknowns: ["Exact dimensions."],
        renderBrief: null,
        confidence: 0.9,
      },
    })

    expect(result.overallRisk).toBe("HIGH")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)

    expect(firstBody.model).toBe("first-model")
    expect(secondBody.model).toBe("fallback-model")
    expect(secondBody.response_format.json_schema.name).toBe(
      "measurement_audit"
    )
    expect(secondBody.messages[0].content).toContain(
      "Do not calculate prices or totals"
    )
    expect(secondBody.messages[0].content).toContain(
      "quantitySource USER or MANUAL_OVERRIDE must never receive NO_SCALE_REFERENCE"
    )
    expect(secondBody.messages[0].content).toContain(
      "Never emit NO_SCALE_REFERENCE for ea/count items"
    )
    expect(secondBody.messages[1].content[0].text).toContain("draftLineItems")
  })
})
