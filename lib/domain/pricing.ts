import type { MoneyCents, PricingCatalogItem } from "@/lib/domain/types"

export function toCents(amount: number): MoneyCents {
  return Math.round(amount * 100)
}

export function formatDollars(cents: MoneyCents): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function indexPricingItems<
  T extends Pick<PricingCatalogItem, "sku" | "active">,
>(items: T[]): Map<string, T> {
  return new Map(
    items.filter((item) => item.active).map((item) => [item.sku, item])
  )
}
