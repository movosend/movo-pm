import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CycleGraph } from "@/components/graph/cycle-graph"
import { fixture } from "./fixture"
import type { Snapshot } from "@/lib/schema/snapshot"
import "@/app/globals.css"
function App() {
  const [snapshot, setSnapshot] = useState(fixture)
  useEffect(() => {
    const update = (event: Event) => {
      setSnapshot((event as CustomEvent<Snapshot>).detail)
    }
    window.addEventListener("fixture-snapshot", update)
    return () => window.removeEventListener("fixture-snapshot", update)
  }, [])
  return (
    <div style={{ height: "100dvh", overflow: "hidden" }}>
      <TooltipProvider>
        <CycleGraph snapshot={snapshot} />
      </TooltipProvider>
    </div>
  )
}
createRoot(document.getElementById("root")!).render(<App />)
