import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const prisma = {
    proposalReview: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    proposal: {
      update: vi.fn(),
    },
    lead: {
      update: vi.fn(),
    },
    deliveryLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  return {
    prisma,
    deliver: vi.fn(),
    recordProposalDelivered: vi.fn(),
    postThreadMessage: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "https://example.test",
    DELIVERY_PLUGIN: "slack",
    SLACK_DELIVERY_CHANNEL_ID: "C-delivery",
  },
}))
vi.mock("@/lib/delivery", () => ({
  delivery: { deliver: mocks.deliver },
}))
vi.mock("@/lib/crm", () => ({
  crm: { recordProposalDelivered: mocks.recordProposalDelivered },
}))
vi.mock("@/lib/review", () => ({
  review: { postThreadMessage: mocks.postThreadMessage },
}))

describe("completeProposalReview", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.prisma.$transaction.mockResolvedValue([])
    mocks.prisma.proposalReview.update.mockReturnValue({ query: "review" })
    mocks.prisma.proposal.update.mockReturnValue({ query: "proposal" })
    mocks.prisma.lead.update.mockReturnValue({ query: "lead" })
    mocks.prisma.deliveryLog.create.mockReturnValue({ query: "delivery-log" })
    mocks.deliver.mockResolvedValue({
      provider: "slack",
      channel: "slack",
      messageId: "message-123",
    })
    mocks.recordProposalDelivered.mockResolvedValue(undefined)
    mocks.postThreadMessage.mockResolvedValue(undefined)
  })

  it("approves and delivers proposals even when the current version has blocking guardrails", async () => {
    mocks.prisma.proposalReview.findFirst.mockResolvedValue({
      id: "review-1",
      proposalId: "proposal-1",
      versionId: "version-1",
      status: "REQUESTED",
      slackChannelId: "C-review",
      slackThreadTs: "123.456",
      proposal: {
        id: "proposal-1",
        leadId: "lead-1",
        publicToken: "public-token",
        currentVersionId: "version-1",
        lead: {
          id: "lead-1",
          name: "Julio Martinez",
          email: "julio@example.test",
          projectType: "Outdoor kitchen",
        },
      },
      version: {
        id: "version-1",
        totalCents: 52_000_00,
        guardrails: [
          {
            id: "guardrail-1",
            severity: "BLOCKING",
            code: "MEASUREMENT_NEEDS_CONFIRMATION",
            message: "Confirm patio measurements.",
          },
        ],
      },
    })

    const { completeProposalReview } = await import("./complete-review")

    await expect(
      completeProposalReview({
        proposalId: "proposal-1",
        versionId: "version-1",
        decision: "approved",
        decidedBy: "U123",
      })
    ).resolves.toBeUndefined()

    expect(mocks.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "slack",
        to: "C-delivery",
        proposalUrl: "https://example.test/p/public-token",
      })
    )
    expect(mocks.prisma.deliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED" }),
      })
    )
    expect(mocks.postThreadMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Approved by <@U123>. Proposal delivered to C-delivery.",
      })
    )
  })
})
