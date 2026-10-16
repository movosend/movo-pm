"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
export function AppNavigation() {
  const pathname = usePathname()
  return (
    <nav aria-label="Secciones" className="flex items-center gap-1">
      {[
        { href: "/", label: "Ciclo actual" },
        { href: "/planning", label: "Planificación" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            (
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            )
              ? "page"
              : undefined
          }
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted",
            (item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)) &&
              "bg-muted font-medium text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
