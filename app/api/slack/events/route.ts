import { after } from "next/server"
import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { env } from "@/lib/env"
import { reviseProposalFromSlackThread } from "@/lib/proposals/revise-proposal"
import { verifySlackSignature } from "@/lib/review/slack-signature"
import type { SlackMessageEvent } from "@/lib/review/types"

export const runtime = "nodejs"

type SlackEventsEnvelope = {
  type?: string
  challenge?: unknown
  event_id?: unknown
  event?: unknown
}

function toJsonValue(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input)
}

function parseSlackMessageEvent(input: unknown): SlackMessageEvent | null {
  if (!isRecord(input) || input.type !== "message") {
    return null
  }

  const channel = input.channel
  const ts = input.ts

  if (typeof channel !== "string" || typeof ts !== "string") {
    return null
  }

  return {
    type: "message",
    channel,
    ts,
    user: typeof input.user === "string" ? input.user : undefined,
    text: typeof input.text === "string" ? input.text : undefined,
    thread_ts:
      typeof input.thread_ts === "string" ? input.thread_ts : undefined,
    bot_id: typeof input.bot_id === "string" ? input.bot_id : undefined,
    subtype: typeof input.subtype === "string" ? input.subtype : undefined,
  }
}

function isBotMessage(event: SlackMessageEvent): boolean {
  return Boolean(event.bot_id || event.subtype === "bot_message")
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

  let payload: SlackEventsEnvelope
  try {
    payload = JSON.parse(rawBody) as SlackEventsEnvelope
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (payload.type === "url_verification") {
    return new Response(
      typeof payload.challenge === "string" ? payload.challenge : "",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    )
  }

  const event = parseSlackMessageEvent(payload.event ?? payload)

  if (!event || isBotMessage(event) || !event.thread_ts) {
    return Response.json({ ok: true })
  }

  const instructions = event.text?.trim()
  if (!instructions) {
    return Response.json({ ok: true })
  }

  await prisma.integrationEvent.create({
    data: {
      provider: "slack",
      eventType: event.type,
      externalId:
        typeof payload.event_id === "string" ? payload.event_id : event.ts,
      payload: toJsonValue(payload),
      status: "RECEIVED",
    },
  })

  after(async () => {
    try {
      await reviseProposalFromSlackThread({
        slackChannelId: event.channel,
        slackThreadTs: event.thread_ts as string,
        slackUserId: event.user,
        instructions,
      })
    } catch (error) {
      console.error("Slack threaded proposal revision failed", error)
    }
  })

  return Response.json({ ok: true })
}
