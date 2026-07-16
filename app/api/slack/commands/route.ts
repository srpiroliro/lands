import { env } from "@/lib/env"
import { verifySlackSignature } from "@/lib/review/slack-signature"

export const runtime = "nodejs"

function proposalBuilderUrl(): string {
  const url = new URL(env.APP_BASE_URL)
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url.toString()
}

function escapeSlackLinkTarget(url: string): string {
  return url
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const isVerified = verifySlackSignature({
    signingSecret: env.SLACK_SIGNING_SECRET,
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
  })

  if (!isVerified) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 }
    )
  }

  const form = new URLSearchParams(rawBody)
  const command = form.get("command")?.trim() || "/proposal"
  const text = form.get("text")?.trim() ?? ""

  if (text) {
    return Response.json({
      response_type: "ephemeral",
      text: `Run ${command} without text to get the proposal builder link.`,
    })
  }

  const url = proposalBuilderUrl()

  return Response.json({
    response_type: "ephemeral",
    text: `Create a proposal: ${url}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${escapeSlackLinkTarget(url)}|Open the proposal builder> to queue a new proposal.`,
        },
      },
    ],
  })
}
