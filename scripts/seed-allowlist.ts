import { db } from "../lib/db/client"
import { allowedUsers } from "../lib/db/schema"

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
