"use client"

import { useActionState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

import { submitProposalIntake } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  demoIntakeDefaults,
  shouldPrefillDemoIntake,
} from "@/lib/intake/demo-prefill"
import type { IntakeActionState } from "@/lib/intake/types"

const initialState: IntakeActionState = {
  ok: false,
  message: "",
}

const inputClassName =
  "mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition outline-none file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
const labelClassName = "text-sm font-medium text-foreground"
const helpClassName = "mt-1 text-xs text-muted-foreground"
const errorClassName = "mt-1 text-sm text-destructive"

type FieldErrorProps = {
  errors?: string[]
}

function FieldError({ errors }: FieldErrorProps) {
  if (!errors || errors.length === 0) return null

  return (
    <p className={errorClassName} role="alert">
      {errors.join(" ")}
    </p>
  )
}

export function IntakeForm() {
  const searchParams = useSearchParams()
  const intakeDefaults = shouldPrefillDemoIntake(searchParams)
    ? demoIntakeDefaults
    : null
  const [state, formAction, pending] = useActionState(
    submitProposalIntake,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  return (
    <form
      action={formAction}
      ref={formRef}
      className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold">Site-walk intake</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the lead details, Marcus&apos;s notes, and site photos to draft a
          reviewed proposal.
        </p>
      </div>

      {state.message ? (
        <div
          className={
            state.ok
              ? "rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100"
              : "rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          }
          role="status"
          aria-live="polite"
        >
          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="name">
            Client name
          </label>
          <input
            className={inputClassName}
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={intakeDefaults?.name ?? ""}
            aria-describedby="name-error"
          />
          <div id="name-error">
            <FieldError errors={state.errors?.name} />
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="email">
            Email
          </label>
          <input
            className={inputClassName}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={intakeDefaults?.email ?? ""}
            aria-describedby="email-error"
          />
          <div id="email-error">
            <FieldError errors={state.errors?.email} />
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="phone">
            Phone
          </label>
          <input
            className={inputClassName}
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={intakeDefaults?.phone ?? ""}
            aria-describedby="phone-error"
          />
          <div id="phone-error">
            <FieldError errors={state.errors?.phone} />
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="address">
            Address
          </label>
          <input
            className={inputClassName}
            id="address"
            name="address"
            autoComplete="street-address"
            defaultValue={intakeDefaults?.address ?? ""}
            aria-describedby="address-error"
          />
          <div id="address-error">
            <FieldError errors={state.errors?.address} />
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="projectType">
            Project type
          </label>
          <select
            className={inputClassName}
            id="projectType"
            name="projectType"
            required
            defaultValue={intakeDefaults?.projectType ?? ""}
            aria-describedby="projectType-error"
          >
            <option value="" disabled>
              Select a project type
            </option>
            <option value="Full outdoor living renovation">
              Full outdoor living renovation
            </option>
            <option value="Patio or pavers">Patio or pavers</option>
            <option value="Pergola or shade structure">
              Pergola or shade structure
            </option>
            <option value="Outdoor kitchen">Outdoor kitchen</option>
            <option value="Artificial turf and landscape">
              Artificial turf and landscape
            </option>
            <option value="Irrigation and drainage">
              Irrigation and drainage
            </option>
            <option value="Water or fire feature">Water or fire feature</option>
          </select>
          <div id="projectType-error">
            <FieldError errors={state.errors?.projectType} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClassName} htmlFor="budgetMin">
              Budget min
            </label>
            <input
              className={inputClassName}
              id="budgetMin"
              name="budgetMin"
              type="number"
              min="0"
              step="100"
              inputMode="decimal"
              placeholder="25000"
              defaultValue={intakeDefaults?.budgetMin ?? ""}
              aria-describedby="budgetMin-help budgetMin-error"
            />
            <p className={helpClassName} id="budgetMin-help">
              Dollars
            </p>
            <div id="budgetMin-error">
              <FieldError errors={state.errors?.budgetMin} />
            </div>
          </div>

          <div>
            <label className={labelClassName} htmlFor="budgetMax">
              Budget max
            </label>
            <input
              className={inputClassName}
              id="budgetMax"
              name="budgetMax"
              type="number"
              min="0"
              step="100"
              inputMode="decimal"
              placeholder="45000"
              defaultValue={intakeDefaults?.budgetMax ?? ""}
              aria-describedby="budgetMax-help budgetMax-error"
            />
            <p className={helpClassName} id="budgetMax-help">
              Dollars
            </p>
            <div id="budgetMax-error">
              <FieldError errors={state.errors?.budgetMax} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClassName} htmlFor="notes">
          Site-walk notes
        </label>
        <textarea
          className={`${inputClassName} min-h-40 resize-y`}
          id="notes"
          name="notes"
          required
          minLength={20}
          placeholder="Summarize scope, measurements, materials, drainage constraints, HOA concerns, and customer priorities."
          defaultValue={intakeDefaults?.notes ?? ""}
          aria-describedby="notes-help notes-error"
        />
        <p className={helpClassName} id="notes-help">
          Include enough detail for the AI to choose catalog items and flag
          unknowns.
        </p>
        <div id="notes-error">
          <FieldError errors={state.errors?.notes} />
        </div>
      </div>

      <div>
        <label className={labelClassName} htmlFor="photos">
          Site photos
        </label>
        <input
          className={inputClassName}
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          aria-describedby="photos-help photos-error"
        />
        <p className={helpClassName} id="photos-help">
          Upload 1–8 JPG, PNG, or WebP photos under 10MB each.
        </p>
        <div id="photos-error">
          <FieldError errors={state.errors?.photos} />
        </div>
      </div>

      <Button
        className="h-11 w-full text-base"
        type="submit"
        disabled={pending}
      >
        {pending ? "Queueing proposal…" : "Queue proposal draft"}
      </Button>
    </form>
  )
}
