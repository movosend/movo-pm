import type { Node } from "@/lib/schema/snapshot"

export type VelocityCycle = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  completedAt: string | null
  completedScopeHistory: number[]
}
export type Velocity = {
  samples: { id: string; name: string; completedPoints: number; days: number }[]
  averagePoints: number | null
  averageDays: number | null
}
export function calculateVelocity(
  cycles: VelocityCycle[],
  now = Date.now()
): Velocity {
  const samples = cycles
    .filter(
      (cycle) =>
        cycle.completedAt &&
        new Date(cycle.completedAt).getTime() <= now &&
        new Date(cycle.endsAt).getTime() <= now
    )
    .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())
    .slice(0, 5)
    .filter((cycle) => cycle.completedScopeHistory.length > 0)
    .map((cycle) => ({
      id: cycle.id,
      name: cycle.name,
      completedPoints: cycle.completedScopeHistory.at(-1)!,
      days:
        (new Date(cycle.endsAt).getTime() -
          new Date(cycle.startsAt).getTime()) /
        86400000,
    }))
    .filter(
      (sample) =>
        Number.isFinite(sample.completedPoints) &&
        sample.completedPoints >= 0 &&
        sample.days > 0
    )
  return {
    samples,
    averagePoints: samples.length
      ? samples.reduce((sum, sample) => sum + sample.completedPoints, 0) /
        samples.length
      : null,
    averageDays: samples.length
      ? samples.reduce((sum, sample) => sum + sample.days, 0) / samples.length
      : null,
  }
}
export function planPoints(nodes: Node[]) {
  const work = nodes.filter((node) => !node.isEpic && node.type !== "canceled")
  const pending = work.filter((node) => node.type !== "completed")
  return {
    total: work.reduce((sum, node) => sum + (node.pts ?? 0), 0),
    remaining: pending.reduce((sum, node) => sum + (node.pts ?? 0), 0),
    completed: work
      .filter((node) => node.type === "completed")
      .reduce((sum, node) => sum + (node.pts ?? 0), 0),
    unestimated: pending.filter((node) => node.pts === null).length,
    pendingCount: pending.length,
  }
}
export function forecastPlan(
  points: ReturnType<typeof planPoints>,
  velocity: Velocity | null,
  incomplete: boolean
) {
  if (
    incomplete ||
    !velocity ||
    velocity.samples.length < 2 ||
    !velocity.averagePoints ||
    !velocity.averageDays
  )
    return null
  const cycles = points.remaining / velocity.averagePoints
  return {
    cycles,
    days: cycles * velocity.averageDays,
    partial: points.unestimated > 0,
  }
}
