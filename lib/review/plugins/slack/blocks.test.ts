import { describe, expect, it } from "vitest"

import { buildProposalReviewMessage } from "@/lib/review/plugins/slack/blocks"

describe("Slack proposal review message", () => {
  it("renders review message text, warnings, blockers, and escaped Slack blocks", () => {
    const message = buildProposalReviewMessage({
      proposalId: "proposal_123",
      versionId: "version_456",
      internalProposalUrl: "https://example.test/proposals/proposal_123",
      leadName: "A&B <Home>",
      projectType: "Patio",
      totalCents: 28_000_00,
      blocked: true,
      issues: [
        {
          severity: "WARNING",
          code: "RENDER_REQUIRED",
          message: "Needs render",
          metadata: { threshold: 30_000_00 },
        },
        {
          severity: "BLOCKING",
          code: "UNKNOWN_SKU",
          message: "Missing <sku> & details",
          metadata: { sku: "bad" },
        },
      ],
    })

    expect(message.summaryText).toBe(
      "Proposal blocked by guardrails: A&B <Home> — Patio ($28,000)"
    )
    expect(message.totalCents).toBe(28_000_00)
    expect(message.internalProposalUrl).toBe(
      "https://example.test/proposals/proposal_123"
    )
    expect(message.warnings).toEqual(["RENDER_REQUIRED: Needs render"])
    expect(message.blockers).toEqual(["UNKNOWN_SKU: Missing <sku> & details"])
    expect(JSON.stringify(message.blocks)).toContain("A&amp;B &lt;Home&gt;")
    expect(JSON.stringify(message.blocks)).toContain(
      "Missing &lt;sku&gt; &amp; details"
    )
  })
})
