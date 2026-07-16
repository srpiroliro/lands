import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  prisma: {
    lead: { update: vi.fn() },
    proposal: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  upsertLead: vi.fn(),
  attachProposalLink: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/env", () => ({
  env: { APP_BASE_URL: "https://proposals.example.test" },
}))
vi.mock("@/lib/crm", () => ({
  crm: {
    upsertLead: mocks.upsertLead,
    attachProposalLink: mocks.attachProposalLink,
  },
}))
vi.mock("@/lib/proposal", () => ({ proposalAi: {} }))
vi.mock("@/lib/review", () => ({ review: {} }))

describe("finalizeProposalCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.lead.update.mockReturnValue({ query: "lead" })
    mocks.prisma.proposal.update.mockReturnValue({ query: "proposal" })
    mocks.prisma.$transaction.mockResolvedValue([])
    mocks.upsertLead.mockResolvedValue(undefined)
    mocks.attachProposalLink.mockResolvedValue(undefined)
  })

  it("idempotently completes statuses and CRM synchronization", async () => {
    const { finalizeProposalCreation } = await import("./create-proposal")

    await finalizeProposalCreation({
      proposalId: "proposal-1",
      leadId: "lead-1",
      leadName: "Avery Stone",
      leadEmail: "avery@example.test",
      leadPhone: null,
      blocked: false,
    })

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { query: "lead" },
      { query: "proposal" },
    ])
    expect(mocks.prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { status: "PENDING_REVIEW" },
    })
    expect(mocks.prisma.proposal.update).toHaveBeenCalledWith({
      where: { id: "proposal-1" },
      data: { status: "PENDING_REVIEW" },
    })
    expect(mocks.upsertLead).toHaveBeenCalledWith({
      leadId: "lead-1",
      name: "Avery Stone",
      email: "avery@example.test",
      phone: null,
    })
    expect(mocks.attachProposalLink).toHaveBeenCalledWith({
      leadId: "lead-1",
      proposalId: "proposal-1",
      url: "https://proposals.example.test/proposals/proposal-1",
    })
  })
})
