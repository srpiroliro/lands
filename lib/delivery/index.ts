import { env } from "@/lib/env"
import type { DeliveryPlugin } from "@/lib/delivery/types"
import { resendDeliveryPlugin } from "@/lib/delivery/plugins/resend"
import { sendgridDeliveryPlugin } from "@/lib/delivery/plugins/sendgrid"

export const delivery: DeliveryPlugin =
  env.DELIVERY_PLUGIN === "sendgrid" ? sendgridDeliveryPlugin : resendDeliveryPlugin
