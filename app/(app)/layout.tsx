import { AppNavigation } from "@/components/app-navigation"
import Image from "next/image"
import Link from "next/link"
import { SettingsIcon } from "lucide-react"

import { ProfileMenu } from "@/components/profile-menu"
import { Button } from "@/components/ui/button"
import { auth } from "@/auth"
import { listAccessibleTeams, isAdmin } from "@/lib/workspaces/access"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const workspaces = await listAccessibleTeams()
  const admin = isAdmin(session?.user?.id)
  const needsSignIn = Boolean(session?.user && !session.user.id)

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={30}
            height={30}
            className="rounded-md"
          />
          <span className="hidden text-sm font-medium sm:inline">
            Movo Project Manager
          </span>
        </div>
        <WorkspaceSwitcher workspaces={workspaces} />
        <AppNavigation />
        <div className="ml-auto flex items-center gap-3">
          {(admin || needsSignIn) && (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={admin ? "/settings/workspaces" : "/settings"} />}
              nativeButton={false}
            >
              <SettingsIcon data-icon="inline-start" />
              {admin ? "Configuración" : "Actualizar acceso"}
            </Button>
          )}
          <ProfileMenu
            name={session?.user?.name}
            email={session?.user?.email}
            image={session?.user?.image}
            admin={admin}
          />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
