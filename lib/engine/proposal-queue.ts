import crypto from "node:crypto"

import { prisma } from "@/lib/db"
import {
  createProposalForLead,
  finalizeProposalCreation,
} from "@/lib/engine/create-proposal"
import type { ProposalCreateResult } from "@/lib/engine/types"
import type { LeadIntakeInput } from "@/lib/intake/types"
import { media } from "@/lib/media"
import { review } from "@/lib/review"

const QUEUE_PROVIDER = "proposal-builder"
const QUEUE_EVENT_TYPE = "proposal-generation"
const LEASE_PREFIX = "lease:"
const LEASE_DURATION_MS = 10 * 60 * 1000
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown proposal queue error"
}

async function notifyJobFailure(jobId: string, message: string): Promise<void> {
  try {
    await review.postChannelMessage({
      text: `Proposal generation failed for queue job ${jobId}: ${message}`,
    })
  } catch (notificationError) {
    console.error(
      "Could not send proposal generation failure to Slack",
      notificationError
    )
  }
}

async function markJobFailed(jobId: string, error: unknown): Promise<void> {
  const message = errorMessage(error)

  try {
    await prisma.integrationEvent.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message },
    })
  } catch (updateError) {
    console.error("Could not record proposal generation failure", updateError)
  }

  await notifyJobFailure(jobId, message)
}

export async function queueProposal(
  input: LeadIntakeInput
): Promise<{ jobId: string }> {
  const leadId = crypto.randomUUID()
  const jobId = crypto.randomUUID()

  await prisma.$transaction([
    prisma.lead.create({
      data: {
        id: leadId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        projectType: input.projectType,
        budgetMinCents: input.budgetMinCents,
        budgetMaxCents: input.budgetMaxCents,
        notes: input.notes,
        status: "DRAFTING",
      },
    }),
    prisma.integrationEvent.create({
      data: {
        id: jobId,
        provider: QUEUE_PROVIDER,
        eventType: QUEUE_EVENT_TYPE,
        externalId: leadId,
        payload: { leadId },
        status: "UPLOADING",
      },
    }),
  ])

  try {
    const photoResults = await Promise.allSettled(
      input.photos.map((file) => media.saveLeadPhoto({ leadId, file }))
    )
    const storedPhotos = photoResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    )
    if (storedPhotos.length > 0) {
      await prisma.photo.createMany({
        data: storedPhotos.map((photo) => ({
          leadId,
          url: photo.url,
          downloadUrl: photo.downloadUrl,
          pathname: photo.pathname,
          contentType: photo.contentType,
          sizeBytes: photo.sizeBytes,
        })),
      })
    }

    const failedPhoto = photoResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )
    if (failedPhoto) throw failedPhoto.reason

    const queued = await prisma.integrationEvent.updateMany({
      where: { id: jobId, status: "UPLOADING" },
      data: { status: "QUEUED", error: null },
    })
    if (queued.count === 0) {
      throw new Error(`Upload job ${jobId} is no longer active`)
    }

    return { jobId }
  } catch (error) {
    await markJobFailed(jobId, error)
    throw error
  }
}

function leaseValue(now = Date.now()): string {
  return `${LEASE_PREFIX}${new Date(now + LEASE_DURATION_MS).toISOString()}`
}

function leaseExpired(value: string | null, now = Date.now()): boolean {
  if (!value?.startsWith(LEASE_PREFIX)) return true
  const expiresAt = Date.parse(value.slice(LEASE_PREFIX.length))
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

export async function processQueuedProposal(
  jobId: string
): Promise<ProposalCreateResult | null> {
  const job = await prisma.integrationEvent.findUnique({
    where: { id: jobId },
    select: { externalId: true },
  })
  const lease = leaseValue()
  const claimed = await prisma.integrationEvent.updateMany({
    where: {
      id: jobId,
      provider: QUEUE_PROVIDER,
      eventType: QUEUE_EVENT_TYPE,
      status: "QUEUED",
    },
    data: { status: "PROCESSING", error: lease },
  })

  if (claimed.count === 0) return null

  try {
    if (!job?.externalId) {
      throw new Error(`Proposal generation job ${jobId} has no lead`)
    }

    const result = await createProposalForLead(job.externalId)

    await prisma.integrationEvent.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", error: null },
    })

    return result
  } catch (error) {
    await markJobFailed(jobId, error)
    throw error
  }
}

type QueueJob = {
  id: string
  externalId: string | null
  status: string
  error: string | null
  createdAt: Date
}

type RecoveryResult = "active" | "requeued" | "succeeded" | "failed"

async function recoverProcessingJob(job: QueueJob): Promise<RecoveryResult> {
  if (!leaseExpired(job.error)) return "active"

  const recoveryLease = leaseValue()
  const claimed = await prisma.integrationEvent.updateMany({
    where: { id: job.id, status: "PROCESSING", error: job.error },
    data: { error: recoveryLease },
  })
  if (claimed.count === 0) return "active"

  const proposal = job.externalId
    ? await prisma.proposal.findFirst({
        where: { leadId: job.externalId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          currentVersionId: true,
          lead: {
            select: { id: true, name: true, email: true, phone: true },
          },
          reviews: {
            where: {
              slackMessageTs: { not: null },
              slackThreadTs: { not: null },
            },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null

  if (proposal?.currentVersionId && proposal.reviews.length > 0) {
    const blockingIssues = await prisma.guardrailIssue.count({
      where: {
        versionId: proposal.currentVersionId,
        severity: "BLOCKING",
      },
    })
    await finalizeProposalCreation({
      proposalId: proposal.id,
      leadId: proposal.lead.id,
      leadName: proposal.lead.name,
      leadEmail: proposal.lead.email,
      leadPhone: proposal.lead.phone,
      blocked: blockingIssues > 0,
    })

    const completed = await prisma.integrationEvent.updateMany({
      where: { id: job.id, status: "PROCESSING", error: recoveryLease },
      data: { status: "SUCCEEDED", error: null },
    })
    return completed.count > 0 ? "succeeded" : "active"
  }

  if (proposal) {
    const message =
      `Queue job ${job.id} was interrupted after proposal ${proposal.id} was persisted. ` +
      "Manual recovery is required to avoid a duplicate proposal or Slack message."
    const failed = await prisma.integrationEvent.updateMany({
      where: { id: job.id, status: "PROCESSING", error: recoveryLease },
      data: { status: "FAILED", error: message },
    })
    if (failed.count > 0) {
      await notifyJobFailure(job.id, message)
      return "failed"
    }
    return "active"
  }

  const requeued = await prisma.integrationEvent.updateMany({
    where: { id: job.id, status: "PROCESSING", error: recoveryLease },
    data: { status: "QUEUED", error: null },
  })
  return requeued.count > 0 ? "requeued" : "active"
}

export async function dispatchProposalQueue(
  limit = 3
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const jobs = await prisma.integrationEvent.findMany({
    where: {
      provider: QUEUE_PROVIDER,
      eventType: QUEUE_EVENT_TYPE,
      status: { in: ["UPLOADING", "QUEUED", "PROCESSING"] },
    },
    select: {
      id: true,
      externalId: true,
      status: true,
      error: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(limit * 5, limit),
  })

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const job of jobs) {
    if (processed >= limit) break

    if (job.status === "UPLOADING") {
      if (Date.now() - job.createdAt.getTime() < UPLOAD_TIMEOUT_MS) continue

      const message = "upload did not finish before its lease expired"
      const expired = await prisma.integrationEvent.updateMany({
        where: { id: job.id, status: "UPLOADING" },
        data: { status: "FAILED", error: message },
      })
      if (expired.count > 0) {
        await notifyJobFailure(job.id, message)
        processed += 1
        failed += 1
      }
      continue
    }

    if (job.status === "PROCESSING") {
      const recovery = await recoverProcessingJob(job)
      if (recovery === "active") continue
      if (recovery === "succeeded") {
        processed += 1
        succeeded += 1
        continue
      }
      if (recovery === "failed") {
        processed += 1
        failed += 1
        continue
      }
    }

    try {
      const result = await processQueuedProposal(job.id)
      if (!result) continue
      processed += 1
      succeeded += 1
    } catch {
      processed += 1
      failed += 1
    }
  }

  return { processed, succeeded, failed }
}
