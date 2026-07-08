import {
  formatMoneyCents,
  formatPercent,
} from "@/lib/proposals/render-proposal"

type ProposalSummaryProps = {
  title: string
  clientName: string
  projectType: string
  totalCents: number
  status?: string
  versionNumber?: number
  confidence?: number
  publicUrl?: string
}

export function ProposalSummary({
  title,
  clientName,
  projectType,
  totalCents,
  status,
  versionNumber,
  confidence,
  publicUrl,
}: ProposalSummaryProps) {
  return (
    <section
      className="rounded-2xl border bg-card p-6 shadow-sm"
      aria-labelledby="proposal-summary-title"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Proposal summary
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight"
            id="proposal-summary-title"
          >
            {title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {clientName} · {projectType}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-80">
          <SummaryMetric label="Total" value={formatMoneyCents(totalCents)} />
          {status ? (
            <SummaryMetric label="Status" value={status.replaceAll("_", " ")} />
          ) : null}
          {versionNumber ? (
            <SummaryMetric label="Version" value={`v${versionNumber}`} />
          ) : null}
          {confidence !== undefined ? (
            <SummaryMetric
              label="AI confidence"
              value={formatPercent(confidence)}
            />
          ) : null}
        </div>
      </div>

      {publicUrl ? (
        <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Public customer URL</p>
          <a
            className="mt-1 inline-flex break-all text-primary underline underline-offset-4 focus:ring-3 focus:ring-ring/40 focus:outline-none"
            href={publicUrl}
          >
            {publicUrl}
          </a>
        </div>
      ) : null}
    </section>
  )
}

type SummaryMetricProps = {
  label: string
  value: string
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold capitalize">{value}</p>
    </div>
  )
}
