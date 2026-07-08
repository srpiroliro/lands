import { describe, expect, it } from "vitest"

import { resolveApprovedProposalDeliveryTarget } from "@/lib/proposals/delivery-target"

describe("resolveApprovedProposalDeliveryTarget", () => {
  it("uses the Slack delivery channel and does not require a lead email", () => {
    const target = resolveApprovedProposalDeliveryTarget({
      deliveryPlugin: "slack",
      leadEmail: "",
      slackDeliveryChannelId: "C0BG0QAM8F3",
    })

    expect(target).toEqual({
      channel: "slack",
      recipient: "C0BG0QAM8F3",
      missingRecipientError: null,
    })
  })

  it("uses the lead email for email delivery plugins", () => {
    const target = resolveApprovedProposalDeliveryTarget({
      deliveryPlugin: "resend",
      leadEmail: "  customer@example.com  ",
      slackDeliveryChannelId: "C0BG0QAM8F3",
    })

    expect(target).toEqual({
      channel: "email",
      recipient: "customer@example.com",
      missingRecipientError: null,
    })
  })

  it("reports missing Slack delivery channel configuration", () => {
    const target = resolveApprovedProposalDeliveryTarget({
      deliveryPlugin: "slack",
      leadEmail: "customer@example.com",
      slackDeliveryChannelId: "",
    })

    expect(target).toEqual({
      channel: "slack",
      recipient: "missing-recipient",
      missingRecipientError:
        "Delivery blocked because Slack delivery channel is missing",
    })
  })
})
