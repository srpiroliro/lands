import type { MoneyCents } from "@/lib/domain/types"

export type LeadIntakeInput = {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  projectType: string
  budgetMinCents?: MoneyCents | null
  budgetMaxCents?: MoneyCents | null
  notes: string
  photos: File[]
}

export type IntakeActionState = {
  ok: boolean
  message: string
  errors?: Record<string, string[]>
}
