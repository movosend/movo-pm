"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { workspaceBase } from "@/lib/workspaces/routes"

export function AppNavigation() {
  const pathname = usePathname()
  const base = workspaceBase(pathname)
  if (!base) return null
  return (
    <nav aria-label="Secciones" className="flex items-center gap-1">
      {[
        { href: base, label: "Ciclo actual" },
        { href: `${base}/planning`, label: "Planificación" },
      ].map((item) => {
        const active =
          item.href === base
            ? pathname === base
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted",
              active && "bg-muted font-medium text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
