import type { GuardrailIssueView } from "@/lib/engine/render-proposal"

type GuardrailListProps = {
  issues: GuardrailIssueView[]
}

type IssueAccordionProps = {
  emptyMessage: string
  issues: GuardrailIssueView[]
  title: string
}

function IssueAccordion({ emptyMessage, issues, title }: IssueAccordionProps) {
  return (
    <details className="group rounded-xl border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {issues.length}
          </span>
          <span
            className="text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      </summary>
      <div className="border-t px-4 py-3">
        {issues.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
            {issues.map((issue, index) => (
              <li key={`${issue.message}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </details>
  )
}

export function GuardrailList({ issues }: GuardrailListProps) {
  const blockers = issues.filter((issue) => issue.severity === "BLOCKING")
  const warnings = issues.filter((issue) => issue.severity === "WARNING")

  return (
    <section
      className="rounded-2xl border bg-card p-6 shadow-sm"
      aria-labelledby="guardrails-title"
    >
      <div>
        <h2 className="text-xl font-semibold" id="guardrails-title">
          Guardrails
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the current blockers and warnings for this proposal.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <IssueAccordion
          title="Blockers"
          issues={blockers}
          emptyMessage="No blockers."
        />
        <IssueAccordion
          title="Warnings"
          issues={warnings}
          emptyMessage="No warnings."
        />
      </div>
    </section>
  )
}
