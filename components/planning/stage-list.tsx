"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, FilesIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Stage } from "@/lib/planning/types"
import { planningRequest } from "./api"

export function StageList() {
  const router = useRouter()
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [archived, setArchived] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () =>
      planningRequest<{ stages: Stage[] }>("/api/planning")
        .then((body) => {
          if (active) {
            setStages(body.stages)
            setError(null)
          }
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    void refresh()
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      window.removeEventListener("focus", refresh)
    }
  }, [])
  async function create() {
    setBusy(true)
    try {
      const body = await planningRequest<{ stage: Stage }>("/api/planning", {
        name,
      })
      router.push(`/planning/${body.stage.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const visible = stages
    ?.filter((stage) => stage.archived === archived)
    .reverse()
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-auto p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Planificación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explorá dependencias y prepará propuestas con el equipo.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Nueva hoja
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup
          value={[archived ? "archived" : "active"]}
          onValueChange={(values) => {
            if (values.length) setArchived(values[0] === "archived")
          }}
          size="sm"
          aria-label="Estado de las hojas"
        >
          <ToggleGroupItem value="active">Hojas activas</ToggleGroupItem>
          <ToggleGroupItem value="archived">Archivadas</ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto text-xs text-muted-foreground">
          Compartidas con el equipo
        </span>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!stages && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando hojas…
        </p>
      )}
      {visible?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <FilesIcon className="mx-auto size-6 text-muted-foreground" />
            <EmptyTitle>
              {archived
                ? "Sin hojas archivadas"
                : "Tu próxima propuesta empieza acá"}
            </EmptyTitle>
            <EmptyDescription>
              Creá una hoja, agregá issues y explorá qué necesitan para avanzar.
            </EmptyDescription>
          </EmptyHeader>
          {!archived && (
            <Button variant="outline" onClick={() => setOpen(true)}>
              Crear primera hoja
            </Button>
          )}
        </Empty>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible?.map((stage) => (
          <Link
            key={stage.id}
            href={`/planning/${stage.id}`}
            className="group flex items-center gap-3 rounded-xl border p-5 hover:bg-muted/40 focus-visible:outline-ring"
          >
            <FilesIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">{stage.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Actualizada{" "}
                {new Date(stage.updatedAt).toLocaleDateString("es-AR")}
              </p>
            </div>
            {stage.archived ? (
              <Badge variant="outline">Archivada</Badge>
            ) : (
              <ArrowRightIcon className="size-4 text-muted-foreground" />
            )}
          </Link>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva hoja</DialogTitle>
            <DialogDescription>
              Dale un nombre a la propuesta. Podés cambiarlo después.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="stage-name">Nombre</FieldLabel>
                <Input
                  id="stage-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mejoras de onboarding"
                  maxLength={100}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Creando…" : "Crear hoja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
