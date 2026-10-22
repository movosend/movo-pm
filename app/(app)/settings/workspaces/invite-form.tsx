"use client"

import { useState } from "react"
import { UserPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  WorkspaceMultiSelect,
  type WorkspaceChoice,
} from "@/components/workspace-multi-select"

import { inviteWorkspaceMember } from "./actions"

export function InviteMemberForm({
  workspaces,
}: {
  workspaces: WorkspaceChoice[]
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    workspaces.length === 1 ? [workspaces[0].id] : []
  )

  return (
    <form action={inviteWorkspaceMember} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">Correo de GitHub</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            name="email"
            placeholder="persona@empresa.com"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-workspaces">
            Workspaces permitidos
          </FieldLabel>
          <WorkspaceMultiSelect
            id="invite-workspaces"
            workspaces={workspaces}
            selectedIds={selectedIds}
            onToggle={(workspaceId, checked) =>
              setSelectedIds((current) =>
                checked
                  ? [...current, workspaceId]
                  : current.filter((id) => id !== workspaceId)
              )
            }
          />
          {selectedIds.map((workspaceId) => (
            <input
              key={workspaceId}
              type="hidden"
              name="workspaceId"
              value={workspaceId}
            />
          ))}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={!selectedIds.length}>
        <UserPlusIcon data-icon="inline-start" />
        Invitar persona
      </Button>
    </form>
  )
}
