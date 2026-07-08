export const demoIntakeDefaults = {
  name: "Julio Martinez",
  email: "julio.martinez@example.com",
  phone: "602-555-0148",
  address: "4128 E Camelback Rd, Phoenix, AZ 85018",
  projectType: "Outdoor kitchen",
  budgetMin: "45000",
  budgetMax: "75000",
  notes:
    "Client wants a premium outdoor kitchen with built-in grill, paver patio expansion, seating wall, lighting, and dog-friendly artificial turf around the entertaining area. Marcus measured the site with a tape measure; use these quantities as USER measurements, not photo estimates. Demo the existing cracked patio: 16 ft x 14 ft = 224 sf. Install new paver patio: 28 ft x 20 ft = 560 sf, plus a 3 ft x 12 ft walkway tie-in to the side gate. Outdoor kitchen base: 12 lf along the west edge, including one 36 inch built-in grill insert. Grill pad/counter work area footprint: 6 ft x 10 ft. Seating wall: 18 lf along the patio edge. Premium artificial turf: 18 ft x 22 ft = 396 sf. Low-voltage lighting: 8 fixtures around the patio and kitchen path. Drainage allowance: 24 lf along the low side of the new patio. HOA packet likely required. Customer cares most about durability, drainage, and a polished finished look for hosting.",
} as const

export function shouldPrefillDemoIntake(
  searchParams: Pick<URLSearchParams, "has">,
  envPrefillEnabled = process.env.NEXT_PUBLIC_PREFILL_DEMO_INTAKE === "true"
) {
  return envPrefillEnabled || searchParams.has("test")
}
