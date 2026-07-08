import type { DeliveryPlugin } from "@/lib/delivery/types"
import { env } from "@/lib/env"

export const sendgridDeliveryPlugin: DeliveryPlugin = {
  async deliver() {
    if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM) {
      throw new Error("SendGrid delivery is not configured; set SENDGRID_API_KEY and SENDGRID_FROM.")
    }

    throw new Error("SendGrid delivery is not enabled yet; choose resend or implement SendGrid sending.")
  },
}
