export interface CrmPlugin {
  upsertLead(input: { leadId: string; name: string; email: string; phone?: string | null }): Promise<void>
  attachProposalLink(input: { leadId: string; proposalId: string; url: string }): Promise<void>
  recordProposalDelivered(input: { leadId: string; proposalId: string }): Promise<void>
}
