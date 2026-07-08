import type { GuardrailIssueView } from "@/lib/proposals/render-proposal"

type GuardrailListProps = {
  issues: GuardrailIssueView[]
}

const severityClassNames: Record<string, string> = {
  BLOCKING: "border-destructive/40 bg-destructive/10 text-destructive",
  WARNING:
    "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-100",
  INFO: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100",
}

export function GuardrailList({ issues }: GuardrailListProps) {
  return (
    <section
      className="rounded-2xl border bg-card p-6 shadow-sm"
      aria-labelledby="guardrails-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" id="guardrails-title">
            Guardrails
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal blockers and warnings from pricing validation.
          </p>
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-sm font-medium">
          {issues.length} issue{issues.length === 1 ? "" : "s"}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          No guardrail issues were raised for this version.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {issues.map((issue) => (
            <li
              className={`rounded-xl border p-4 ${
                severityClassNames[issue.severity] ?? severityClassNames.INFO
              }`}
              key={`${issue.severity}-${issue.code}-${issue.message}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">{issue.message}</p>
                <span className="text-xs font-bold tracking-wide uppercase">
                  {issue.severity}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs opacity-80">{issue.code}</p>
              {issue.metadata ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-background/80 p-3 text-xs text-foreground">
                  {JSON.stringify(issue.metadata, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
