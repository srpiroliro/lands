import type {
  ProposalReviewRequest,
  ReviewRequestMessage,
} from "@/lib/review/types"

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function compactText(value: string, maxLength: number): string {
  const compact = value.trim().replace(/\s+/g, " ")
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

function formatTotal(totalCents: number): string {
  return dollars.format(totalCents / 100)
}

function buildProposalReviewText(input: ProposalReviewRequest): string {
  const leadName = escapeSlackText(compactText(input.leadName, 120))
  const projectType = escapeSlackText(compactText(input.projectType, 120))
  const timeline = escapeSlackText(compactText(input.timeline, 120))
  const description = escapeSlackText(compactText(input.description, 180))

  return [
    `Proposal completed for ${leadName}.`,
    `${projectType} · ${formatTotal(input.totalCents)} · ${timeline}.`,
    description,
  ].join(" ")
}

function buildProposalReviewBlocks(input: ProposalReviewRequest): unknown[] {
  const leadName = escapeSlackText(compactText(input.leadName, 120))
  const projectType = escapeSlackText(compactText(input.projectType, 120))
  const timeline = escapeSlackText(compactText(input.timeline, 120))
  const description = escapeSlackText(compactText(input.description, 500))

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Proposal completed" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lead*\n${leadName}` },
        { type: "mrkdwn", text: `*Project*\n${projectType}` },
        {
          type: "mrkdwn",
          text: `*Total*\n${formatTotal(input.totalCents)}`,
        },
        { type: "mrkdwn", text: `*Timeline*\n${timeline}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Description*\n${description}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${escapeSlackText(input.internalProposalUrl)}|Open proposal>`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Reply in this thread with changes and I will revise the proposal.",
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "proposal_approve",
          value: `${input.proposalId}:${input.versionId}`,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "proposal_reject",
          value: `${input.proposalId}:${input.versionId}`,
        },
      ],
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
    blocks: buildProposalReviewBlocks(input),
  }
}
