import { redirect } from "next/navigation"

export default async function UsersSettingsPage() {
  redirect("/settings/workspaces")
}
