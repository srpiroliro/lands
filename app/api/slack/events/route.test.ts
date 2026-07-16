import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  integrationEventCreate: vi.fn(),
  verifySlackSignature: vi.fn(),
  acknowledgeThreadMessage: vi.fn(),
  reviseProposalFromSlackThread: vi.fn(),
}))

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => {
    mocks.afterCallbacks.push(callback)
  }),
}))
vi.mock("@/lib/db", () => ({
  prisma: { integrationEvent: { create: mocks.integrationEventCreate } },
}))
vi.mock("@/lib/env", () => ({
  env: { SLACK_SIGNING_SECRET: "signing-secret" },
}))
vi.mock("@/lib/review/slack-signature", () => ({
  verifySlackSignature: mocks.verifySlackSignature,
}))
vi.mock("@/lib/review", () => ({
  review: { acknowledgeThreadMessage: mocks.acknowledgeThreadMessage },
}))
vi.mock("@/lib/engine/revise-proposal", () => ({
  reviseProposalFromSlackThread: mocks.reviseProposalFromSlackThread,
}))

function slackEventRequest(): Request {
  return new Request("https://example.test/api/slack/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": "1234567890",
      "x-slack-signature": "v0=test",
    },
    body: JSON.stringify({
      type: "event_callback",
      event_id: "Ev123",
      event: {
        type: "message",
        channel: "C-review",
        user: "U123",
        text: "Make the patio larger",
        ts: "101.000",
        thread_ts: "100.000",
      },
    }),
  })
}

describe("Slack events route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.afterCallbacks.length = 0
    mocks.verifySlackSignature.mockReturnValue(true)
    mocks.integrationEventCreate.mockResolvedValue({ id: "event-1" })
    mocks.acknowledgeThreadMessage.mockResolvedValue(undefined)
    mocks.reviseProposalFromSlackThread.mockResolvedValue(undefined)
  })

  it("acknowledges the exact thread message before starting its revision", async () => {
    const { POST } = await import("./route")

    const response = await POST(slackEventRequest())
    expect(response.status).toBe(200)
    expect(mocks.afterCallbacks).toHaveLength(1)

    await mocks.afterCallbacks[0]!()

    expect(mocks.acknowledgeThreadMessage).toHaveBeenCalledWith({
      slackChannelId: "C-review",
      slackThreadTs: "100.000",
      slackMessageTs: "101.000",
    })
    expect(mocks.reviseProposalFromSlackThread).toHaveBeenCalledWith({
      slackChannelId: "C-review",
      slackThreadTs: "100.000",
      slackUserId: "U123",
      instructions: "Make the patio larger",
    })
    expect(
      mocks.acknowledgeThreadMessage.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.reviseProposalFromSlackThread.mock.invocationCallOrder[0]!
    )
  })
})
