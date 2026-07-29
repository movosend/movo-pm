"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db/client"
import { allowedUsers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function addAllowedUser(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()

  if (!email || !email.includes("@")) return

  await db.insert(allowedUsers).values({ email }).onConflictDoNothing()
  revalidatePath("/settings/users")
}

export async function removeAllowedUser(email: string) {
  await db.delete(allowedUsers).where(eq(allowedUsers.email, email))
  revalidatePath("/settings/users")
}
