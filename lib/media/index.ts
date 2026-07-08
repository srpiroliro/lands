import type { MediaPlugin } from "@/lib/media/types"
import { vercelBlobMediaPlugin } from "@/lib/media/plugins/vercel-blob"

export const media: MediaPlugin = vercelBlobMediaPlugin
