import { notFound } from "next/navigation"

import { LineItemsTable } from "@/components/proposal/line-items-table"
import { ProposalSummary } from "@/components/proposal/proposal-summary"
import { PublicFeedbackForm } from "@/components/proposal/public-feedback-form"
import {
  formatMoneyCents,
  getPublicProposalView,
} from "@/lib/engine/render-proposal"

export const dynamic = "force-dynamic"

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const proposal = await getPublicProposalView(token)

  if (!proposal) notFound()

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Greenscape Pro
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Hi {proposal.lead.name}, here&apos;s your outdoor living proposal.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            Thank you for trusting Greenscape Pro with your{" "}
            {proposal.lead.projectType.toLowerCase()}. We focus on premium
            materials, clean job sites, and a finished space that looks as good
            in person as it does in photos.
          </p>
        </section>

        <ProposalSummary
          title="Proposal overview"
          clientName={proposal.lead.name}
          projectType={proposal.lead.projectType}
          totalCents={proposal.totalCents}
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <TextPanel
            title="Executive summary"
            body={proposal.currentVersion.executiveSummary}
          />
          <TextPanel
            title="Message from Marcus"
            body={proposal.currentVersion.customerMessage}
          />
        </section>

        <LineItemsTable items={proposal.lineItems} />

        <section className="grid gap-6 lg:grid-cols-2">
          <ListPanel
            title="Assumptions"
            emptyText="No special assumptions were included in this draft."
            items={proposal.currentVersion.assumptions}
          />
          <ListPanel
            title="Next steps"
            emptyText="Approve the scope and we will prepare the deposit invoice and schedule details."
            items={
              proposal.currentVersion.unknowns.length > 0
                ? proposal.currentVersion.unknowns.map(
                    (unknown) => `Confirm: ${unknown}`
                  )
                : [
                    "Approve the proposal scope.",
                    "Pay the 50% deposit invoice.",
                    "Finalize HOA or permit requirements if applicable.",
                    "Confirm the target start window with Jenna.",
                  ]
            }
          />
        </section>

        <section className="rounded-2xl border bg-primary p-6 text-primary-foreground shadow-sm">
          <h2 className="text-2xl font-semibold">Estimated investment</h2>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatMoneyCents(proposal.totalCents)}
          </p>
          <p className="mt-4 max-w-3xl leading-7 text-primary-foreground/80">
            This proposal is built from Greenscape Pro&apos;s pricing catalog
            and your site-walk details. Final scheduling starts after approval,
            deposit, and any HOA or permit requirements.
          </p>
        </section>

        <PublicFeedbackForm token={token} />
      </div>
    </main>
  )
}

type TextPanelProps = {
  title: string
  body: string
}

function TextPanel({ title, body }: TextPanelProps) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
        {body}
      </p>
    </section>
  )
}

type ListPanelProps = {
  title: string
  items: string[]
  emptyText: string
}

function ListPanel({ title, items, emptyText }: ListPanelProps) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
          {items.map((item) => (
            <li className="flex gap-3" key={item}>
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 rounded-full bg-primary"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  )
}
