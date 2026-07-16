import type {
  ProposalReviewRequest,
  ReviewRequestMessage,
} from "@/lib/review/types"

function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function buildProposalReviewText(): string {
  return "Proposal completed."
}

function buildProposalReviewBlocks(input: {
  proposalId: string
  versionId: string
  internalUrl: string
}): unknown[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Proposal completed" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${escapeSlackText(input.internalUrl)}|Open proposal>`,
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
    summaryText: buildProposalReviewText(),
    blocks: buildProposalReviewBlocks({
      proposalId: input.proposalId,
      versionId: input.versionId,
      internalUrl: input.internalProposalUrl,
    }),
  }
}
