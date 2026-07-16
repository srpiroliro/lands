import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  env: { CRON_SECRET: "cron-secret" as string | undefined },
  dispatchProposalQueue: vi.fn(),
}))

vi.mock("@/lib/env", () => ({ env: mocks.env }))
vi.mock("@/lib/engine/proposal-queue", () => ({
  dispatchProposalQueue: mocks.dispatchProposalQueue,
}))

function cronRequest(authorization?: string): Request {
  return new Request("https://proposals.example.test/api/jobs/proposals", {
    headers: authorization ? { authorization } : undefined,
  })
}

describe("proposal queue cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.CRON_SECRET = "cron-secret"
    mocks.dispatchProposalQueue.mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failed: 0,
    })
  })

  it("dispatches queued proposals for an authorized scheduler", async () => {
    const { GET } = await import("./route")

    const response = await GET(cronRequest("Bearer cron-secret"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      processed: 2,
      succeeded: 2,
      failed: 0,
    })
    expect(mocks.dispatchProposalQueue).toHaveBeenCalledOnce()
  })

  it("rejects requests without the cron authorization secret", async () => {
    const { GET } = await import("./route")

    const response = await GET(cronRequest())

    expect(response.status).toBe(401)
    expect(mocks.dispatchProposalQueue).not.toHaveBeenCalled()
  })

  it("fails closed when cron processing is not configured", async () => {
    mocks.env.CRON_SECRET = undefined
    const { GET } = await import("./route")

    const response = await GET(cronRequest("Bearer cron-secret"))

    expect(response.status).toBe(503)
    expect(mocks.dispatchProposalQueue).not.toHaveBeenCalled()
  })
})
