import type { ProposalLineItemView } from "@/lib/engine/render-proposal"
import { formatMoneyCents } from "@/lib/engine/render-proposal"

type LineItemsTableProps = {
  items: ProposalLineItemView[]
  showReviewRequired?: boolean
  showInternalNotes?: boolean
}

export function LineItemsTable({
  items,
  showReviewRequired = false,
  showInternalNotes = false,
}: LineItemsTableProps) {
  return (
    <section
      className="rounded-2xl border bg-card p-6 shadow-sm"
      aria-labelledby="line-items-title"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold" id="line-items-title">
            Line items
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalog-backed scope and pricing for the current proposal version.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                Category
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Item
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Qty
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Unit
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Unit price
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Total
              </th>
              {showReviewRequired ? (
                <th className="px-4 py-3 font-semibold" scope="col">
                  Review
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={`${item.sku}-${item.name}`} className="align-top">
                <td className="px-4 py-4 text-muted-foreground">
                  {item.category}
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  {showInternalNotes && item.notes ? (
                    <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                      Internal note: {item.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 text-muted-foreground">{item.unit}</td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {formatMoneyCents(item.unitPriceCents)}
                </td>
                <td className="px-4 py-4 text-right font-semibold tabular-nums">
                  {formatMoneyCents(item.totalCents)}
                </td>
                {showReviewRequired ? (
                  <td className="px-4 py-4">
                    {item.reviewRequired ? (
                      <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-100">
                        Clear
                      </span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
