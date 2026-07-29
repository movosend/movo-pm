import Link from "next/link"

import { Button } from "@/components/ui/button"
import { auth, signOut } from "@/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <span className="text-sm font-medium">Movo PM</span>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/" />}
            nativeButton={false}
          >
            Grafo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/planning" />}
            nativeButton={false}
          >
            Modo planning
          </Button>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
