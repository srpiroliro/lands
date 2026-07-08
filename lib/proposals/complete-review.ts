import type { Prisma } from "@prisma/client"

import { crm } from "@/lib/crm"
import { prisma } from "@/lib/db"
import { delivery } from "@/lib/delivery"
import { env } from "@/lib/env"
import { renderApprovedProposalDelivery } from "@/lib/proposals/render-delivery"

function toJsonPayload(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
}

function selectedDeliveryProvider(): "resend" | "sendgrid" {
  return env.DELIVERY_PLUGIN === "sendgrid" ? "sendgrid" : "resend"
}

function publicProposalUrl(publicToken: string): string {
  return `${env.APP_BASE_URL}/p/${publicToken}`
}

async function loadRequestedReview(input: {
  proposalId: string
  versionId: string
}) {
  const review = await prisma.proposalReview.findFirst({
    where: {
      proposalId: input.proposalId,
      versionId: input.versionId,
    },
    include: {
      proposal: { include: { lead: true } },
      version: { include: { guardrails: true } },
    },
    orderBy: { requestedAt: "desc" },
  })

  if (!review) {
    throw new Error("Proposal review not found")
  }

  if (review.status !== "REQUESTED") {
    throw new Error("Proposal review is no longer pending")
  }

  if (review.proposal.currentVersionId !== input.versionId) {
    throw new Error("Proposal review version is no longer current")
  }

  return review
}

async function recordBlockedApproval(input: {
  proposalId: string
  leadId: string
  recipient: string
  subject?: string
  payload: unknown
  error: string
}): Promise<void> {
  await prisma.$transaction([
    prisma.deliveryLog.create({
      data: {
        proposalId: input.proposalId,
        provider: selectedDeliveryProvider(),
        channel: "email",
        recipient: input.recipient,
        subject: input.subject,
        status: "FAILED",
        error: input.error,
        payload: toJsonPayload(input.payload),
      },
    }),
    prisma.proposal.update({
      where: { id: input.proposalId },
      data: { status: "BLOCKED" },
    }),
    prisma.lead.update({
      where: { id: input.leadId },
      data: { status: "BLOCKED" },
    }),
  ])
}

async function approveProposalReview(input: {
  proposalId: string
  versionId: string
  decidedBy?: string
}): Promise<void> {
  const review = await loadRequestedReview(input)
  const blockingIssue = review.version.guardrails.find(
    (issue) => issue.severity === "BLOCKING"
  )
  const recipient = review.proposal.lead.email.trim()
  const proposalUrl = publicProposalUrl(review.proposal.publicToken)
  const rendered = renderApprovedProposalDelivery({
    leadName: review.proposal.lead.name,
    projectType: review.proposal.lead.projectType,
    proposalUrl,
    totalCents: review.version.totalCents,
  })

  if (blockingIssue) {
    const error = `Delivery blocked by guardrail ${blockingIssue.code}: ${blockingIssue.message}`
    await recordBlockedApproval({
      proposalId: review.proposalId,
      leadId: review.proposal.leadId,
      recipient: recipient || "missing-recipient",
      subject: rendered.subject,
      payload: {
        proposalUrl,
        versionId: review.versionId,
        blockingGuardrailId: blockingIssue.id,
      },
      error,
    })
    throw new Error(error)
  }

  if (!recipient) {
    const error = "Delivery blocked because lead email is missing"
    await recordBlockedApproval({
      proposalId: review.proposalId,
      leadId: review.proposal.leadId,
      recipient: "missing-recipient",
      subject: rendered.subject,
      payload: { proposalUrl, versionId: review.versionId },
      error,
    })
    throw new Error(error)
  }

  const decidedAt = new Date()
  await prisma.$transaction([
    prisma.proposalReview.update({
      where: { id: review.id },
      data: {
        status: "APPROVED",
        decidedAt,
        decidedBy: input.decidedBy,
      },
    }),
    prisma.proposal.update({
      where: { id: review.proposalId },
      data: { status: "APPROVED", approvedAt: decidedAt },
    }),
    prisma.lead.update({
      where: { id: review.proposal.leadId },
      data: { status: "APPROVED" },
    }),
  ])

  try {
    const result = await delivery.deliver({
      channel: "email",
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      proposalUrl,
      idempotencyKey: `proposal:${review.proposalId}:version:${review.versionId}`,
    })

    await prisma.$transaction([
      prisma.deliveryLog.create({
        data: {
          proposalId: review.proposalId,
          provider: result.provider,
          channel: result.channel,
          recipient,
          subject: rendered.subject,
          status: "DELIVERED",
          providerMessageId: result.messageId,
          payload: toJsonPayload({ proposalUrl, versionId: review.versionId }),
        },
      }),
      prisma.proposal.update({
        where: { id: review.proposalId },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      }),
      prisma.lead.update({
        where: { id: review.proposal.leadId },
        data: { status: "DELIVERED" },
      }),
    ])

    await crm.recordProposalDelivered({
      leadId: review.proposal.leadId,
      proposalId: review.proposalId,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Proposal delivery failed"
    await prisma.deliveryLog.create({
      data: {
        proposalId: review.proposalId,
        provider: selectedDeliveryProvider(),
        channel: "email",
        recipient,
        subject: rendered.subject,
        status: "FAILED",
        error: message,
        payload: toJsonPayload({ proposalUrl, versionId: review.versionId }),
      },
    })
    throw error
  }
}

async function rejectProposalReview(input: {
  proposalId: string
  versionId: string
  decidedBy?: string
}): Promise<void> {
  const review = await loadRequestedReview(input)
  const decidedAt = new Date()

  await prisma.$transaction([
    prisma.proposalReview.update({
      where: { id: review.id },
      data: {
        status: "REJECTED",
        decidedAt,
        decidedBy: input.decidedBy,
      },
    }),
    prisma.proposal.update({
      where: { id: review.proposalId },
      data: { status: "REJECTED" },
    }),
    prisma.lead.update({
      where: { id: review.proposal.leadId },
      data: { status: "REJECTED" },
    }),
  ])
}

export async function completeProposalReview(input: {
  proposalId: string
  versionId: string
  decision: "approved" | "rejected"
  decidedBy?: string
}): Promise<void> {
  if (input.decision === "approved") {
    await approveProposalReview(input)
    return
  }

  await rejectProposalReview(input)
}
