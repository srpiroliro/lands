import type { ReviewPlugin } from "@/lib/review/types"
import { slackReviewPlugin } from "@/lib/review/plugins/slack"

export const review: ReviewPlugin = slackReviewPlugin
