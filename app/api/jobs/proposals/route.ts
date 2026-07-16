import crypto from "node:crypto"

import { dispatchProposalQueue } from "@/lib/engine/proposal-queue"
import { env } from "@/lib/env"

export const runtime = "nodejs"
export const maxDuration = 300

function secretsMatch(value: string | null, expected: string): boolean {
  if (!value) return false
  const actualBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(`Bearer ${expected}`)
  if (actualBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return Response.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 }
    )
  }

  if (!secretsMatch(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const result = await dispatchProposalQueue()
  return Response.json({ ok: true, ...result })
}
