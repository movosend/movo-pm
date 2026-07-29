import { AlertTriangleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Domain invariant (preplan §1.2.1): Linear allows creating cyclic blocking
 * relations. We must never crash or hang on that — detect it, show which
 * issues are involved, and keep rendering the rest of the graph.
 */
export function EmptyCycleError({ cycles }: { cycles: string[][] }) {
  if (cycles.length === 0) return null

  return (
    <Alert variant="destructive" className="mx-4 mt-3">
      <AlertTriangleIcon />
      <AlertTitle>
        {cycles.length === 1
          ? "Hay un ciclo en las relaciones de bloqueo"
          : `Hay ${cycles.length} ciclos en las relaciones de bloqueo`}
      </AlertTitle>
      <AlertDescription>
        <p>
          Es un error de datos en Linear, no del cálculo — alguna relación de
          bloqueo forma un círculo. El resto del grafo sigue siendo válido.
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {cycles.map((cycle, i) => (
            <li key={i} className="font-mono text-xs">
              {cycle.join(" → ")}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
