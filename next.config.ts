import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The analysis route reads docs/analysis-playbook.md at runtime via fs —
  // Next can't trace a process.cwd()-built path, so it must be listed here
  // to survive the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/analysis": ["./docs/analysis-playbook.md"],
  },
}

export default nextConfig
