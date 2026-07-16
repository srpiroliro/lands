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
      findMany: vi.fn(),
    },
    proposal: { findFirst: vi.fn() },
    guardrailIssue: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  randomUUID: vi.fn(),
  saveLeadPhoto: vi.fn(),
  createProposalForLead: vi.fn(),
  finalizeProposalCreation: vi.fn(),
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
  finalizeProposalCreation: mocks.finalizeProposalCreation,
}))
vi.mock("@/lib/review", () => ({
  review: { postChannelMessage: mocks.postChannelMessage },
}))

function intakeInput() {
  return {
    name: "Avery Stone",
    email: "avery@example.test",
    phone: null,
    address: "123 Main Street",
    projectType: "Patio or pavers",
    budgetMinCents: 2_500_000,
    budgetMaxCents: 4_500_000,
    notes: "Replace the patio pavers and improve drainage along the house.",
    photos: [new File(["photo"], "site.webp", { type: "image/webp" })],
  }
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
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([])
    mocks.prisma.proposal.findFirst.mockResolvedValue(null)
    mocks.prisma.guardrailIssue.count.mockResolvedValue(0)
    mocks.prisma.photo.createMany.mockResolvedValue({ count: 1 })
    mocks.saveLeadPhoto.mockResolvedValue({
      url: "https://blob.example.test/site.webp",
      downloadUrl: "https://blob.example.test/site.webp?download=1",
      pathname: "leads/lead-1/site.webp",
      contentType: "image/webp",
      sizeBytes: 5,
    })
    mocks.finalizeProposalCreation.mockResolvedValue(undefined)
    mocks.createProposalForLead.mockResolvedValue({
      proposalId: "proposal-1",
      versionId: "version-1",
      blocked: false,
    })
    mocks.postChannelMessage.mockResolvedValue(undefined)
  })

  it("persists the intake and photos before marking the job queued", async () => {
    const { queueProposal } = await import("./proposal-queue")

    await expect(queueProposal(intakeInput())).resolves.toEqual({
      jobId: "job-1",
    })

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith([
      { query: "lead" },
      { query: "job" },
    ])
    expect(mocks.prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "lead-1",
        email: "avery@example.test",
        status: "DRAFTING",
      }),
    })
    expect(mocks.prisma.integrationEvent.create).toHaveBeenCalledWith({
      data: {
        id: "job-1",
        provider: "proposal-builder",
        eventType: "proposal-generation",
        externalId: "lead-1",
        payload: { leadId: "lead-1" },
        status: "UPLOADING",
      },
    })
    expect(mocks.saveLeadPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1" })
    )
    expect(mocks.prisma.photo.createMany).toHaveBeenCalledOnce()
    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenLastCalledWith({
      where: { id: "job-1", status: "UPLOADING" },
      data: { status: "QUEUED", error: null },
    })
  })

  it("persists successful uploads when another photo fails", async () => {
    const uploadFailure = new Error("second upload failed")
    const input = intakeInput()
    input.photos.push(
      new File(["photo-2"], "site-2.webp", { type: "image/webp" })
    )
    mocks.saveLeadPhoto
      .mockResolvedValueOnce({
        url: "https://blob.example.test/site.webp",
        downloadUrl: undefined,
        pathname: "leads/lead-1/site.webp",
        contentType: "image/webp",
        sizeBytes: 5,
      })
      .mockRejectedValueOnce(uploadFailure)
    const { queueProposal } = await import("./proposal-queue")

    await expect(queueProposal(input)).rejects.toThrow("second upload failed")

    expect(mocks.prisma.photo.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ pathname: "leads/lead-1/site.webp" })],
    })
    expect(mocks.prisma.integrationEvent.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "second upload failed" },
    })
  })

  it("claims a queued job before generating and records success", async () => {
    const { processQueuedProposal } = await import("./proposal-queue")

    await expect(processQueuedProposal("job-1")).resolves.toEqual({
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
      data: {
        status: "PROCESSING",
        error: expect.stringMatching(/^lease:/),
      },
    })
    expect(mocks.createProposalForLead).toHaveBeenCalledWith("lead-1")
    expect(mocks.prisma.integrationEvent.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: { status: "SUCCEEDED", error: null },
    })
  })

  it("reclaims an expired processing lease when no proposal was persisted", async () => {
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "job-1",
        externalId: "lead-1",
        status: "PROCESSING",
        error: "lease:2000-01-01T00:00:00.000Z",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ])
    const { dispatchProposalQueue } = await import("./proposal-queue")

    await expect(dispatchProposalQueue(1)).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
    })

    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: "PROCESSING",
        error: expect.stringMatching(/^lease:/),
      },
      data: { status: "QUEUED", error: null },
    })
    expect(mocks.createProposalForLead).toHaveBeenCalledWith("lead-1")
  })

  it("lets only one dispatcher claim an expired recovery lease", async () => {
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "job-1",
        externalId: "lead-1",
        status: "PROCESSING",
        error: "lease:2000-01-01T00:00:00.000Z",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ])
    mocks.prisma.integrationEvent.updateMany.mockResolvedValueOnce({ count: 0 })
    const { dispatchProposalQueue } = await import("./proposal-queue")

    await expect(dispatchProposalQueue(1)).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
    })

    expect(mocks.prisma.proposal.findFirst).not.toHaveBeenCalled()
    expect(mocks.finalizeProposalCreation).not.toHaveBeenCalled()
  })

  it("fails upload jobs that never reached the queue", async () => {
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "job-1",
        externalId: "lead-1",
        status: "UPLOADING",
        error: null,
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ])
    const { dispatchProposalQueue } = await import("./proposal-queue")

    await expect(dispatchProposalQueue(1)).resolves.toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
    })

    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenLastCalledWith({
      where: { id: "job-1", status: "UPLOADING" },
      data: {
        status: "FAILED",
        error: "upload did not finish before its lease expired",
      },
    })
    expect(mocks.postChannelMessage).toHaveBeenCalledOnce()
  })

  it("finishes status and CRM synchronization before recovering success", async () => {
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "job-1",
        externalId: "lead-1",
        status: "PROCESSING",
        error: "lease:2000-01-01T00:00:00.000Z",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ])
    mocks.prisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      currentVersionId: "version-1",
      lead: {
        id: "lead-1",
        name: "Avery Stone",
        email: "avery@example.test",
        phone: null,
      },
      reviews: [{ id: "review-1" }],
    })
    mocks.prisma.guardrailIssue.count.mockResolvedValue(1)
    const { dispatchProposalQueue } = await import("./proposal-queue")

    await expect(dispatchProposalQueue(1)).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
    })

    expect(mocks.finalizeProposalCreation).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      leadId: "lead-1",
      leadName: "Avery Stone",
      leadEmail: "avery@example.test",
      leadPhone: null,
      blocked: true,
    })
    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "job-1",
        status: "PROCESSING",
        error: expect.stringMatching(/^lease:/),
      },
      data: { status: "SUCCEEDED", error: null },
    })
  })

  it("fails stale partial proposals instead of creating duplicates", async () => {
    mocks.prisma.integrationEvent.findMany.mockResolvedValue([
      {
        id: "job-1",
        externalId: "lead-1",
        status: "PROCESSING",
        error: "lease:2000-01-01T00:00:00.000Z",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ])
    mocks.prisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      currentVersionId: "version-1",
      reviews: [],
    })
    const { dispatchProposalQueue } = await import("./proposal-queue")

    await expect(dispatchProposalQueue(1)).resolves.toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
    })

    expect(mocks.createProposalForLead).not.toHaveBeenCalled()
    expect(mocks.prisma.integrationEvent.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "job-1",
        status: "PROCESSING",
        error: expect.stringMatching(/^lease:/),
      },
      data: {
        status: "FAILED",
        error: expect.stringContaining("Manual recovery is required"),
      },
    })
    expect(mocks.postChannelMessage).toHaveBeenCalledOnce()
  })

  it("records and reports background generation failures", async () => {
    const failure = new Error("AI unavailable")
    mocks.createProposalForLead.mockRejectedValueOnce(failure)
    const { processQueuedProposal } = await import("./proposal-queue")

    await expect(processQueuedProposal("job-1")).rejects.toThrow(
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
