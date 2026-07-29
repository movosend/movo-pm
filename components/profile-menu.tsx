"use client"

import Link from "next/link"
import { SettingsIcon, LogOutIcon } from "lucide-react"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { signOutAction } from "@/app/(app)/actions"

function initials(label: string) {
  return label.slice(0, 2).toUpperCase()
}

export function ProfileMenu({
  name,
  email,
  image,
}: {
  name?: string | null
  email?: string | null
  image?: string | null
}) {
  const displayName = name ?? email ?? "Usuario"

  return (
    <DropdownMenu>
      <span className="text-sm text-muted-foreground">{displayName}</span>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Avatar>
          <AvatarImage src={image ?? undefined} alt={displayName} />
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">{displayName}</span>
            {email && name && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/settings" />}
          nativeButton={false}
        >
          <SettingsIcon className="size-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void signOutAction()
          }}
        >
          <LogOutIcon className="size-4" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
