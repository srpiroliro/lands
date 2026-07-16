import { describe, expect, it } from "vitest"

import { buildProposalReviewMessage } from "@/lib/review/plugins/slack/blocks"

describe("Slack proposal review message", () => {
  it("announces completion without exposing guardrail details", () => {
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

    expect(message.summaryText).toBe("Proposal completed.")

    const payload = JSON.stringify({
      text: message.summaryText,
      blocks: message.blocks,
    })

    expect(payload).toContain("Proposal completed")
    expect(payload).toContain("Open proposal")
    expect(payload).toContain("proposal_approve")
    expect(payload).toContain("proposal_reject")
    expect(payload.toLowerCase()).not.toContain("warning")
    expect(payload.toLowerCase()).not.toContain("blocker")
    expect(payload).not.toContain("RENDER_REQUIRED")
    expect(payload).not.toContain("UNKNOWN_SKU")
    expect(payload).not.toContain("Needs render")
    expect(payload).not.toContain("Missing")
    expect(payload).not.toContain("$28,000")
  })
})
