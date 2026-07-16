import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verifySlackSignature: vi.fn(),
}))

vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "https://proposals.example.test/base?tenant=a#form",
    SLACK_SIGNING_SECRET: "slack-secret",
  },
}))
vi.mock("@/lib/review/slack-signature", () => ({
  verifySlackSignature: mocks.verifySlackSignature,
}))

function slackRequest(body: string): Request {
  return new Request("https://proposals.example.test/api/slack/commands", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": "1234567890",
      "x-slack-signature": "v0=signature",
    },
  })
}

describe("Slack proposal command", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifySlackSignature.mockReturnValue(true)
  })

  it("returns an ephemeral proposal builder link when text is empty", async () => {
    const rawBody = "command=%2Fproposal&text=&user_id=U123"
    const { POST } = await import("./route")

    const response = await POST(slackRequest(rawBody))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.verifySlackSignature).toHaveBeenCalledWith({
      signingSecret: "slack-secret",
      rawBody,
      timestamp: "1234567890",
      signature: "v0=signature",
    })
    expect(payload).toMatchObject({
      response_type: "ephemeral",
      text: "Create a proposal: https://proposals.example.test/base/",
    })
    expect(JSON.stringify(payload.blocks)).toContain(
      "<https://proposals.example.test/base/|Open the proposal builder>"
    )
  })

  it("explains that the command must be run without text", async () => {
    const { POST } = await import("./route")

    const response = await POST(
      slackRequest("command=%2Fproposal&text=create+one")
    )

    await expect(response.json()).resolves.toEqual({
      response_type: "ephemeral",
      text: "Run /proposal without text to get the proposal builder link.",
    })
  })

  it("rejects requests with an invalid Slack signature", async () => {
    mocks.verifySlackSignature.mockReturnValue(false)
    const { POST } = await import("./route")

    const response = await POST(slackRequest("command=%2Fproposal&text="))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_signature",
    })
  })
})
