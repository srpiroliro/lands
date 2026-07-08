import { env } from "@/lib/env"
import type {
  ProposalAiDraftInput,
  ProposalAiPlugin,
  ProposalAiRevisionInput,
} from "@/lib/proposal/types"
import { proposalDraftSchema } from "@/lib/proposals/schema"
import type { ProposalDraft } from "@/lib/proposals/types"

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
    "modelTotalCents",
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
    modelTotalCents: { type: "integer", minimum: 0 },
  },
} as const

const systemPrompt = `You draft proposals for Greenscape Pro, a premium Phoenix residential hardscape/landscape design-build company.
Use only provided pricing SKUs. Do not invent SKUs.
If notes provide measurements, use those measurements and mark quantitySource USER.
If photos imply scope but measurements are missing, estimate conservatively, mark quantitySource AI_ESTIMATE, reduce confidence, and explain in notes.
modelTotalCents must equal the sum of unit price times quantity for all selected line items.
If total exceeds $30,000, include a concise renderBrief for Carlos.
Return only schema-valid JSON.`

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
    2,
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
    2,
  )
}

function buildMessages(prompt: string, photoUrls: string[]): OpenRouterMessage[] {
  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...photoUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    },
  ]
}

async function requestProposalDraft(model: string, messages: OpenRouterMessage[]): Promise<ProposalDraft> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText || response.statusText}`)
  }

  const payload = (await response.json()) as OpenRouterResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("OpenRouter returned an empty proposal draft")
  }

  return proposalDraftSchema.parse(JSON.parse(content))
}

async function requestWithFallback(messages: OpenRouterMessage[]): Promise<ProposalDraft> {
  const models = [env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODEL]
  let lastError: unknown

  for (const model of models) {
    try {
      return await requestProposalDraft(model, messages)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter proposal draft failed")
}

export const openRouterProposalAiPlugin: ProposalAiPlugin = {
  draftProposal(input) {
    return requestWithFallback(buildMessages(buildPrompt(input), input.photoUrls))
  },

  reviseProposal(input) {
    return requestWithFallback(buildMessages(buildRevisionPrompt(input), input.photoUrls))
  },
}
