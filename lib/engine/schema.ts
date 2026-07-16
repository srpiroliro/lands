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
  timeline: z
    .string()
    .min(2)
    .default("Timeline to be confirmed during review."),
  lineItems: z.array(aiLineItemDraftSchema).min(1),
  assumptions: z.array(z.string()),
  unknowns: z.array(z.string()),
  renderBrief: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export const measurementAuditIssueSchema = z.object({
  sku: z.string().min(1),
  severity: z.enum(["WARNING", "BLOCKING"]),
  code: z.enum([
    "MEASUREMENT_NEEDS_CONFIRMATION",
    "NO_SCALE_REFERENCE",
    "MEASUREMENT_DISAGREEMENT",
    "UNIT_MISMATCH_RISK",
  ]),
  message: z.string().min(1),
  modelSuggestedQuantity: z.number().positive().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
})

export const measurementAuditResultSchema = z.object({
  issues: z.array(measurementAuditIssueSchema),
  overallRisk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1),
})
