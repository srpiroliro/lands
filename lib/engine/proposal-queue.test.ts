import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  prisma: {
    lead: { create: vi.fn() },
    photo: { createMany: vi.fn() },
    integrationEvent: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  randomUUID: vi.fn(),
  saveLeadPhoto: vi.fn(),
  createProposalForLead: vi.fn(),
  postChannelMessage: vi.fn(),
}))

vi.mock("node:crypto", () => ({
  default: { randomUUID: mocks.randomUUID },
}))
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }))
vi.mock("@/lib/media", () => ({
  media: { saveLeadPhoto: mocks.saveLeadPhoto },
}))
vi.mock("@/lib/engine/create-proposal", () => ({
  createProposalForLead: mocks.createProposalForLead,
}))
vi.mock("@/lib/review", () => ({
  review: { postChannelMessage: mocks.postChannelMessage },
}))

const leadInput = {
  name: "Avery Stone",
  email: "avery@example.test",
  phone: null,
  address: "123 Main Street",
  projectType: "Patio or pavers",
  budgetMinCents: 2_500_000,
  budgetMaxCents: 4_500_000,
  notes: "Replace the patio pavers and improve drainage along the house.",
}

function sitePhoto(name = "site.webp") {
  return new File(["photo"], name, { type: "image/webp" })
}

describe("proposal generation queue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.randomUUID.mockReturnValueOnce("lead-1").mockReturnValueOnce("job-1")
    mocks.prisma.lead.create.mockReturnValue({ query: "lead" })
    mocks.prisma.integrationEvent.create.mockReturnValue({ query: "job" })
    mocks.prisma.$transaction.mockResolvedValue([])
    mocks.prisma.integrationEvent.update.mockResolvedValue({})
    mocks.prisma.integrationEvent.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.integrationEvent.findUnique.mockResolvedValue({
      externalId: "lead-1",
    })
    mocks.prisma.photo.createMany.mockResolvedValue({ count: 1 })
    mocks.saveLeadPhoto.mockResolvedValue({
      url: "https://blob.example.test/site.webp",
      downloadUrl: "https://blob.example.test/site.webp?download=1",
      pathname: "leads/lead-1/site.webp",
      contentType: "image/webp",
      sizeBytes: 5,
    })
    mocks.createProposalForLead.mockResolvedValue({
      proposalId: "proposal-1",
      versionId: "version-1",
      blocked: false,
    })
    mocks.postChannelMessage.mockResolvedValue(undefined)
  })

  it("persists a queued lead without waiting for photo uploads", async () => {
    const { queueProposal } = await import("./proposal-queue")

    await expect(queueProposal(leadInput)).resolves.toEqual({ jobId: "job-1" })

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { query: "lead" },
      { query: "job" },
    ])
    expect(mocks.prisma.integrationEvent.create).toHaveBeenCalledWith({
      data: {
        id: "job-1",
        provider: "proposal-builder",
        eventType: "proposal-generation",
        externalId: "lead-1",
        payload: { leadId: "lead-1" },
        status: "QUEUED",
      },
    })
    expect(mocks.saveLeadPhoto).not.toHaveBeenCalled()
    expect(mocks.createProposalForLead).not.toHaveBeenCalled()
  })

  it("uploads photos and generates only after claiming the queued job", async () => {
    const { processQueuedProposal } = await import("./proposal-queue")
    const photos = [sitePhoto()]

    await expect(processQueuedProposal("job-1", photos)).resolves.toEqual({
      proposalId: "proposal-1",
      versionId: "version-1",
      blocked: false,
    })

    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        provider: "proposal-builder",
        eventType: "proposal-generation",
        status: "QUEUED",
      },
      data: { status: "PROCESSING", error: null },
    })
    expect(mocks.saveLeadPhoto).toHaveBeenCalledWith({
      leadId: "lead-1",
      file: photos[0],
    })
    expect(mocks.prisma.photo.createMany).toHaveBeenCalledOnce()
    expect(mocks.createProposalForLead).toHaveBeenCalledWith("lead-1")
    expect(mocks.prisma.integrationEvent.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "SUCCEEDED", error: null },
    })
  })

  it("does not run the background work when another worker claimed the job", async () => {
    mocks.prisma.integrationEvent.updateMany.mockResolvedValueOnce({ count: 0 })
    const { processQueuedProposal } = await import("./proposal-queue")

    await expect(
      processQueuedProposal("job-1", [sitePhoto()])
    ).resolves.toBeNull()

    expect(mocks.saveLeadPhoto).not.toHaveBeenCalled()
    expect(mocks.createProposalForLead).not.toHaveBeenCalled()
  })

  it("records and reports failures before a job can be claimed", async () => {
    mocks.prisma.integrationEvent.findUnique.mockRejectedValueOnce(
      new Error("database unavailable")
    )
    const { processQueuedProposal } = await import("./proposal-queue")

    await expect(processQueuedProposal("job-1", [sitePhoto()])).rejects.toThrow(
      "database unavailable"
    )

    expect(mocks.prisma.integrationEvent.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "database unavailable" },
    })
    expect(mocks.postChannelMessage).toHaveBeenCalledWith({
      text: expect.stringContaining("queue job job-1"),
    })
  })

  it("records and reports background failures", async () => {
    const failure = new Error("AI unavailable")
    mocks.createProposalForLead.mockRejectedValueOnce(failure)
    const { processQueuedProposal } = await import("./proposal-queue")

    await expect(processQueuedProposal("job-1", [sitePhoto()])).rejects.toThrow(
      "AI unavailable"
    )

    expect(mocks.prisma.integrationEvent.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "AI unavailable" },
    })
    expect(mocks.postChannelMessage).toHaveBeenCalledWith({
      text: expect.stringContaining("queue job job-1"),
    })
  })
})
