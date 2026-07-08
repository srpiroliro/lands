# Greenscape Pro Proposal Builder

AI-assisted proposal workflow for Greenscape Pro. The app turns lead intake notes and site photos into a priced proposal draft, routes it to Slack for human approval, and sends the approved proposal through the configured delivery provider.

## Application flow

```mermaid
flowchart TD
  A[Lead intake form] --> B[Next.js Server Action]
  B --> C{Validate lead fields and photo files}
  C -- invalid --> D[Return field errors to UI]
  C -- valid --> E[Create Lead in Postgres]
  E --> F[Store uploaded photos in Vercel Blob]
  F --> G[Load active PricingItem catalog]
  G --> H[AI draft proposal]
  H --> I[AI measurement audit]
  I --> J[Domain guardrails and pricing]
  J --> K[Persist Proposal, Version, LineItems, GuardrailIssues]
  K --> L{Blocking guardrail?}
  L -- yes --> M[Mark Lead and Proposal BLOCKED]
  L -- no --> N[Mark Lead and Proposal PENDING_REVIEW]
  M --> O[Post Slack review request]
  N --> O
  O --> P{Reviewer action in Slack}
  P -- thread reply with changes --> Q[Create RevisionRequest]
  Q --> R[AI revision from previous draft and reviewer notes]
  R --> I
  P -- reject --> S[Mark review rejected]
  P -- approve --> T{Any blocking issue remains?}
  T -- yes --> U[Record failed DeliveryLog and keep blocked]
  T -- no --> V[Render customer proposal delivery]
  V --> W[Send via Resend, SendGrid, or Slack]
  W --> X[Record DeliveryLog]
  X --> Y[Record GHL demo integration event]
  Y --> Z[Customer opens public proposal link]
```

## Service-level architecture

```mermaid
flowchart LR
  subgraph UI[Next.js app layer]
    Intake["app/page.tsx intake UI"]
    Internal["app/proposals/:id internal review page"]
    Public["app/p/:token customer proposal page"]
    SlackRoutes["app/api/slack routes"]
  end

  subgraph Engine[Application service layer]
    Create[lib/engine/create-proposal.ts]
    Revise[lib/engine/revise-proposal.ts]
    Complete[lib/engine/complete-review.ts]
    Render[lib/engine/render-proposal.ts and render-delivery.ts]
  end

  subgraph Domain[Domain layer]
    IntakeSchema[lib/intake schema]
    Guardrails[lib/domain/guardrails.ts]
    Pricing[lib/domain/pricing.ts]
    TypedSchemas[lib/engine/schema.ts]
  end

  subgraph Plugins[Integration plugins]
    AI[lib/proposal/plugins/openrouter.ts]
    Review[lib/review/plugins/slack]
    Delivery[lib/delivery plugins]
    Media[lib/media/plugins/vercel-blob.ts]
    CRM[lib/crm/plugins/ghl-demo.ts]
  end

  subgraph Data[Persistence]
    Prisma[Prisma Client]
    Postgres[(Neon/Postgres)]
    Blob[(Vercel Blob)]
  end

  Intake --> Create
  SlackRoutes --> Revise
  SlackRoutes --> Complete
  Create --> Guardrails
  Revise --> Guardrails
  Complete --> Render
  Guardrails --> Pricing
  Create --> AI
  Revise --> AI
  Create --> Review
  Revise --> Review
  Complete --> Delivery
  Create --> Media
  Create --> CRM
  Complete --> CRM
  Create --> Prisma
  Revise --> Prisma
  Complete --> Prisma
  Prisma --> Postgres
  Media --> Blob
```

### Service responsibilities

| Service level | Files | Responsibility |
| --- | --- | --- |
| App layer | `app/*`, `components/*` | Collect lead data, display proposal state, receive Slack events and actions. |
| Engine layer | `lib/engine/*` | Orchestrate proposal creation, revision, approval, delivery, and persistence. |
| Domain layer | `lib/domain/*`, `lib/intake/*`, `lib/engine/schema.ts` | Validate inputs, calculate catalog pricing, enforce business guardrails, and parse AI output. |
| AI service | `lib/proposal/plugins/openrouter.ts` | Calls OpenRouter vision-capable chat models for drafting, revision, and measurement QA. |
| Review service | `lib/review/plugins/slack/*` | Posts Slack approval cards, handles threaded revision flow, and records reviewer decisions. |
| Delivery service | `lib/delivery/plugins/*` | Sends approved proposals through Resend, SendGrid, or Slack and returns provider message IDs. |
| Persistence | `lib/db.ts`, `prisma/schema.prisma` | Stores leads, photos, pricing catalog items, proposals, versions, guardrails, reviews, revisions, delivery logs, and integration events. |

## AI proposal flow

```mermaid
sequenceDiagram
  participant User as Lead intake
  participant Engine as Proposal engine
  participant Blob as Vercel Blob
  participant DB as Postgres
  participant AI as OpenRouter vision model
  participant Guardrails as Domain guardrails
  participant Slack as Slack reviewer
  participant Delivery as Delivery provider

  User->>Engine: Submit contact info, budget, notes, photos
  Engine->>DB: Create Lead with status DRAFTING
  Engine->>Blob: Save uploaded photos
  Engine->>DB: Load active pricing catalog
  Engine->>AI: Draft from lead notes, pricing catalog, and photo URLs
  AI-->>Engine: Schema-valid proposal draft JSON
  Engine->>AI: Audit draft measurements against notes and photos
  AI-->>Engine: Measurement risks and confidence JSON
  Engine->>Guardrails: Validate SKUs, totals, budget fit, confidence, render threshold, measurement risks
  Guardrails-->>Engine: Priced line items, warnings, blockers
  Engine->>DB: Store ProposalVersion, line items, raw AI JSON, guardrail issues
  Engine->>Slack: Post approval request with blockers and warnings
  Slack-->>Engine: Approve, reject, or thread feedback
  alt Reviewer requests changes
    Engine->>DB: Create RevisionRequest
    Engine->>AI: Revise using prior draft and reviewer instructions
    AI-->>Engine: Revised schema-valid draft JSON
    Engine->>Guardrails: Re-price and re-check guardrails
    Engine->>Slack: Post revised review update in same thread
  else Reviewer approves
    Engine->>Delivery: Send approved proposal link
    Delivery-->>Engine: Provider message id
    Engine->>DB: Record DeliveryLog and mark delivered
  end
```

### What the AI does

The app uses OpenRouter chat completions with image URLs, strict JSON-schema responses, and Zod parsing. Initial proposal creation makes two AI calls:

1. **Proposal draft call**
   - Input: lead contact fields, project type, notes, budget range, uploaded photo URLs, and active pricing catalog SKUs.
   - Output: executive summary, customer message, selected SKUs, quantities, quantity sources, line confidence, assumptions, unknowns, render brief, and draft confidence.
   - Constraint: the model can only choose existing catalog SKUs. It does not calculate prices or totals.

2. **Measurement audit call**
   - Input: the same lead context, photo URLs, catalog units, and draft line items.
   - Output: measurement warnings or blockers for missing scale references, unit mismatch risk, unsupported quantities, and quantity disagreement.
   - Constraint: the model audits measurement support only. It does not approve delivery.

Revision uses a third AI path: Slack thread feedback plus the previous draft go back to the model. The revised draft then runs through the same measurement audit and guardrail pipeline before a reviewer can approve it.

### Guardrails after AI output

The app treats AI output as a draft, not the source of truth.

- Zod schemas reject malformed model JSON.
- The domain layer rejects unknown SKUs.
- The app calculates line totals from `PricingItem.unitPriceCents` instead of trusting the model.
- Proposals below $8,000 or above $120,000 get blocking issues.
- Draft and line confidence below `0.7` trigger blocking or warning issues.
- Projects over $30,000 trigger a render-required warning.
- The measurement audit can block photo-only estimates with no scale reference.
- Slack approval still checks for blocking guardrails before delivery.

## Persistence model

Core tables in `prisma/schema.prisma`:

- `Lead`: customer and project intake data.
- `Photo`: uploaded image metadata and Blob URLs.
- `PricingItem`: active catalog SKUs and unit pricing.
- `Proposal`: current proposal status and public token.
- `ProposalVersion`: versioned AI draft, prompt version, model label, raw model JSON, total, and confidence.
- `ProposalLineItem`: priced catalog lines derived from the AI draft.
- `GuardrailIssue`: warning and blocking issues for each proposal version.
- `ProposalReview`: Slack review thread and decision state.
- `RevisionRequest`: reviewer feedback that triggers an AI revision.
- `DeliveryLog`: outbound proposal delivery attempts and provider message IDs.
- `IntegrationEvent`: stored webhook or integration event payloads.

## External integrations

| Integration | Purpose | Environment variables |
| --- | --- | --- |
| OpenRouter | Vision-capable AI proposal drafting and measurement audit | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` |
| Slack | Human approval, rejection, and threaded revision feedback | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_REVIEW_CHANNEL_ID`, `SLACK_DELIVERY_CHANNEL_ID` |
| Resend | Default customer email delivery | `RESEND_API_KEY`, `RESEND_FROM` |
| SendGrid | Optional customer email delivery | `SENDGRID_API_KEY`, `SENDGRID_FROM` |
| Vercel Blob | Lead photo storage for AI vision calls | `BLOB_READ_WRITE_TOKEN` |
| Neon/Postgres | Persistent application database | `DATABASE_URL`, `DIRECT_URL` |

## Local development

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Run checks before shipping:

```bash
pnpm lint
pnpm typecheck
pnpm test:transient
```

See `.env.example` for required configuration.
