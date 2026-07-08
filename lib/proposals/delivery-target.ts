import type { DeliveryChannel } from "@/lib/delivery/types"

export type ApprovedProposalDeliveryPlugin = "resend" | "sendgrid" | "slack"

export type ApprovedProposalDeliveryTarget = {
  channel: DeliveryChannel
  recipient: string
  missingRecipientError: string | null
}

export function resolveApprovedProposalDeliveryTarget(input: {
  deliveryPlugin: ApprovedProposalDeliveryPlugin
  leadEmail: string
  slackDeliveryChannelId?: string
}): ApprovedProposalDeliveryTarget {
  if (input.deliveryPlugin === "slack") {
    const recipient = input.slackDeliveryChannelId?.trim() ?? ""

    return {
      channel: "slack",
      recipient: recipient || "missing-recipient",
      missingRecipientError: recipient
        ? null
        : "Delivery blocked because Slack delivery channel is missing",
    }
  }

  const recipient = input.leadEmail.trim()

  return {
    channel: "email",
    recipient: recipient || "missing-recipient",
    missingRecipientError: recipient
      ? null
      : "Delivery blocked because lead email is missing",
  }
}
