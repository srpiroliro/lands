import { z } from "zod"

export const quantitySourceSchema = z.enum([
  "USER",
  "AI_ESTIMATE",
  "CATALOG_DEFAULT",
  "MANUAL_OVERRIDE",
])

export const aiLineItemDraftSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().positive(),
  quantitySource: quantitySourceSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string(),
})

export const proposalDraftSchema = z.object({
  executiveSummary: z.string().min(20),
  customerMessage: z.string().min(20),
  lineItems: z.array(aiLineItemDraftSchema).min(1),
  assumptions: z.array(z.string()),
  unknowns: z.array(z.string()),
  renderBrief: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  modelTotalCents: z.number().int().nonnegative(),
})
