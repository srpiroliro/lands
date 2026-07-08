import { describe, expect, it, vi } from "vitest"

function stubRequiredEnv() {
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000")
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@example.com:5432/db")
  vi.stubEnv("DIRECT_URL", "postgres://user:pass@example.com:5432/db")
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token")
  vi.stubEnv("OPENROUTER_API_KEY", "openrouter-token")
  vi.stubEnv("SLACK_BOT_TOKEN", "slack-token")
  vi.stubEnv("SLACK_SIGNING_SECRET", "slack-secret")
  vi.stubEnv("SLACK_REVIEW_CHANNEL_ID", "C-review")
}

describe("delivery environment configuration", () => {
  it("accepts Slack delivery with a dedicated delivery channel", async () => {
    vi.resetModules()
    stubRequiredEnv()
    vi.stubEnv("DELIVERY_PLUGIN", "slack")
    vi.stubEnv("SLACK_DELIVERY_CHANNEL_ID", "C0BG0QAM8F3")

    const { env } = await import("@/lib/env")

    expect(env.DELIVERY_PLUGIN).toBe("slack")
    expect(env.SLACK_DELIVERY_CHANNEL_ID).toBe("C0BG0QAM8F3")
  })
})
