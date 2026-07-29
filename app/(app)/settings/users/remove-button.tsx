"use client"

import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { removeAllowedUser } from "./actions"

export function RemoveButton({ email }: { email: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        void removeAllowedUser(email)
      }}
    >
      <XIcon />
      <span className="sr-only">Quitar acceso</span>
    </Button>
  )
}
