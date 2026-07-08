export type DeliveryChannel = "email" | "sms" | "ghl" | "slack" | "webhook"

export type DeliveryInput = {
  channel: DeliveryChannel
  to: string
  subject?: string
  html?: string
  text: string
  proposalUrl: string
  idempotencyKey: string
}

export type DeliveryResult = {
  provider: "resend" | "sendgrid" | "ghl" | "slack" | "webhook"
  channel: DeliveryChannel
  messageId: string
}

export interface DeliveryPlugin {
  deliver(input: DeliveryInput): Promise<DeliveryResult>
}
