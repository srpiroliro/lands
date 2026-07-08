import type { SlackActionId } from "@/lib/review/types"

const allowedActionIds = new Set<SlackActionId>(["proposal_approve", "proposal_reject"])

export function parseProposalActionValue(value: string): { proposalId: string; versionId: string } {
  const [proposalId, versionId, extra] = value.split(":")

  if (!proposalId || !versionId || extra !== undefined) {
    throw new Error("Invalid proposal action value")
  }

  return { proposalId, versionId }
}

export function parseSlackActionPayload(rawPayload: string): {
  actionId: "proposal_approve" | "proposal_reject"
  proposalId: string
  versionId: string
  userId?: string
} {
  const payload = JSON.parse(rawPayload) as unknown

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Slack action payload")
  }

  const actions = "actions" in payload ? payload.actions : undefined
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("Slack action payload is missing actions")
  }

  const action = actions[0] as unknown
  if (!action || typeof action !== "object") {
    throw new Error("Invalid Slack action")
  }

  const actionId = "action_id" in action ? action.action_id : undefined
  if (typeof actionId !== "string" || !allowedActionIds.has(actionId as SlackActionId)) {
    throw new Error("Unsupported Slack proposal action")
  }

  const value = "value" in action ? action.value : undefined
  if (typeof value !== "string") {
    throw new Error("Slack proposal action is missing value")
  }

  const user = "user" in payload ? payload.user : undefined
  const userId =
    user && typeof user === "object" && "id" in user && typeof user.id === "string"
      ? user.id
      : undefined

  return {
    actionId: actionId as SlackActionId,
    ...parseProposalActionValue(value),
    ...(userId ? { userId } : {}),
  }
}
