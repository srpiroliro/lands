import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addReaction: vi.fn(),
  postMessage: vi.fn(),
}))

vi.mock("@slack/web-api", () => ({
  WebClient: class {
    reactions = { add: mocks.addReaction }
    chat = { postMessage: mocks.postMessage }
  },
}))
vi.mock("@/lib/env", () => ({
  env: {
    SLACK_BOT_TOKEN: "xoxb-test",
    SLACK_REVIEW_CHANNEL_ID: "C-review",
  },
}))

describe("Slack review plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.addReaction.mockResolvedValue({ ok: true })
    mocks.postMessage.mockResolvedValue({ ok: true, ts: "123.456" })
  })

  it("reacts to the received user message", async () => {
    const { slackReviewPlugin } = await import("./slack")

    await slackReviewPlugin.acknowledgeThreadMessage({
      slackChannelId: "C-review",
      slackThreadTs: "100.000",
      slackMessageTs: "101.000",
    })

    expect(mocks.addReaction).toHaveBeenCalledWith({
      channel: "C-review",
      timestamp: "101.000",
      name: "eyes",
    })
    expect(mocks.postMessage).not.toHaveBeenCalled()
  })

  it("posts a received message in the same thread when reactions are unavailable", async () => {
    const { slackReviewPlugin } = await import("./slack")
    mocks.addReaction.mockRejectedValue(new Error("missing_scope"))

    await slackReviewPlugin.acknowledgeThreadMessage({
      slackChannelId: "C-review",
      slackThreadTs: "100.000",
      slackMessageTs: "101.000",
    })

    expect(mocks.postMessage).toHaveBeenCalledWith({
      channel: "C-review",
      thread_ts: "100.000",
      text: "Received — I’m working on it. 👀",
    })
  })
})
