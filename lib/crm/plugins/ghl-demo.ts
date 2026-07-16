import type { Prisma } from "@prisma/client"

import type { CrmPlugin } from "@/lib/crm/types"
import { prisma } from "@/lib/db"

type GhlDemoEventType =
  "upsertLead" | "attachProposalLink" | "recordProposalDelivered"

function toJsonPayload(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
}

async function recordIntegrationEvent(input: {
  eventType: GhlDemoEventType
  externalId?: string
  payload: unknown
}): Promise<void> {
  const existing = await prisma.integrationEvent.findFirst({
    where: {
      provider: "ghl-demo",
      eventType: input.eventType,
      externalId: input.externalId ?? null,
    },
    select: { id: true },
  })
  if (existing) return

  await prisma.integrationEvent.create({
    data: {
      provider: "ghl-demo",
      eventType: input.eventType,
      externalId: input.externalId,
      payload: toJsonPayload(input.payload),
      status: "skipped",
    },
  })
}

export const ghlDemoCrmPlugin: CrmPlugin = {
  upsertLead(input) {
    return recordIntegrationEvent({
      eventType: "upsertLead",
      externalId: input.leadId,
      payload: input,
    })
  },

  attachProposalLink(input) {
    return recordIntegrationEvent({
      eventType: "attachProposalLink",
      externalId: input.proposalId,
      payload: input,
    })
  },

  recordProposalDelivered(input) {
    return recordIntegrationEvent({
      eventType: "recordProposalDelivered",
      externalId: input.proposalId,
      payload: input,
    })
  },
}
