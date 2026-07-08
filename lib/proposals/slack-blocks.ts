import type { GuardrailIssueDraft } from "@/lib/domain/types"

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function escapeSlackText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function issueLabel(issue: GuardrailIssueDraft): string {
  return `*${issue.severity}* \`${escapeSlackText(issue.code)}\`: ${escapeSlackText(issue.message)}`
}

export function buildProposalReviewText(input: {
  leadName: string
  projectType: string
  totalCents: number
  blocked: boolean
}): string {
  const status = input.blocked ? "blocked by guardrails" : "ready for review"
  return `Proposal ${status}: ${input.leadName} — ${input.projectType} (${formatCents(input.totalCents)})`
}

export function buildProposalReviewBlocks(input: {
  proposalId: string
  versionId: string
  internalUrl: string
  leadName: string
  projectType: string
  totalCents: number
  issues: GuardrailIssueDraft[]
}): unknown[] {
  const issueLines = input.issues.map(issueLabel)

  return [
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lead:*\n${escapeSlackText(input.leadName)}` },
        { type: "mrkdwn", text: `*Project:*\n${escapeSlackText(input.projectType)}` },
        { type: "mrkdwn", text: `*Proposal ID:*\n\`${input.proposalId}\`` },
        { type: "mrkdwn", text: `*Version ID:*\n\`${input.versionId}\`` },
        { type: "mrkdwn", text: `*Total:*\n${formatCents(input.totalCents)}` },
        { type: "mrkdwn", text: `*Guardrail issues:*\n${issueLines.length}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Draft workspace:* <${input.internalUrl}|Open proposal draft>`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          issueLines.length > 0
            ? `*Guardrail details*\n${issueLines.slice(0, 10).join("\n")}`
            : "*Guardrail details*\nNo guardrail issues found.",
      },
    },
  ]
}
