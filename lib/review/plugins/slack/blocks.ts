import type { GuardrailIssueDraft } from "@/lib/domain/types"
import type {
  ProposalReviewRequest,
  ReviewRequestMessage,
} from "@/lib/review/types"

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function issueLabel(issue: GuardrailIssueDraft): string {
  return `*${issue.severity}* \`${escapeSlackText(issue.code)}\`: ${escapeSlackText(issue.message)}`
}

function blockersFromIssues(
  issues: Array<{ severity: string; code: string; message: string }>
): string[] {
  return issues
    .filter((issue) => issue.severity === "BLOCKING")
    .map((issue) => `${issue.code}: ${issue.message}`)
}

function warningsFromIssues(
  issues: Array<{ severity: string; code: string; message: string }>
): string[] {
  return issues
    .filter((issue) => issue.severity === "WARNING")
    .map((issue) => `${issue.code}: ${issue.message}`)
}

function buildProposalReviewText(input: {
  leadName: string
  projectType: string
  totalCents: number
  blocked: boolean
}): string {
  const status = input.blocked ? "blocked by guardrails" : "ready for review"
  return `Proposal ${status}: ${input.leadName} — ${input.projectType} (${formatCents(input.totalCents)})`
}

function buildProposalReviewBlocks(input: {
  proposalId: string
  versionId: string
  internalUrl: string
  leadName: string
  projectType: string
  totalCents: number
  issues: GuardrailIssueDraft[]
}): unknown[] {
  const blockingIssueLines = input.issues
    .filter((issue) => issue.severity === "BLOCKING")
    .map(issueLabel)

  return [
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lead:*\n${escapeSlackText(input.leadName)}` },
        {
          type: "mrkdwn",
          text: `*Project:*\n${escapeSlackText(input.projectType)}`,
        },
        { type: "mrkdwn", text: `*Proposal ID:*\n\`${input.proposalId}\`` },
        { type: "mrkdwn", text: `*Version ID:*\n\`${input.versionId}\`` },
        { type: "mrkdwn", text: `*Total:*\n${formatCents(input.totalCents)}` },
        {
          type: "mrkdwn",
          text: `*Blocking issues:*\n${blockingIssueLines.length}`,
        },
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
          blockingIssueLines.length > 0
            ? `*Blocking details*\n${blockingIssueLines.slice(0, 10).join("\n")}`
            : "*Blocking details*\nNo blocking issues found.",
      },
    },
  ]
}

export function buildProposalReviewMessage(
  input: ProposalReviewRequest
): ReviewRequestMessage {
  return {
    proposalId: input.proposalId,
    versionId: input.versionId,
    summaryText: buildProposalReviewText(input),
    blocks: buildProposalReviewBlocks({
      proposalId: input.proposalId,
      versionId: input.versionId,
      internalUrl: input.internalProposalUrl,
      leadName: input.leadName,
      projectType: input.projectType,
      totalCents: input.totalCents,
      issues: input.issues,
    }),
    totalCents: input.totalCents,
    warnings: warningsFromIssues(input.issues),
    blockers: blockersFromIssues(input.issues),
    internalProposalUrl: input.internalProposalUrl,
  }
}
