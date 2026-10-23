"use client"

import type { ReactNode } from "react"
import { Menu } from "@base-ui/react/menu"
import {
  ChevronDownIcon,
  LinkIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { SyncButton } from "@/components/graph/sync-button"
export type ToggleKey =
  "showOutside" | "showParents" | "hideParents" | "showOrphans" | "hideOrphans"
export function ToggleBar({
  active,
  onToggle,
  onReset,
  onOpenSearch,
  onOpenUserPalette,
  highlightedUserName,
  onClearHighlight,
  filters,
  count,
  total,
  onShare,
  panelOpen,
  onTogglePanel,
  allIssues = false,
  onRefresh,
}: {
  active: ToggleKey[]
  onToggle: (keys: ToggleKey[]) => void
  onReset: () => void
  onOpenSearch: () => void
  onOpenUserPalette: () => void
  highlightedUserName?: string | null
  onClearHighlight: () => void
  filters: ReactNode
  count: number
  total: number
  onShare: () => void
  panelOpen: boolean
  onTogglePanel: () => void
  allIssues?: boolean
  onRefresh?: () => void
}) {
  const panelLabel = panelOpen
    ? "Colapsar panel de resumen"
    : "Expandir panel de resumen"
  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2">
      {filters}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <SlidersHorizontalIcon data-icon="inline-start" />
          Vista
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <Menu.Group aria-label="Opciones del grafo">
            <DropdownMenuLabel>Mostrar en el grafo</DropdownMenuLabel>
            {(
              [
                ...(!allIssues
                  ? [
                      {
                        key: "showOutside",
                        label: "Fuera del ciclo",
                        shortcut: "1",
                      } as const,
                    ]
                  : []),
                {
                  key: allIssues ? "hideParents" : "showParents",
                  label: "Nombre del issue padre",
                  shortcut: "2",
                },
                {
                  key: allIssues ? "hideOrphans" : "showOrphans",
                  label: "Sin dependencias",
                  shortcut: "3",
                },
              ] as const
            ).map(({ key, label, shortcut }) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={
                  key === "hideOrphans" || key === "hideParents"
                    ? !active.includes(key)
                    : active.includes(key)
                }
                onCheckedChange={() =>
                  onToggle(
                    active.includes(key)
                      ? active.filter((value) => value !== key)
                      : [...active, key]
                  )
                }
              >
                {label}
                <Kbd className="ml-auto">{shortcut}</Kbd>
              </DropdownMenuCheckboxItem>
            ))}
          </Menu.Group>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarIcon label="Reencuadrar" onClick={onReset}>
        <RotateCcwIcon />
      </ToolbarIcon>
      <Separator orientation="vertical" className="mx-2 h-4" />
      <span
        className="text-xs text-muted-foreground tabular-nums"
        role="status"
      >
        {count === total ? `${total} issues` : `${count} de ${total} issues`}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {highlightedUserName ? (
          <Button variant="secondary" size="sm" onClick={onClearHighlight}>
            <UsersIcon data-icon="inline-start" />
            {highlightedUserName}
            <XIcon data-icon="inline-end" />
          </Button>
        ) : (
          <ToolbarIcon label="Resaltar por usuario" onClick={onOpenUserPalette}>
            <UsersIcon />
          </ToolbarIcon>
        )}
        <Button variant="secondary" size="sm" onClick={onOpenSearch}>
          <SearchIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Buscar issues</span>
          <KbdGroup className="ml-2 hidden md:inline-flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        {allIssues ? (
          <ToolbarIcon label="Actualizar grafo" onClick={() => onRefresh?.()}>
            <RefreshCwIcon />
          </ToolbarIcon>
        ) : (
          <SyncButton compact />
        )}
        <ToolbarIcon label="Compartir vista" onClick={onShare}>
          <LinkIcon />
        </ToolbarIcon>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIcon
          label={panelLabel}
          onClick={onTogglePanel}
          expanded={panelOpen}
        >
          {panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </ToolbarIcon>
      </div>
    </div>
  )
}
function ToolbarIcon({
  label,
  children,
  onClick,
  expanded,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  expanded?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            aria-label={label}
            aria-expanded={expanded}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
