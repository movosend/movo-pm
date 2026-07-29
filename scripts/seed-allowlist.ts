import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import { allowedUsers } from "../lib/db/schema"

// Standalone script: builds its own connection instead of importing
// lib/db/client.ts, which is guarded by "server-only" for the Next.js app.
const db = drizzle(neon(process.env.DATABASE_URL!))

// Usage: npm run db:seed-allowlist -- alice@movosend.com bob@movosend.com
async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase())

  if (emails.length === 0) {
    console.error(
      "No emails given. Usage: npm run db:seed-allowlist -- someone@movosend.com"
    )
    process.exit(1)
  }

  await db
    .insert(allowedUsers)
    .values(emails.map((email) => ({ email })))
    .onConflictDoNothing()

  console.log(`Allowlisted: ${emails.join(", ")}`)
}

main()
