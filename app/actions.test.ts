import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
  queueProposal: vi.fn(),
  processQueuedProposal: vi.fn(),
  after: vi.fn((callback: () => unknown) => {
    mocks.afterCallbacks.push(callback)
  }),
}))

vi.mock("next/server", () => ({ after: mocks.after }))
vi.mock("@/lib/engine/proposal-queue", () => ({
  queueProposal: mocks.queueProposal,
  processQueuedProposal: mocks.processQueuedProposal,
}))

function validProposalForm(): FormData {
  const formData = new FormData()
  formData.set("name", "Avery Stone")
  formData.set("email", "avery@example.test")
  formData.set("phone", "555-0100")
  formData.set("address", "123 Main Street")
  formData.set("projectType", "Patio or pavers")
  formData.set("budgetMin", "25000")
  formData.set("budgetMax", "45000")
  formData.set(
    "notes",
    "Replace the patio pavers and improve drainage along the house."
  )
  formData.set(
    "photos",
    new File(["photo"], "site.webp", { type: "image/webp" })
  )
  return formData
}

describe("submitProposalIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.afterCallbacks.length = 0
    mocks.queueProposal.mockResolvedValue({ jobId: "job-1" })
    mocks.processQueuedProposal.mockResolvedValue({
      proposalId: "proposal-1",
      versionId: "version-1",
      blocked: false,
    })
  })

  it("acknowledges a valid intake before proposal generation runs", async () => {
    const { submitProposalIntake } = await import("./actions")

    const result = await submitProposalIntake(
      { ok: false, message: "" },
      validProposalForm()
    )

    expect(result).toEqual({
      ok: true,
      message:
        "Proposal added to the queue successfully. You can submit another while it generates; Slack will notify you when it is ready.",
    })
    expect(mocks.queueProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Avery Stone",
        email: "avery@example.test",
        budgetMinCents: 2_500_000,
        budgetMaxCents: 4_500_000,
      })
    )
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.processQueuedProposal).not.toHaveBeenCalled()

    const generate = mocks.afterCallbacks[0]
    expect(generate).toBeDefined()
    await generate?.()

    expect(mocks.processQueuedProposal).toHaveBeenCalledWith("job-1", [
      expect.any(File),
    ])
  })

  it("keeps the form state when durable queueing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.queueProposal.mockRejectedValueOnce(new Error("database offline"))
    const { submitProposalIntake } = await import("./actions")

    const result = await submitProposalIntake(
      { ok: false, message: "" },
      validProposalForm()
    )

    expect(result).toEqual({
      ok: false,
      message:
        "We could not queue the proposal. Your form is still available; please try again.",
    })
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.processQueuedProposal).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("returns validation errors without scheduling background work", async () => {
    const { submitProposalIntake } = await import("./actions")
    const formData = validProposalForm()
    formData.set("email", "not-an-email")

    const result = await submitProposalIntake(
      { ok: false, message: "" },
      formData
    )

    expect(result.ok).toBe(false)
    expect(result.errors?.email).toBeDefined()
    expect(mocks.after).not.toHaveBeenCalled()
  })
})
