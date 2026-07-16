import { WebClient } from "@slack/web-api"

import { env } from "@/lib/env"
import { buildProposalReviewMessage } from "@/lib/review/plugins/slack/blocks"
import type {
  ReviewPlugin,
  ReviewRequestMessage,
  ReviewThreadRef,
} from "@/lib/review/types"

const slack = new WebClient(env.SLACK_BOT_TOKEN)

async function postReviewMessage(
  input: ReviewRequestMessage & { threadTs?: string }
): Promise<ReviewThreadRef> {
  const message = {
    channel: env.SLACK_REVIEW_CHANNEL_ID,
    text: input.summaryText,
    blocks: input.blocks,
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
  requestProposalReview(input) {
    return postReviewMessage(buildProposalReviewMessage(input))
  },

  postProposalRevisionUpdate(input) {
    return postReviewMessage({
      ...buildProposalReviewMessage(input),
      threadTs: input.slackThreadTs,
    })
  },

  async postThreadMessage(input) {
    await slack.chat.postMessage({
      channel: input.slackChannelId,
      thread_ts: input.slackThreadTs,
      text: input.text,
    })
  },

  async postChannelMessage(input) {
    await slack.chat.postMessage({
      channel: env.SLACK_REVIEW_CHANNEL_ID,
      text: input.text,
    })
  },
}
