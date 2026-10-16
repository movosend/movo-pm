import type { Metadata } from "next"

import { CycleGraph } from "@/components/graph/cycle-graph"
import { SyncButton } from "@/components/graph/sync-button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { getLatestSnapshot } from "@/lib/db/queries"
import { getLinearSource } from "@/lib/linear/client"
import type { Snapshot } from "@/lib/schema/snapshot"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function Page() {
  const row = await getLatestSnapshot(process.env.LINEAR_TEAM_KEY!)

  if (!row) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Todavía no hay datos</EmptyTitle>
            <EmptyDescription>
              Sincronizá con Linear para traer el ciclo activo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <SyncButton />
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const stored = row.payload as Snapshot
  // Old snapshots lack the work/epic classification. Resolve it before enabling work actions.
  const snapshot = stored.nodes.some((node) => node.isEpic === undefined)
    ? await getLinearSource().getActiveCycleSnapshot()
    : stored
  return <CycleGraph snapshot={snapshot} />
}
