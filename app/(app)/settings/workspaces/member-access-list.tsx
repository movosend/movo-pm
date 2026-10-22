"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { Toaster, toast } from "@/components/ui/toast"
import {
  WorkspaceMultiSelect,
  type WorkspaceChoice,
} from "@/components/workspace-multi-select"

import { setMemberWorkspaceAccess } from "./actions"

type Member = { email: string; workspaceIds: string[] }

function MemberAccessRow({
  member,
  workspaces,
}: {
  member: Member
  workspaces: WorkspaceChoice[]
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState(member.workspaceIds)
  const [pending, startTransition] = useTransition()

  function toggle(workspaceId: string, checked: boolean) {
    const previous = selectedIds
    setSelectedIds(
      checked
        ? [...previous, workspaceId]
        : previous.filter((id) => id !== workspaceId)
    )
    startTransition(async () => {
      try {
        await setMemberWorkspaceAccess(member.email, workspaceId, checked)
        router.refresh()
      } catch {
        setSelectedIds(previous)
        toast.add({ title: "No se pudo actualizar el acceso.", type: "error" })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium break-all">{member.email}</p>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {pending ? "Guardando…" : ""}
        </p>
      </div>
      <WorkspaceMultiSelect
        workspaces={workspaces}
        selectedIds={selectedIds}
        onToggle={toggle}
        busy={pending}
      />
    </div>
  )
}

export function MemberAccessList({
  members,
  workspaces,
}: {
  members: Member[]
  workspaces: WorkspaceChoice[]
}) {
  if (!members.length)
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay personas invitadas.
      </p>
    )

  return (
    <Toaster limit={4}>
      <div className="flex flex-col">
        {members.map((member, index) => (
          <div key={member.email}>
            {index > 0 && <Separator />}
            <MemberAccessRow
              key={`${member.email}:${member.workspaceIds.join(",")}`}
              member={member}
              workspaces={workspaces}
            />
          </div>
        ))}
      </div>
    </Toaster>
  )
}
