import Image from "next/image"
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
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={20}
            height={20}
            className="rounded-sm"
          />
          <span className="text-sm font-medium">Movo PM</span>
        </div>
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
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
