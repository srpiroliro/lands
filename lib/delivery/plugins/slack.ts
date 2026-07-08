import { WebClient } from "@slack/web-api"

import type { DeliveryPlugin } from "@/lib/delivery/types"
import { env } from "@/lib/env"

const slack = new WebClient(env.SLACK_BOT_TOKEN)

export const slackDeliveryPlugin: DeliveryPlugin = {
  async deliver(input) {
    if (input.channel !== "slack") {
      throw new Error("Slack delivery supports only Slack channels")
    }

    if (!env.SLACK_DELIVERY_CHANNEL_ID) {
      throw new Error(
        "Slack delivery is not configured; set SLACK_DELIVERY_CHANNEL_ID."
      )
    }

    const result = await slack.chat.postMessage({
      channel: input.to,
      text: input.text,
      unfurl_links: false,
      unfurl_media: false,
    })

    if (!result.ts) {
      throw new Error("Slack delivery failed: missing message timestamp")
    }

    return {
      provider: "slack",
      channel: "slack",
      messageId: result.ts,
    }
  },
}
