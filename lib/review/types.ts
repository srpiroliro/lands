import type { GuardrailIssueDraft } from "@/lib/domain/types"

export type ProposalReviewRequest = {
  proposalId: string
  versionId: string
  internalProposalUrl: string
  leadName: string
  projectType: string
  totalCents: number
  blocked: boolean
  issues: GuardrailIssueDraft[]
}

export type ReviewRequestMessage = {
  proposalId: string
  versionId: string
  summaryText: string
  blocks: unknown[]
  totalCents?: number
  warnings?: string[]
  blockers?: string[]
  internalProposalUrl?: string
}

export type ReviewThreadRef = {
  channel: "slack"
  slackChannelId: string
  slackMessageTs: string
  slackThreadTs: string
}

export interface ReviewPlugin {
  requestProposalReview(input: ProposalReviewRequest): Promise<ReviewThreadRef>
  postProposalRevisionUpdate(
    input: ProposalReviewRequest & { slackThreadTs: string }
  ): Promise<ReviewThreadRef>
  postThreadMessage(input: {
    slackChannelId: string
    slackThreadTs: string
    text: string
  }): Promise<void>
}

export type SlackActionId = "proposal_approve" | "proposal_reject"

export type SlackMessageEvent = {
  type: "message"
  channel: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  bot_id?: string
  subtype?: string
}

export type SlackUrlVerificationEvent = {
  type: "url_verification"
  challenge: string
}
