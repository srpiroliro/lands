export const demoIntakeDefaults = {
  name: "Julio Martinez",
  email: "julio.martinez@example.com",
  phone: "602-555-0148",
  address: "4128 E Camelback Rd, Phoenix, AZ 85018",
  projectType: "Outdoor kitchen",
  budgetMin: "45000",
  budgetMax: "75000",
  notes:
    "Client wants a premium outdoor kitchen with built-in grill, paver patio expansion, seating wall, lighting, and dog-friendly artificial turf around the entertaining area. Existing patio is cracked and should be demolished; current patio measures roughly 16 ft x 14 ft (224 sq ft). New paver patio should expand to about 28 ft x 20 ft (560 sq ft), with a 6 ft x 10 ft grill pad and 3 ft walkway tie-in to the side gate. HOA packet likely required. Customer cares most about durability, drainage, and a polished finished look for hosting.",
} as const

export function shouldPrefillDemoIntake(
  searchParams: Pick<URLSearchParams, "has">,
  envPrefillEnabled = process.env.NEXT_PUBLIC_PREFILL_DEMO_INTAKE === "true"
) {
  return envPrefillEnabled || searchParams.has("test")
}
