import crypto from "node:crypto"

import { prisma } from "@/lib/db"
import { createProposalForLead } from "@/lib/engine/create-proposal"
import type { ProposalCreateResult } from "@/lib/engine/types"
import type { LeadIntakeInput } from "@/lib/intake/types"
import { media } from "@/lib/media"
import { review } from "@/lib/review"

const QUEUE_PROVIDER = "proposal-builder"
const QUEUE_EVENT_TYPE = "proposal-generation"

type QueuedLeadInput = Omit<LeadIntakeInput, "photos">

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
  input: QueuedLeadInput
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
        status: "QUEUED",
      },
    }),
  ])

  return { jobId }
}

export async function processQueuedProposal(
  jobId: string,
  photos: File[]
): Promise<ProposalCreateResult | null> {
  try {
    const job = await prisma.integrationEvent.findUnique({
      where: { id: jobId },
      select: { externalId: true },
    })
    const claimed = await prisma.integrationEvent.updateMany({
      where: {
        id: jobId,
        provider: QUEUE_PROVIDER,
        eventType: QUEUE_EVENT_TYPE,
        status: "QUEUED",
      },
      data: { status: "PROCESSING", error: null },
    })

    if (claimed.count === 0) return null

    if (!job?.externalId) {
      throw new Error(`Proposal generation job ${jobId} has no lead`)
    }

    const leadId = job.externalId
    const photoResults = await Promise.allSettled(
      photos.map((file) => media.saveLeadPhoto({ leadId, file }))
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

    const result = await createProposalForLead(leadId)

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
