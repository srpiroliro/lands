"use server"

import { after } from "next/server"

import {
  intakeFieldsSchema,
  parsePhotoFiles,
  validatePhotoFiles,
} from "@/lib/intake/schema"
import type { IntakeActionState } from "@/lib/intake/types"
import {
  processQueuedProposal,
  queueProposal,
} from "@/lib/engine/proposal-queue"

const initialFieldErrors: Record<string, string[]> = {}

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function dollarsToCents(amount?: number): number | null {
  if (amount === undefined) return null
  return Math.round(amount * 100)
}

export async function submitProposalIntake(
  _prevState: IntakeActionState,
  formData: FormData
): Promise<IntakeActionState> {
  const parsedFields = intakeFieldsSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    address: formString(formData, "address"),
    projectType: formString(formData, "projectType"),
    budgetMin: formString(formData, "budgetMin"),
    budgetMax: formString(formData, "budgetMax"),
    notes: formString(formData, "notes"),
  })

  const photos = parsePhotoFiles(formData)
  const photoErrors = validatePhotoFiles(photos)

  if (!parsedFields.success || photoErrors.length > 0) {
    return {
      ok: false,
      message:
        "Please fix the highlighted fields before generating a proposal.",
      errors: {
        ...(!parsedFields.success
          ? parsedFields.error.flatten().fieldErrors
          : initialFieldErrors),
        ...(photoErrors.length > 0
          ? { photos: photoErrors }
          : initialFieldErrors),
      },
    }
  }

  const fields = parsedFields.data
  if (
    fields.budgetMin !== undefined &&
    fields.budgetMax !== undefined &&
    fields.budgetMin > fields.budgetMax
  ) {
    return {
      ok: false,
      message: "Please fix the budget range before generating a proposal.",
      errors: { budgetMax: ["Budget max must be greater than budget min."] },
    }
  }

  const input = {
    name: fields.name,
    email: fields.email,
    phone: fields.phone ?? null,
    address: fields.address ?? null,
    projectType: fields.projectType,
    budgetMinCents: dollarsToCents(fields.budgetMin),
    budgetMaxCents: dollarsToCents(fields.budgetMax),
    notes: fields.notes,
  }

  try {
    const { jobId } = await queueProposal(input)

    after(async () => {
      try {
        await processQueuedProposal(jobId, photos)
      } catch (error) {
        console.error("Queued proposal generation failed", error)
      }
    })

    return {
      ok: true,
      message:
        "Proposal added to the queue successfully. You can submit another while it generates; Slack will notify you when it is ready.",
    }
  } catch (error) {
    console.error("Proposal queueing failed", error)
    return {
      ok: false,
      message:
        "We could not queue the proposal. Your form is still available; please try again.",
    }
  }
}
