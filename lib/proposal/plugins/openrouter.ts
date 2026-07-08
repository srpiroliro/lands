import { env } from "@/lib/env"
import type {
  MeasurementAuditInput,
  ProposalAiDraftInput,
  ProposalAiPlugin,
  ProposalAiRevisionInput,
} from "@/lib/proposal/types"
import {
  measurementAuditResultSchema,
  proposalDraftSchema,
} from "@/lib/proposals/schema"
import type {
  MeasurementAuditResult,
  ProposalDraft,
} from "@/lib/proposals/types"

const proposalDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "customerMessage",
    "lineItems",
    "assumptions",
    "unknowns",
    "renderBrief",
    "confidence",
  ],
  properties: {
    executiveSummary: { type: "string", minLength: 20 },
    customerMessage: { type: "string", minLength: 20 },
    lineItems: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sku", "quantity", "quantitySource", "confidence", "notes"],
        properties: {
          sku: { type: "string", minLength: 1 },
          quantity: { type: "number", exclusiveMinimum: 0 },
          quantitySource: {
            type: "string",
            enum: ["USER", "AI_ESTIMATE", "CATALOG_DEFAULT", "MANUAL_OVERRIDE"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          notes: { type: "string" },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    renderBrief: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const

const measurementAuditJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issues", "overallRisk", "summary"],
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sku",
          "severity",
          "code",
          "message",
          "modelSuggestedQuantity",
          "confidence",
          "reason",
        ],
        properties: {
          sku: { type: "string", minLength: 1 },
          severity: { type: "string", enum: ["WARNING", "BLOCKING"] },
          code: {
            type: "string",
            enum: [
              "MEASUREMENT_NEEDS_CONFIRMATION",
              "NO_SCALE_REFERENCE",
              "MEASUREMENT_DISAGREEMENT",
              "UNIT_MISMATCH_RISK",
            ],
          },
          message: { type: "string", minLength: 1 },
          modelSuggestedQuantity: {
            anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", minLength: 1 },
        },
      },
    },
    overallRisk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string", minLength: 1 },
  },
} as const

const systemPrompt = `You draft proposals for Greenscape Pro, a premium Phoenix residential hardscape/landscape design-build company.
Use only provided pricing SKUs. Do not invent SKUs.
If notes provide measurements, use those measurements and mark quantitySource USER.
If photos imply scope but measurements are missing, estimate conservatively, mark quantitySource AI_ESTIMATE, reduce confidence, and explain in notes.
The quantity field is only the measurement or count amount for the selected catalog item unit: sf means square feet, lf means linear feet, and ea means each/count. For example, 500 sf of pavers returns quantity 500, 20 lf of outdoor kitchen returns quantity 20, and 1 grill insert returns quantity 1.
Do not calculate proposal totals, line-item prices, or price-derived quantities. Return only SKUs, measurement/count quantities, quantity sources, confidence, notes, assumptions, unknowns, and narrative fields. Pricing is calculated later by the app from the catalog.
If the likely project scope is large enough to require design review, include a concise renderBrief for Carlos.
Return only schema-valid JSON.`

const measurementAuditSystemPrompt = `You are a construction measurement QA auditor for Greenscape Pro. Your job is to find risky measurement quantities in a proposal draft. Do not calculate prices or totals. Review only whether the quantity amount for each SKU is supported by notes/photos and matches the catalog unit. sf means square feet, lf means linear feet, ea means each/count. Photo-only sf/lf estimates without a scale reference should be flagged as BLOCKING NO_SCALE_REFERENCE or MEASUREMENT_NEEDS_CONFIRMATION. If the draft quantity appears inconsistent with visible evidence or notes, flag MEASUREMENT_DISAGREEMENT. If an item uses the wrong kind of unit, flag UNIT_MISMATCH_RISK. Return only schema-valid JSON.`

type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

type OpenRouterMessage = {
  role: "system" | "user"
  content: string | OpenRouterContentPart[]
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function buildPrompt(input: ProposalAiDraftInput): string {
  return JSON.stringify(
    {
      lead: input.lead,
      pricingCatalog: input.pricingCatalog,
    },
    null,
    2
  )
}

function buildRevisionPrompt(input: ProposalAiRevisionInput): string {
  return JSON.stringify(
    {
      lead: input.lead,
      pricingCatalog: input.pricingCatalog,
      previousDraft: input.previousDraft,
      revisionInstructions: input.revisionInstructions,
    },
    null,
    2
  )
}

function buildMeasurementAuditPrompt(input: MeasurementAuditInput): string {
  return JSON.stringify(
    {
      lead: input.lead,
      pricingCatalog: input.pricingCatalog.map((item) => ({
        sku: item.sku,
        category: item.category,
        name: item.name,
        description: item.description,
        unit: item.unit,
      })),
      draftLineItems: input.draft.lineItems,
      assumptions: input.draft.assumptions,
      unknowns: input.draft.unknowns,
    },
    null,
    2
  )
}

function buildMessages(
  prompt: string,
  photoUrls: string[],
  promptOverride = systemPrompt
): OpenRouterMessage[] {
  return [
    { role: "system", content: promptOverride },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...photoUrls.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ],
    },
  ]
}

async function requestProposalDraft(
  model: string,
  messages: OpenRouterMessage[]
): Promise<ProposalDraft> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.OPENROUTER_SITE_URL,
        "X-Title": env.OPENROUTER_APP_NAME,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "proposal_draft",
            strict: true,
            schema: proposalDraftJsonSchema,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText || response.statusText}`
    )
  }

  const payload = (await response.json()) as OpenRouterResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("OpenRouter returned an empty proposal draft")
  }

  return proposalDraftSchema.parse(JSON.parse(content))
}

async function requestMeasurementAudit(
  model: string,
  messages: OpenRouterMessage[]
): Promise<MeasurementAuditResult> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.OPENROUTER_SITE_URL,
        "X-Title": env.OPENROUTER_APP_NAME,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "measurement_audit",
            strict: true,
            schema: measurementAuditJsonSchema,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText || response.statusText}`
    )
  }

  const payload = (await response.json()) as OpenRouterResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("OpenRouter returned an empty measurement audit")
  }

  return measurementAuditResultSchema.parse(JSON.parse(content))
}

async function requestWithFallback(
  messages: OpenRouterMessage[]
): Promise<ProposalDraft> {
  const models = [env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODEL]
  let lastError: unknown

  for (const model of models) {
    try {
      return await requestProposalDraft(model, messages)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter proposal draft failed")
}

async function requestMeasurementAuditWithFallback(
  messages: OpenRouterMessage[]
): Promise<MeasurementAuditResult> {
  const models = [env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODEL]
  let lastError: unknown

  for (const model of models) {
    try {
      return await requestMeasurementAudit(model, messages)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter measurement audit failed")
}

export const openRouterProposalAiPlugin: ProposalAiPlugin = {
  draftProposal(input) {
    return requestWithFallback(
      buildMessages(buildPrompt(input), input.photoUrls)
    )
  },

  reviseProposal(input) {
    return requestWithFallback(
      buildMessages(buildRevisionPrompt(input), input.photoUrls)
    )
  },

  auditMeasurements(input) {
    return requestMeasurementAuditWithFallback(
      buildMessages(
        buildMeasurementAuditPrompt(input),
        input.photoUrls,
        measurementAuditSystemPrompt
      )
    )
  },
}
