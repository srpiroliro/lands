import { IntakeForm } from "@/components/proposal/intake-form"

const architectureSteps = [
  "Photos",
  "Vision",
  "Pricing catalog",
  "Guardrails",
  "Slack review",
  "Delivery",
]

export default function Page() {
  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Greenscape Pro
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Greenscape Proposal Builder
          </h1>
          <p className="mt-5 text-xl leading-8 text-muted-foreground">
            Turn site-walk notes and photos into a proposal draft in minutes.
          </p>
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Built for Marcus&apos;s quote bottleneck
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Capture the site-walk context once, let AI draft the scope from
              the pricing catalog, and keep internal review in Slack before
              anything reaches the client.
            </p>
          </div>
        </div>

        <IntakeForm />
      </section>

      <section
        className="border-y bg-muted/30"
        aria-labelledby="architecture-title"
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h2 className="sr-only" id="architecture-title">
            Proposal architecture
          </h2>
          <ol className="grid gap-3 text-sm font-medium sm:grid-cols-2 lg:grid-cols-6">
            {architectureSteps.map((step, index) => (
              <li
                className="rounded-xl border bg-background p-4 shadow-sm"
                key={step}
              >
                <span className="text-xs text-muted-foreground">
                  0{index + 1}
                </span>
                <p className="mt-1">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Photos → Vision → Pricing catalog → Guardrails → Slack review →
            Delivery
          </p>
        </div>
      </section>
    </main>
  )
}
