import { z } from "zod"

export const intakeFieldsSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  projectType: z.string().min(2),
  budgetMin: z.coerce.number().nonnegative().optional(),
  budgetMax: z.coerce.number().nonnegative().optional(),
  notes: z.string().min(20),
})

export function parsePhotoFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0)
}

export function validatePhotoFiles(files: File[]): string[] {
  const errors: string[] = []
  if (files.length === 0) errors.push("Upload at least one site photo.")
  if (files.length > 8) errors.push("Upload no more than 8 photos.")

  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      errors.push(`${file.name} must be a JPG, PNG, or WebP image.`)
    }
    if (file.size > 10 * 1024 * 1024) {
      errors.push(`${file.name} must be under 10MB.`)
    }
  }

  return errors
}
