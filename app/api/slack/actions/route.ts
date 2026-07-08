import { after } from "next/server"

import { env } from "@/lib/env"
import { completeProposalReview } from "@/lib/proposals/complete-review"
import { parseSlackActionPayload } from "@/lib/review/schema"
import { verifySlackSignature } from "@/lib/review/slack-signature"

export const runtime = "nodejs"

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

  const encodedPayload = new URLSearchParams(rawBody).get("payload")
  if (!encodedPayload) {
    return Response.json(
      { ok: false, error: "missing_payload" },
      { status: 400 }
    )
  }

  try {
    const action = parseSlackActionPayload(encodedPayload)
    const decision =
      action.actionId === "proposal_approve" ? "approved" : "rejected"

    after(async () => {
      try {
        await completeProposalReview({
          proposalId: action.proposalId,
          versionId: action.versionId,
          decision,
          decidedBy: action.userId,
        })
      } catch (error) {
        console.error("Slack proposal review completion failed", error)
      }
    })

    return Response.json({ ok: true, decision })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack action failed"
    return Response.json({ ok: false, error: message })
  }
}
