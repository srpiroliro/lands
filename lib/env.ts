import { z } from "zod"

const envSchema = z.object({
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DEMO_SEED_SECRET: z.string().optional(),
  NEXT_PUBLIC_PREFILL_DEMO_INTAKE: z.enum(["true", "false"]).default("false"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENROUTER_FALLBACK_MODEL: z.string().default("openai/gpt-4o"),
  OPENROUTER_SITE_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_APP_NAME: z.string().default("Greenscape Proposal Builder"),
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_REVIEW_CHANNEL_ID: z.string().min(1),
  DELIVERY_PLUGIN: z.enum(["resend", "sendgrid"]).default("resend"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM: z.string().optional(),
  GHL_ENABLED: z.enum(["true", "false"]).default("false"),
  GHL_API_KEY: z.string().optional(),
  GHL_LOCATION_ID: z.string().optional(),
})

export const env = envSchema.parse(process.env)
