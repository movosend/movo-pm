import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/workspaces/access"

export default async function UsersSettingsPage() {
  await requireAdmin()
  redirect("/settings/workspaces")
}
