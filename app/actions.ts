"use server"

import {
  intakeFieldsSchema,
  parsePhotoFiles,
  validatePhotoFiles,
} from "@/lib/intake/schema"
import type { IntakeActionState } from "@/lib/intake/types"
import { createProposal } from "@/lib/proposals/create-proposal"

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

  try {
    const result = await createProposal({
      name: fields.name,
      email: fields.email,
      phone: fields.phone ?? null,
      address: fields.address ?? null,
      projectType: fields.projectType,
      budgetMinCents: dollarsToCents(fields.budgetMin),
      budgetMaxCents: dollarsToCents(fields.budgetMax),
      notes: fields.notes,
      photos,
    })

    return {
      ok: true,
      proposalId: result.proposalId,
      message: result.blocked
        ? "Proposal draft created but blocked by guardrails. Review it before sending."
        : "Proposal draft created and sent to Slack for review.",
    }
  } catch (error) {
    console.error("Proposal intake failed", error)
    return {
      ok: false,
      message:
        "We could not generate the proposal draft. Please try again or review the integration settings.",
    }
  }
}
