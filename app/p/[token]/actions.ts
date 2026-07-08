"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { prisma } from "@/lib/db"
import { reviseProposalFromFeedback } from "@/lib/engine/revise-proposal"

export type PublicProposalFeedbackState = {
  ok: boolean
  message: string
  errors?: Record<string, string[]>
}

const feedbackSchema = z.object({
  token: z.string().min(1),
  instructions: z
    .string()
    .trim()
    .min(10, "Please add at least 10 characters of feedback.")
    .max(2000, "Please keep feedback under 2,000 characters."),
})

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

export async function submitPublicProposalFeedback(
  _prevState: PublicProposalFeedbackState,
  formData: FormData
): Promise<PublicProposalFeedbackState> {
  const parsed = feedbackSchema.safeParse({
    token: formString(formData, "token"),
    instructions: formString(formData, "instructions"),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the feedback before submitting.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: parsed.data.token },
    select: { id: true },
  })

  if (!proposal) {
    return {
      ok: false,
      message:
        "We could not find this proposal. Please check the link and try again.",
    }
  }

  try {
    await reviseProposalFromFeedback({
      proposalId: proposal.id,
      instructions: parsed.data.instructions,
      source: "public-proposal-page",
    })

    revalidatePath(`/p/${parsed.data.token}`)

    return {
      ok: true,
      message:
        "Thanks — we revised the proposal with your feedback. Review the updated version above.",
    }
  } catch {
    return {
      ok: false,
      message:
        "We could not apply that feedback right now. Please try again or contact Greenscape Pro directly.",
    }
  }
}
