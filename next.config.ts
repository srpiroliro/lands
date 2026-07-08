import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.39"],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
}

export default nextConfig
