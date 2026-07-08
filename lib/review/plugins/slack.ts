import { WebClient } from "@slack/web-api"

import { env } from "@/lib/env"
import type { ReviewPlugin, ReviewRequestMessage, ReviewThreadRef } from "@/lib/review/types"

const slack = new WebClient(env.SLACK_BOT_TOKEN)

function proposalUrl(proposalId: string): string {
  return `${env.APP_BASE_URL}/proposals/${proposalId}`
}

function actionBlocks(input: ReviewRequestMessage): unknown[] {
  const url = proposalUrl(input.proposalId)

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Proposal ready for review" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: input.summaryText },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Proposal:*\n<${url}|Open internal proposal>` },
        { type: "mrkdwn", text: "*Review notes:*\nCheck total, warnings, and blockers before approval." },
      ],
    },
    ...input.blocks,
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

async function postReviewMessage(input: ReviewRequestMessage & { threadTs?: string }): Promise<ReviewThreadRef> {
  const message = {
    channel: env.SLACK_REVIEW_CHANNEL_ID,
    text: input.summaryText,
    blocks: actionBlocks(input),
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
  } as Parameters<typeof slack.chat.postMessage>[0]

  const result = await slack.chat.postMessage(message)

  if (!result.ts) {
    throw new Error("Slack did not return a message timestamp")
  }

  return {
    channel: "slack",
    slackChannelId: env.SLACK_REVIEW_CHANNEL_ID,
    slackMessageTs: result.ts,
    slackThreadTs: input.threadTs ?? result.ts,
  }
}

export const slackReviewPlugin: ReviewPlugin = {
  requestReview(input) {
    return postReviewMessage(input)
  },

  postRevisionUpdate(input) {
    return postReviewMessage({ ...input, threadTs: input.slackThreadTs })
  },

  async postThreadMessage(input) {
    await slack.chat.postMessage({
      channel: input.slackChannelId,
      thread_ts: input.slackThreadTs,
      text: input.text,
    })
  },
}
