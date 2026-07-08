import Link from "next/link"
import { notFound } from "next/navigation"

import { GuardrailList } from "@/components/proposal/guardrail-list"
import { LineItemsTable } from "@/components/proposal/line-items-table"
import { ProposalSummary } from "@/components/proposal/proposal-summary"
import {
  formatMoneyCents,
  formatPercent,
  getInternalProposalView,
} from "@/lib/engine/render-proposal"

export const dynamic = "force-dynamic"

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const proposal = await getInternalProposalView(id)

  if (!proposal) notFound()

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <Link
          className="inline-flex text-sm text-muted-foreground underline underline-offset-4 focus:ring-3 focus:ring-ring/40 focus:outline-none"
          href="/"
        >
          Back to intake
        </Link>

        <ProposalSummary
          title={`${proposal.lead.name} proposal draft`}
          clientName={proposal.lead.name}
          projectType={proposal.lead.projectType}
          totalCents={proposal.totalCents}
          status={proposal.status}
          versionNumber={proposal.currentVersion.versionNumber}
          confidence={proposal.confidence}
          publicUrl={proposal.publicUrl}
        />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold">Lead info</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail label="Email" value={proposal.lead.email} />
              <Detail
                label="Phone"
                value={proposal.lead.phone ?? "Not provided"}
              />
              <Detail
                label="Address"
                value={proposal.lead.address ?? "Not provided"}
              />
              <Detail
                label="Lead status"
                value={proposal.lead.status.replaceAll("_", " ")}
              />
              <Detail
                label="Budget min"
                value={
                  proposal.lead.budgetMinCents === null
                    ? "Not provided"
                    : formatMoneyCents(proposal.lead.budgetMinCents)
                }
              />
              <Detail
                label="Budget max"
                value={
                  proposal.lead.budgetMaxCents === null
                    ? "Not provided"
                    : formatMoneyCents(proposal.lead.budgetMaxCents)
                }
              />
            </dl>
            <div className="mt-5 rounded-xl border bg-muted/40 p-4">
              <h3 className="font-medium">Internal site-walk notes</h3>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                {proposal.lead.notes}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Slack review</h2>
            {proposal.review ? (
              <dl className="mt-4 space-y-3 text-sm">
                <Detail
                  label="Status"
                  value={proposal.review.status.replaceAll("_", " ")}
                />
                <Detail label="Channel" value={proposal.review.channel} />
                <Detail
                  label="Slack channel ID"
                  value={proposal.review.slackChannelId ?? "Not recorded"}
                />
                <Detail
                  label="Slack message TS"
                  value={proposal.review.slackMessageTs ?? "Not recorded"}
                />
                <Detail
                  label="Slack thread TS"
                  value={proposal.review.slackThreadTs ?? "Not recorded"}
                />
                <Detail
                  label="Requested"
                  value={proposal.review.requestedAt.toLocaleString("en-US")}
                />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No Slack review was requested. Blocked drafts stop before Slack.
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border bg-card p-6 shadow-sm"
          aria-labelledby="draft-title"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold" id="draft-title">
                Current version
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Version {proposal.currentVersion.versionNumber} · confidence{" "}
                {formatPercent(proposal.currentVersion.confidence)} · total{" "}
                {formatMoneyCents(proposal.currentVersion.totalCents)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Created{" "}
              {proposal.currentVersion.createdAt.toLocaleString("en-US")}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <TextPanel
              title="Executive summary"
              body={proposal.currentVersion.executiveSummary}
            />
            <TextPanel
              title="Customer message"
              body={proposal.currentVersion.customerMessage}
            />
          </div>

          {proposal.currentVersion.renderBrief ? (
            <div className="mt-5 rounded-xl border bg-muted/40 p-4">
              <h3 className="font-medium">Render brief</h3>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
                {proposal.currentVersion.renderBrief}
              </p>
            </div>
          ) : null}
        </section>

        <GuardrailList issues={proposal.guardrails} />
        <LineItemsTable
          items={proposal.lineItems}
          showReviewRequired
          showInternalNotes
        />
      </div>
    </main>
  )
}

type DetailProps = {
  label: string
  value: string
}

function Detail({ label, value }: DetailProps) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium capitalize">{value}</dd>
    </div>
  )
}

type TextPanelProps = {
  title: string
  body: string
}

function TextPanel({ title, body }: TextPanelProps) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
        {body}
      </p>
    </div>
  )
}
