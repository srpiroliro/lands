import crypto from "node:crypto"

export function verifySlackSignature(input: {
  signingSecret: string
  rawBody: string
  timestamp: string | null
  signature: string | null
  nowSeconds?: number
}): boolean {
  if (!input.timestamp || !input.signature) return false

  const requestTimestamp = Number(input.timestamp)
  if (!Number.isFinite(requestTimestamp)) return false

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - requestTimestamp) > 60 * 5) return false

  const base = `v0:${input.timestamp}:${input.rawBody}`
  const digest = crypto.createHmac("sha256", input.signingSecret).update(base).digest("hex")
  const computed = `v0=${digest}`

  if (computed.length !== input.signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(input.signature, "utf8"))
}
