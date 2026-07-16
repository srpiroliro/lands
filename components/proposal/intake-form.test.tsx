// @vitest-environment jsdom

import type { ComponentProps } from "react"
import { act } from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { IntakeForm } from "@/components/proposal/intake-form"
import type { IntakeActionState } from "@/lib/intake/types"

const mocks = vi.hoisted(() => ({
  submitProposalIntake: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/app/actions", () => ({
  submitProposalIntake: mocks.submitProposalIntake,
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Client name"), {
    target: { value: "Avery Stone" },
  })
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "avery@example.test" },
  })
  fireEvent.change(screen.getByLabelText("Project type"), {
    target: { value: "Patio or pavers" },
  })
  fireEvent.change(screen.getByLabelText("Site-walk notes"), {
    target: {
      value: "Replace the patio pavers and improve drainage along the house.",
    },
  })
  fireEvent.change(screen.getByLabelText("Site photos"), {
    target: {
      files: [new File(["photo"], "site.webp", { type: "image/webp" })],
    },
  })
}

function intakeForm(): HTMLFormElement {
  const form = screen.getByText("Site-walk intake").closest("form")
  if (!(form instanceof HTMLFormElement)) throw new Error("Form not found")
  return form
}

describe("IntakeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows queue success immediately and allows another submission", async () => {
    const submission = deferred<IntakeActionState>()
    mocks.submitProposalIntake.mockReturnValue(submission.promise)
    render(<IntakeForm />)
    fillRequiredFields()

    fireEvent.submit(intakeForm())

    expect(
      screen.getByText(/Proposal added to the queue successfully/)
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: "Add proposal to queue",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
    expect(
      (screen.getByLabelText("Client name") as HTMLInputElement).value
    ).toBe("Avery Stone")

    fireEvent.submit(intakeForm())
    expect(mocks.submitProposalIntake).toHaveBeenCalledTimes(2)

    await act(async () => {
      submission.resolve({
        ok: true,
        message:
          "Proposal added to the queue successfully. You can submit another while it generates; Slack will notify you when it is ready.",
      })
      await submission.promise
    })
  })

  it("reconciles a server error without clearing entered values", async () => {
    mocks.submitProposalIntake.mockResolvedValue({
      ok: false,
      message: "We could not queue the proposal. Please try again.",
    })
    render(<IntakeForm />)
    fillRequiredFields()

    fireEvent.submit(intakeForm())

    expect(
      screen.getByText(/Proposal added to the queue successfully/)
    ).toBeTruthy()
    await waitFor(() => {
      expect(
        screen.getByText("We could not queue the proposal. Please try again.")
      ).toBeTruthy()
    })
    expect(
      (screen.getByLabelText("Client name") as HTMLInputElement).value
    ).toBe("Avery Stone")
    expect(
      (screen.getByLabelText("Site-walk notes") as HTMLTextAreaElement).value
    ).toContain("improve drainage")
  })
})
