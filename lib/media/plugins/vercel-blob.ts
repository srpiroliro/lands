import crypto from "node:crypto"

import { put } from "@vercel/blob"

import type { MediaPlugin } from "@/lib/media/types"

function safeBlobFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "upload"
}

export const vercelBlobMediaPlugin: MediaPlugin = {
  async saveLeadPhoto({ leadId, file }) {
    const safeFileName = safeBlobFileName(file.name)
    const path = `leads/${leadId}/${crypto.randomUUID()}-${safeFileName}`
    const blob = await put(path, file, { access: "public", contentType: file.type })

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
      sizeBytes: file.size,
    }
  },
}
