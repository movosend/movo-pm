import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ProfileMenu } from "@/components/profile-menu"
import { auth } from "@/auth"

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
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ProfileMenu
            name={session?.user?.name}
            email={session?.user?.email}
            image={session?.user?.image}
          />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
