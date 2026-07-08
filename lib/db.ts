import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaClient } from "@prisma/client"
import ws from "ws"

import { env } from "@/lib/env"

neonConfig.webSocketConstructor = ws

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const neon = new PrismaNeon({ connectionString: env.DATABASE_URL })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: neon,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
