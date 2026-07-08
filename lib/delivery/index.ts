import { env } from "@/lib/env"
import type { DeliveryPlugin } from "@/lib/delivery/types"
import { resendDeliveryPlugin } from "@/lib/delivery/plugins/resend"
import { sendgridDeliveryPlugin } from "@/lib/delivery/plugins/sendgrid"
import { slackDeliveryPlugin } from "@/lib/delivery/plugins/slack"

function selectDeliveryPlugin(): DeliveryPlugin {
  if (env.DELIVERY_PLUGIN === "sendgrid") return sendgridDeliveryPlugin
  if (env.DELIVERY_PLUGIN === "slack") return slackDeliveryPlugin
  return resendDeliveryPlugin
}

export const delivery: DeliveryPlugin = selectDeliveryPlugin()
