import "dotenv/config"
import { defineConfig, env as prismaEnv } from "prisma/config"

type Env = {
  DIRECT_URL: string
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: prismaEnv<Env>("DIRECT_URL"),
  },
})
