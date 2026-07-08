"use client"

import { useActionState } from "react"

import {
  submitPublicProposalFeedback,
  type PublicProposalFeedbackState,
} from "@/app/p/[token]/actions"
import { Button } from "@/components/ui/button"

const initialState: PublicProposalFeedbackState = {
  ok: false,
  message: "",
}

const textareaClassName =
  "mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition outline-none focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"

export function PublicFeedbackForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    submitPublicProposalFeedback,
    initialState
  )

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Need a change?</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Tell us what to adjust. We&apos;ll revise the proposal using your notes
        and route the updated draft back through internal review.
      </p>

      {state.message ? (
        <div
          className={
            state.ok
              ? "mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100"
              : "mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          }
          role="status"
          aria-live="polite"
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4">
        <input name="token" type="hidden" value={token} />
        <div>
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="instructions"
          >
            Feedback for Marcus
          </label>
          <textarea
            className={`${textareaClassName} min-h-32 resize-y`}
            id="instructions"
            name="instructions"
            minLength={10}
            maxLength={2000}
            required
            placeholder="Example: Please remove the fire pit, increase the paver patio to 650 sq ft, and keep the total closer to $55k."
            aria-describedby="feedback-help feedback-error"
            disabled={pending}
          />
          <p className="mt-1 text-xs text-muted-foreground" id="feedback-help">
            Be specific about scope, quantities, budget, materials, or timeline.
          </p>
          {state.errors?.instructions ? (
            <p className="mt-1 text-sm text-destructive" id="feedback-error">
              {state.errors.instructions.join(" ")}
            </p>
          ) : (
            <span id="feedback-error" />
          )}
        </div>
        <Button
          className="h-11 w-full text-base"
          type="submit"
          disabled={pending}
        >
          {pending ? "Revising proposal…" : "Submit feedback and revise"}
        </Button>
      </form>
    </section>
  )
}
