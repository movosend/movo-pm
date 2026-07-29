import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { db } from "@/lib/db/client"
import { allowedUsers } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { addAllowedUser } from "./actions"
import { RemoveButton } from "./remove-button"

export const metadata: Metadata = {
  title: "Users",
}

export default async function UsersSettingsPage() {
  const users = await db
    .select()
    .from(allowedUsers)
    .orderBy(allowedUsers.addedAt)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 overflow-y-auto p-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/settings" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios autorizados</CardTitle>
          <CardDescription>
            Solo los correos listados aquí, y que además pertenezcan a la
            organización de GitHub, pueden iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={addAllowedUser} className="flex gap-2">
            <input
              type="email"
              name="email"
              required
              placeholder="nombre@movosend.com"
              className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="sm">
              Agregar
            </Button>
          </form>

          <ul className="flex flex-col divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.email}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="truncate text-sm">{user.email}</span>
                <RemoveButton email={user.email} />
              </li>
            ))}
            {users.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">
                No hay usuarios autorizados todavía.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
