import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaClient } from "@prisma/client"
import ws from "ws"

import { toCents } from "../lib/domain/pricing"

if (existsSync(".env")) {
  loadEnvFile(".env")
}

neonConfig.webSocketConstructor = ws

type PricingSeedItem = {
  sku: string
  category: string
  name: string
  description: string
  unit: string
  unitPriceCents: number
  minQty?: number
  maxQty?: number
  requiresMeasurement: boolean
  requiresReview: boolean
  active: boolean
  tags: string[]
}

const pricingItems = [
  {
    sku: "PAVER-PATIO-SF",
    category: "Hardscape",
    name: "Paver patio installation",
    description:
      "Premium concrete paver patio with standard base prep, bedding sand, edge restraint, and polymeric sand.",
    unit: "sf",
    unitPriceCents: toCents(28),
    minQty: 100,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["patio", "pavers", "hardscape"],
  },
  {
    sku: "TRAVERTINE-PATIO-SF",
    category: "Hardscape",
    name: "Travertine patio installation",
    description:
      "Premium travertine paver patio with standard base prep, bedding material, edge restraint, and joint sand.",
    unit: "sf",
    unitPriceCents: toCents(42),
    minQty: 100,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["patio", "travertine", "hardscape"],
  },
  {
    sku: "DEMO-OLD-PATIO-SF",
    category: "Demolition",
    name: "Existing patio demolition",
    description:
      "Demolition and removal of existing patio surface prior to new hardscape installation.",
    unit: "sf",
    unitPriceCents: toCents(5.5),
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["demo", "removal", "patio"],
  },
  {
    sku: "PERGOLA-STANDARD-SF",
    category: "Shade Structures",
    name: "Standard pergola",
    description:
      "Standard framed pergola structure with typical footings and finish allowance.",
    unit: "sf",
    unitPriceCents: toCents(95),
    minQty: 80,
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["pergola", "shade", "structure"],
  },
  {
    sku: "OUTDOOR-KITCHEN-LF",
    category: "Outdoor Living",
    name: "Outdoor kitchen build",
    description:
      "Built-in outdoor kitchen base with standard masonry, veneer, countertop allowance, and utility coordination.",
    unit: "lf",
    unitPriceCents: toCents(1200),
    minQty: 4,
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["kitchen", "masonry", "outdoor-living"],
  },
  {
    sku: "GRILL-INSERT-EA",
    category: "Outdoor Living",
    name: "Grill insert",
    description:
      "Built-in stainless grill insert allowance with standard installation in outdoor kitchen.",
    unit: "ea",
    unitPriceCents: toCents(3500),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["kitchen", "grill", "appliance"],
  },
  {
    sku: "FIRE-PIT-EA",
    category: "Fire Features",
    name: "Fire pit",
    description:
      "Gas fire pit feature with standard masonry surround, burner kit, and finish allowance.",
    unit: "ea",
    unitPriceCents: toCents(4500),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["fire", "fire-pit", "gas"],
  },
  {
    sku: "FIREPLACE-EA",
    category: "Fire Features",
    name: "Outdoor fireplace",
    description:
      "Outdoor fireplace feature with standard masonry, burner kit, finish allowance, and utility coordination.",
    unit: "ea",
    unitPriceCents: toCents(12000),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["fire", "fireplace", "gas"],
  },
  {
    sku: "TURF-PREMIUM-SF",
    category: "Landscape",
    name: "Premium artificial turf",
    description:
      "Premium artificial turf with base preparation, weed barrier, infill, and standard edging.",
    unit: "sf",
    unitPriceCents: toCents(14),
    minQty: 150,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["turf", "landscape", "synthetic"],
  },
  {
    sku: "SOD-SF",
    category: "Landscape",
    name: "Sod installation",
    description:
      "Sod installation with basic soil preparation and starter fertilizer.",
    unit: "sf",
    unitPriceCents: toCents(4.5),
    minQty: 100,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["sod", "grass", "landscape"],
  },
  {
    sku: "PLANT-5GAL-EA",
    category: "Planting",
    name: "5 gallon plant",
    description:
      "5 gallon plant material with planting labor, soil amendment, and initial watering.",
    unit: "ea",
    unitPriceCents: toCents(65),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["planting", "plant", "5-gallon"],
  },
  {
    sku: "TREE-24BOX-EA",
    category: "Planting",
    name: "24 inch box tree",
    description:
      "24 inch box tree with delivery, planting labor, staking, soil amendment, and initial watering.",
    unit: "ea",
    unitPriceCents: toCents(450),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["planting", "tree", "24-box"],
  },
  {
    sku: "GRAVEL-SF",
    category: "Landscape",
    name: "Decorative gravel",
    description:
      "Decorative gravel ground cover with weed barrier and standard spread depth.",
    unit: "sf",
    unitPriceCents: toCents(3.75),
    minQty: 200,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["gravel", "rock", "landscape"],
  },
  {
    sku: "BOULDER-EA",
    category: "Landscape",
    name: "Accent boulder",
    description:
      "Accent boulder allowance with placement labor for landscape focal points.",
    unit: "ea",
    unitPriceCents: toCents(350),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["boulder", "rock", "accent"],
  },
  {
    sku: "IRRIGATION-ZONE-EA",
    category: "Irrigation",
    name: "Irrigation zone",
    description:
      "New irrigation zone with valve, tie-in, pipe, heads or emitters, and controller coordination.",
    unit: "ea",
    unitPriceCents: toCents(900),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["irrigation", "zone", "water"],
  },
  {
    sku: "DRIP-LINE-LF",
    category: "Irrigation",
    name: "Drip line",
    description:
      "Drip irrigation line installation with emitters and fittings for planted areas.",
    unit: "lf",
    unitPriceCents: toCents(3.25),
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["irrigation", "drip", "water"],
  },
  {
    sku: "LIGHTING-FIXTURE-EA",
    category: "Lighting",
    name: "Low-voltage lighting fixture",
    description:
      "Low-voltage landscape lighting fixture with wiring, placement, and standard installation.",
    unit: "ea",
    unitPriceCents: toCents(285),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["lighting", "low-voltage", "fixture"],
  },
  {
    sku: "LIGHTING-TRANSFORMER-EA",
    category: "Lighting",
    name: "Lighting transformer",
    description:
      "Low-voltage lighting transformer sized for a standard residential lighting package.",
    unit: "ea",
    unitPriceCents: toCents(950),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["lighting", "transformer", "low-voltage"],
  },
  {
    sku: "RETAINING-WALL-SF",
    category: "Walls",
    name: "Retaining wall",
    description:
      "Segmental retaining wall with typical base prep, drainage aggregate, and cap allowance.",
    unit: "sf",
    unitPriceCents: toCents(85),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["wall", "retaining", "hardscape"],
  },
  {
    sku: "SEAT-WALL-LF",
    category: "Walls",
    name: "Seat wall",
    description: "Seat wall with standard masonry, veneer, and cap allowance.",
    unit: "lf",
    unitPriceCents: toCents(175),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["wall", "seat-wall", "hardscape"],
  },
  {
    sku: "CONCRETE-SLAB-SF",
    category: "Concrete",
    name: "Concrete slab",
    description:
      "Standard concrete slab with formwork, base prep, reinforcement allowance, pour, and finish.",
    unit: "sf",
    unitPriceCents: toCents(14),
    minQty: 100,
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["concrete", "slab", "hardscape"],
  },
  {
    sku: "DRAINAGE-LF",
    category: "Drainage",
    name: "Drainage line",
    description:
      "Drainage solution with trenching, pipe, aggregate, fabric, and discharge coordination.",
    unit: "lf",
    unitPriceCents: toCents(28),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["drainage", "pipe", "water"],
  },
  {
    sku: "WATER-FEATURE-EA",
    category: "Water Features",
    name: "Water feature",
    description:
      "Decorative water feature allowance with basin, pump, plumbing, and finish coordination.",
    unit: "ea",
    unitPriceCents: toCents(8500),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["water-feature", "pump", "outdoor-living"],
  },
  {
    sku: "POOL-DECK-SF",
    category: "Hardscape",
    name: "Pool deck surface",
    description:
      "Pool deck paving or overlay surface with standard prep and pool-edge coordination.",
    unit: "sf",
    unitPriceCents: toCents(32),
    minQty: 100,
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["pool", "deck", "hardscape"],
  },
  {
    sku: "BUILT-IN-BENCH-LF",
    category: "Outdoor Living",
    name: "Built-in bench",
    description:
      "Built-in masonry bench with veneer, cap, and finish allowance.",
    unit: "lf",
    unitPriceCents: toCents(220),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["bench", "masonry", "outdoor-living"],
  },
  {
    sku: "RAISED-PLANTER-LF",
    category: "Planting",
    name: "Raised planter",
    description:
      "Raised masonry planter with standard footing, veneer, cap, and soil fill allowance.",
    unit: "lf",
    unitPriceCents: toCents(165),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["planter", "masonry", "planting"],
  },
  {
    sku: "HOA-PACKET-EA",
    category: "Preconstruction",
    name: "HOA submission packet",
    description:
      "HOA packet preparation with scope summary, material notes, and supporting images or drawings.",
    unit: "ea",
    unitPriceCents: toCents(450),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["hoa", "admin", "preconstruction"],
  },
  {
    sku: "DESIGN-RENDER-EA",
    category: "Design",
    name: "3D design render",
    description:
      "3D design render allowance for proposals or customer approval packages.",
    unit: "ea",
    unitPriceCents: toCents(850),
    requiresMeasurement: false,
    requiresReview: false,
    active: true,
    tags: ["design", "render", "proposal"],
  },
  {
    sku: "SITE-PREP-HR",
    category: "Labor",
    name: "Site preparation labor",
    description:
      "General site preparation labor for grading, layout, cleanup, and coordination not covered by another SKU.",
    unit: "hr",
    unitPriceCents: toCents(125),
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["labor", "site-prep", "prep"],
  },
  {
    sku: "HAUL-OFF-CY",
    category: "Demolition",
    name: "Haul-off and disposal",
    description:
      "Haul-off and disposal of demolition debris, spoil, or excess material.",
    unit: "cy",
    unitPriceCents: toCents(95),
    requiresMeasurement: true,
    requiresReview: false,
    active: true,
    tags: ["haul-off", "disposal", "demo"],
  },
  {
    sku: "EXCAVATION-CY",
    category: "Earthwork",
    name: "Excavation",
    description:
      "Excavation and rough grading for hardscape, drainage, or structural prep.",
    unit: "cy",
    unitPriceCents: toCents(140),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["excavation", "earthwork", "grading"],
  },
  {
    sku: "STEPS-EA",
    category: "Hardscape",
    name: "Hardscape step",
    description:
      "Individual hardscape step with standard base, riser, tread, and finish allowance.",
    unit: "ea",
    unitPriceCents: toCents(650),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["steps", "hardscape", "access"],
  },
  {
    sku: "GATE-EA",
    category: "Access",
    name: "Pedestrian gate",
    description:
      "Standard pedestrian gate with hardware, posts, and installation allowance.",
    unit: "ea",
    unitPriceCents: toCents(1800),
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["gate", "access", "fence"],
  },
  {
    sku: "FENCE-LF",
    category: "Access",
    name: "Fence installation",
    description:
      "Standard residential fencing with posts, panels, hardware, and installation allowance.",
    unit: "lf",
    unitPriceCents: toCents(95),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["fence", "access", "privacy"],
  },
  {
    sku: "MISTING-SYSTEM-LF",
    category: "Outdoor Living",
    name: "Misting system",
    description:
      "Outdoor misting system with tubing, nozzles, pump allowance, and standard installation.",
    unit: "lf",
    unitPriceCents: toCents(65),
    requiresMeasurement: true,
    requiresReview: true,
    active: true,
    tags: ["misting", "cooling", "outdoor-living"],
  },
  {
    sku: "CONTINGENCY-PCT",
    category: "Allowance",
    name: "Contingency allowance",
    description:
      "Optional contingency percentage for complex, uncertain, or scope-sensitive proposal drafts.",
    unit: "pct",
    unitPriceCents: toCents(0),
    minQty: 0,
    maxQty: 15,
    requiresMeasurement: false,
    requiresReview: true,
    active: true,
    tags: ["contingency", "allowance", "review"],
  },
] satisfies PricingSeedItem[]

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required to seed the pricing catalog"
  )
}

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  for (const item of pricingItems) {
    await prisma.pricingItem.upsert({
      where: { sku: item.sku },
      update: {
        category: item.category,
        name: item.name,
        description: item.description,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
        minQty: item.minQty,
        maxQty: item.maxQty,
        requiresMeasurement: item.requiresMeasurement,
        requiresReview: item.requiresReview,
        active: item.active,
        tags: item.tags,
      },
      create: item,
    })
  }

  console.log(`Seeded ${pricingItems.length} pricing catalog items.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
