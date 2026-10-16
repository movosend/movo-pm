"use client"

import { Menu } from "@base-ui/react/menu"
import { FilterIcon, LinkIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CONDITIONS,
  emptyFilters,
  hasFilters,
  type Filters,
  type Condition,
} from "@/lib/graph/view-state"
import type { TeamMember, TeamState } from "@/lib/schema/snapshot"

export function FilterBar({
  filters,
  onChange,
  members,
  states,
  count,
  total,
  onShare,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  members: TeamMember[]
  states: TeamState[]
  count: number
  total: number
  onShare: () => void
}) {
  function toggle(category: "assignees" | "states", id: string) {
    onChange({
      ...filters,
      [category]: filters[category].includes(id)
        ? filters[category].filter((value) => value !== id)
        : [...filters[category], id],
    })
  }
  return (
    <div
      className="flex flex-col gap-2 border-b px-4 py-2"
      aria-label="Filtros de issues"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FilterIcon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        {(
          [
            {
              key: "assignees",
              label: "Responsable",
              items: [
                { id: "unassigned", name: "Sin responsable" },
                ...members,
              ],
            },
            { key: "states", label: "Estado", items: states },
          ] as const
        ).map(({ key, label, items }) => (
          <DropdownMenu key={key}>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              {label}
              {filters[key].length ? ` (${filters[key].length})` : ""}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-80 overflow-y-auto"
            >
              <Menu.Group aria-label={label}>
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                {items.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.id}
                    checked={filters[key].includes(item.id)}
                    onCheckedChange={() => toggle(key, item.id)}
                  >
                    {item.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </Menu.Group>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          value={filters.conditions}
          onValueChange={(value) =>
            onChange({ ...filters, conditions: value as Condition[] })
          }
          aria-label="Condiciones de issues"
        >
          {(Object.entries(CONDITIONS) as [Condition, string][]).map(
            ([key, label]) => (
              <ToggleGroupItem key={key} value={key}>
                {label}
              </ToggleGroupItem>
            )
          )}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground" role="status">
          {count} de {total} issues
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onShare}>
          <LinkIcon data-icon="inline-start" />
          Compartir vista
        </Button>
      </div>
      {hasFilters(filters) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.assignees.map((id) => (
            <Button
              key={id}
              variant="secondary"
              size="xs"
              onClick={() => toggle("assignees", id)}
              aria-label={`Quitar filtro ${members.find((member) => member.id === id)?.name ?? "Sin responsable"}`}
            >
              {members.find((member) => member.id === id)?.name ??
                "Sin responsable"}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          {filters.states.map((id) => (
            <Button
              key={id}
              variant="secondary"
              size="xs"
              onClick={() => toggle("states", id)}
              aria-label={`Quitar filtro ${states.find((state) => state.id === id)?.name ?? id}`}
            >
              {states.find((state) => state.id === id)?.name ?? id}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          {filters.conditions.map((key) => (
            <Button
              key={key}
              variant="secondary"
              size="xs"
              onClick={() =>
                onChange({
                  ...filters,
                  conditions: filters.conditions.filter(
                    (condition) => condition !== key
                  ),
                })
              }
              aria-label={`Quitar filtro ${CONDITIONS[key]}`}
            >
              {CONDITIONS[key]}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange(emptyFilters())}
          >
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
