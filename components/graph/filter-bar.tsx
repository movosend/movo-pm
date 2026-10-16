"use client"

import { Menu } from "@base-ui/react/menu"
import {
  ChevronDownIcon,
  CircleDashedIcon,
  FilterIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  CONDITIONS,
  emptyFilters,
  hasFilters,
  type Filters,
  type Condition,
} from "@/lib/graph/view-state"
import type { TeamMember, TeamState } from "@/lib/schema/snapshot"

type FilterProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  members: TeamMember[]
  states: TeamState[]
}
export function FilterBar({ filters, onChange, members, states }: FilterProps) {
  const count =
    filters.assignees.length + filters.states.length + filters.conditions.length
  function toggle(category: keyof Filters, id: string) {
    const values: string[] = filters[category]
    onChange({
      ...filters,
      [category]: values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant={count ? "outline" : "ghost"} size="sm" />}
        aria-label={count ? `Filtros (${count} activos)` : "Filtros"}
      >
        <FilterIcon data-icon="inline-start" />
        Filtros{count > 0 && <Badge variant="secondary">{count}</Badge>}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <Menu.Group aria-label="Condiciones de issues">
          <DropdownMenuLabel>Qué querés revisar</DropdownMenuLabel>
          {(Object.entries(CONDITIONS) as [Condition, string][]).map(
            ([key, label]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={filters.conditions.includes(key)}
                onCheckedChange={() => toggle("conditions", key)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            )
          )}
        </Menu.Group>
        <DropdownMenuSeparator />
        <Menu.Group aria-label="Filtrar por propiedades">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UsersIcon />
              Responsable
              {filters.assignees.length > 0 && (
                <Badge variant="secondary">{filters.assignees.length}</Badge>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="max-h-80 w-56 overflow-y-auto"
            >
              <Menu.Group aria-label="Responsable">
                <DropdownMenuLabel>Responsable</DropdownMenuLabel>
                {[
                  { id: "unassigned", name: "Sin responsable" },
                  ...members,
                ].map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={filters.assignees.includes(member.id)}
                    onCheckedChange={() => toggle("assignees", member.id)}
                  >
                    {member.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </Menu.Group>
            </DropdownMenuContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CircleDashedIcon />
              Estado
              {filters.states.length > 0 && (
                <Badge variant="secondary">{filters.states.length}</Badge>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="max-h-80 w-56 overflow-y-auto"
            >
              <Menu.Group aria-label="Estado">
                <DropdownMenuLabel>Estado</DropdownMenuLabel>
                {states.map((state) => (
                  <DropdownMenuCheckboxItem
                    key={state.id}
                    checked={filters.states.includes(state.id)}
                    onCheckedChange={() => toggle("states", state.id)}
                  >
                    {state.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </Menu.Group>
            </DropdownMenuContent>
          </DropdownMenuSub>
        </Menu.Group>
        {hasFilters(filters) && (
          <>
            <DropdownMenuSeparator />
            <Menu.Group>
              <DropdownMenuItem onClick={() => onChange(emptyFilters())}>
                <XIcon className="size-4" />
                Limpiar filtros
              </DropdownMenuItem>
            </Menu.Group>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export function ActiveFilters({
  filters,
  onChange,
  members,
  states,
}: FilterProps) {
  if (!hasFilters(filters)) return null
  const items = [
    ...filters.assignees.map((id) => ({
      id,
      key: "assignees" as const,
      label: `Responsable: ${id === "unassigned" ? "Sin asignar" : (members.find((member) => member.id === id)?.name ?? id)}`,
    })),
    ...filters.states.map((id) => ({
      id,
      key: "states" as const,
      label: `Estado: ${states.find((state) => state.id === id)?.name ?? id}`,
    })),
    ...filters.conditions.map((id) => ({
      id,
      key: "conditions" as const,
      label: CONDITIONS[id],
    })),
  ]
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b bg-muted/20 px-4 py-2"
      aria-label="Filtros activos"
    >
      <span className="mr-1 text-xs text-muted-foreground">Filtrando por</span>
      {items.map(({ id, key, label }) => (
        <Button
          key={`${key}-${id}`}
          variant="secondary"
          size="xs"
          aria-label={`Quitar filtro ${label}`}
          onClick={() =>
            onChange({
              ...filters,
              [key]: filters[key].filter((value) => value !== id),
            })
          }
        >
          {label}
          <XIcon data-icon="inline-end" />
        </Button>
      ))}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onChange(emptyFilters())}
      >
        Limpiar
      </Button>
    </div>
  )
}
