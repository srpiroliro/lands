import { formatMoneyCents } from "@/lib/engine/render-proposal"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function renderApprovedProposalDelivery(input: {
  leadName: string
  projectType: string
  proposalUrl: string
  totalCents: number
}): { subject: string; html: string; text: string } {
  const formattedTotal = formatMoneyCents(input.totalCents)
  const safeLeadName = escapeHtml(input.leadName)
  const safeProjectType = escapeHtml(input.projectType)
  const safeProposalUrl = escapeHtml(input.proposalUrl)
  const subject = `Your Greenscape Pro ${input.projectType} proposal`

  const text = [
    `Hi ${input.leadName},`,
    "",
    `I put together the proposal for your ${input.projectType} project. The current project total is ${formattedTotal}.`,
    "",
    `You can review the full proposal here: ${input.proposalUrl}`,
    "",
    "Take a look when you have a few minutes. If anything feels off, reply back and we will tighten it up.",
    "",
    "Marcus",
    "Greenscape Pro",
  ].join("\n")

  const html = `
    <p>Hi ${safeLeadName},</p>
    <p>I put together the proposal for your ${safeProjectType} project. The current project total is <strong>${formattedTotal}</strong>.</p>
    <p><a href="${safeProposalUrl}">Review the full proposal</a></p>
    <p>Take a look when you have a few minutes. If anything feels off, reply back and we will tighten it up.</p>
    <p>Marcus<br />Greenscape Pro</p>
  `.trim()

  return { subject, html, text }
}
