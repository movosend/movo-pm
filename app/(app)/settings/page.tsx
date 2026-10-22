import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, UsersIcon, GaugeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Settings",
}

import { auth } from "@/auth"
import { isAdmin } from "@/lib/workspaces/access"

export default async function SettingsPage() {
  if (!isAdmin((await auth())?.user?.id)) return null
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 overflow-y-auto p-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Volver
      </Button>

      <Link href="/settings/workspaces">
        <Card className="transition-colors hover:bg-muted/50">
          <CardContent className="flex items-center gap-3">
            <UsersIcon className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-heading text-base font-medium">
                Workspaces e invitados
              </div>
              <div className="text-sm text-muted-foreground">
                Conectá Linear, habilitá equipos y gestioná invitados
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/settings/usage">
        <Card className="transition-colors hover:bg-muted/50">
          <CardContent className="flex items-center gap-3">
            <GaugeIcon className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-heading text-base font-medium">
                Uso de Claude API
              </div>
              <div className="text-sm text-muted-foreground">
                Consumo de tokens y costo estimado
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
