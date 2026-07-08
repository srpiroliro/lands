import type { PricingCatalogForModel } from "@/lib/domain/types"
import type { LeadIntakeInput } from "@/lib/intake/types"
import type {
  MeasurementAuditResult,
  ProposalDraft,
} from "@/lib/proposals/types"

export type ProposalAiDraftInput = {
  lead: Omit<LeadIntakeInput, "photos">
  photoUrls: string[]
  pricingCatalog: PricingCatalogForModel[]
}

export type ProposalAiRevisionInput = ProposalAiDraftInput & {
  previousDraft: ProposalDraft
  revisionInstructions: string
}

export type MeasurementAuditInput = ProposalAiDraftInput & {
  draft: ProposalDraft
}

export interface ProposalAiPlugin {
  draftProposal(input: ProposalAiDraftInput): Promise<ProposalDraft>
  reviseProposal(input: ProposalAiRevisionInput): Promise<ProposalDraft>
  auditMeasurements(
    input: MeasurementAuditInput
  ): Promise<MeasurementAuditResult>
}
