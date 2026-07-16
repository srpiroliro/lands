import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GuardrailList } from "@/components/proposal/guardrail-list"

const issues = [
  {
    severity: "BLOCKING",
    code: "NO_SCALE_REFERENCE",
    message: "Confirm the patio measurement.",
    metadata: { privateDetail: "blocking metadata" },
  },
  {
    severity: "BLOCKING",
    code: "LOW_DRAFT_CONFIDENCE",
    message: "Review the draft quantities.",
  },
  {
    severity: "WARNING",
    code: "RENDER_REQUIRED",
    message: "Add a render before delivery.",
    metadata: { privateDetail: "warning metadata" },
  },
  {
    severity: "INFO",
    code: "INTERNAL_INFO",
    message: "Internal informational note.",
  },
]

describe("GuardrailList", () => {
  it("renders closed, neutral accordions with grouped counts and messages only", () => {
    const html = renderToStaticMarkup(<GuardrailList issues={issues} />)

    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/)
    expect(html).toMatch(
      /<summary[^>]*>.*<span>Blockers<\/span>.*>2<\/span>.*<\/summary>/
    )
    expect(html).toMatch(
      /<summary[^>]*>.*<span>Warnings<\/span>.*>1<\/span>.*<\/summary>/
    )
    expect(html).toContain("Confirm the patio measurement.")
    expect(html).toContain("Review the draft quantities.")
    expect(html).toContain("Add a render before delivery.")
    expect(html).not.toContain("Internal informational note.")
    expect(html).not.toContain("NO_SCALE_REFERENCE")
    expect(html).not.toContain("RENDER_REQUIRED")
    expect(html).not.toContain("blocking metadata")
    expect(html).not.toContain("warning metadata")
    expect(html).not.toMatch(/destructive|yellow|red-/)
  })

  it("shows zero counts and empty messages when there are no issues", () => {
    const html = renderToStaticMarkup(<GuardrailList issues={[]} />)

    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html.match(/>0<\/span>/g)).toHaveLength(2)
    expect(html).toContain("No blockers.")
    expect(html).toContain("No warnings.")
  })
})
