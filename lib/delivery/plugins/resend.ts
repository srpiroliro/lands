import { Resend } from "resend"

import type { DeliveryPlugin } from "@/lib/delivery/types"
import { env } from "@/lib/env"

const resend = new Resend(env.RESEND_API_KEY)

export const resendDeliveryPlugin: DeliveryPlugin = {
  async deliver(input) {
    if (input.channel !== "email") {
      throw new Error("Resend delivery supports only email in v1")
    }

    if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
      throw new Error("Resend delivery is not configured; set RESEND_API_KEY and RESEND_FROM.")
    }

    const { data, error } = await resend.emails.send(
      {
        from: env.RESEND_FROM,
        to: input.to,
        subject: input.subject ?? "Your Greenscape Pro proposal",
        html: input.html,
        text: input.text,
      },
      { idempotencyKey: input.idempotencyKey },
    )

    if (error) {
      throw new Error(`Resend delivery failed: ${error.message}`)
    }

    if (!data?.id) {
      throw new Error("Resend delivery failed: missing message id")
    }

    return { provider: "resend", channel: "email", messageId: data.id }
  },
}
