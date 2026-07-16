import { describe, expect, it } from "vitest"

import { buildProposalReviewMessage } from "@/lib/review/plugins/slack/blocks"

describe("Slack proposal review message", () => {
  it("shows proposal details without exposing guardrail details", () => {
    const message = buildProposalReviewMessage({
      proposalId: "proposal_123",
      versionId: "version_456",
      internalProposalUrl: "https://example.test/proposals/proposal_123",
      leadName: "A&B <Home>",
      projectType: "Patio",
      totalCents: 28_000_00,
      description:
        "Replace the existing patio with premium pavers & add a shaded seating area.",
      timeline: "4–6 weeks after material selection",
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

    expect(message.summaryText).toContain(
      "Proposal A&amp;B &lt;Home&gt; — Patio completed."
    )
    expect(message.summaryText).not.toContain("<Home>")
    expect(message.summaryText).toContain("Patio · $28,000")
    expect(message.summaryText).toContain("4–6 weeks after material selection")

    const payload = JSON.stringify({
      text: message.summaryText,
      blocks: message.blocks,
    })

    expect(message.blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "A&B <Home> — Patio" },
    })
    expect(payload).toContain("Open proposal")
    expect(payload).toContain("*Proposal*\\nA&amp;B &lt;Home&gt; — Patio")
    expect(payload).toContain("*Lead*\\nA&amp;B &lt;Home&gt;")
    expect(payload).toContain("*Project type*\\nPatio")
    expect(payload).toContain("*Total*\\n$28,000")
    expect(payload).toContain("*Timeline*\\n4–6 weeks after material selection")
    expect(payload).toContain(
      "*Description*\\nReplace the existing patio with premium pavers &amp; add a shaded seating area."
    )
    expect(payload).toContain("proposal_approve")
    expect(payload).toContain("proposal_reject")
    expect(payload.toLowerCase()).not.toContain("warning")
    expect(payload.toLowerCase()).not.toContain("blocker")
    expect(payload).not.toContain("RENDER_REQUIRED")
    expect(payload).not.toContain("UNKNOWN_SKU")
    expect(payload).not.toContain("Needs render")
    expect(payload).not.toContain("Missing")
  })

  it("truncates long proposal names without splitting emoji surrogates", () => {
    const message = buildProposalReviewMessage({
      proposalId: "proposal_123",
      versionId: "version_456",
      internalProposalUrl: "https://example.test/proposals/proposal_123",
      leadName: `${"A".repeat(148)}😀`,
      projectType: "Patio",
      totalCents: 28_000_00,
      description: "Premium paver patio and shaded seating area.",
      timeline: "4–6 weeks",
      blocked: false,
      issues: [],
    })
    const header = message.blocks[0] as {
      text: { text: string }
    }

    expect(header.text.text).toBe(`${"A".repeat(148)}😀…`)
    expect(header.text.text).toBe(header.text.text.toWellFormed())
  })
})
