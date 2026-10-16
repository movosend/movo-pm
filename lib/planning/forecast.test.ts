import { describe, expect, it } from "vitest"
import { normalDag } from "@/lib/graph/__fixtures__"
import {
  calculateVelocity,
  forecastPlan,
  planPoints,
  type VelocityCycle,
} from "./forecast"
const cycle = (id: string, points: number, day: number): VelocityCycle => ({
  id,
  name: id,
  startsAt: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
  endsAt: `2026-01-${String(day + 7).padStart(2, "0")}T00:00:00Z`,
  completedAt: `2026-01-${String(day + 7).padStart(2, "0")}T00:00:00Z`,
  completedScopeHistory: [0, points / 2, points],
})
describe("planning forecast", () => {
  it("uses only the latest five closed cycles and keeps zero-velocity cycles", () => {
    const result = calculateVelocity([
      cycle("old", 999, 1),
      cycle("1", 0, 2),
      cycle("2", 10, 3),
      cycle("3", 20, 4),
      cycle("4", 30, 5),
      cycle("5", 40, 6),
      { ...cycle("active", 999, 7), completedAt: null },
    ])
    expect(result.samples).toHaveLength(5)
    expect(result.averagePoints).toBe(20)
    expect(result.averageDays).toBe(7)
  })
  it("does not assume zero when history is missing", () => {
    expect(
      calculateVelocity([
        { ...cycle("missing", 10, 1), completedScopeHistory: [] },
      ]).averagePoints
    ).toBeNull()
  })
  it("separates completed and remaining points and excludes epics and canceled work", () => {
    const nodes = [
      { ...normalDag.nodes[0], pts: 3 },
      { ...normalDag.nodes[1], pts: 5 },
      { ...normalDag.nodes[2], pts: null },
      { ...normalDag.nodes[3], isEpic: true, pts: 99 },
      {
        ...normalDag.nodes[3],
        id: "canceled",
        type: "canceled" as const,
        pts: 99,
      },
    ]
    expect(planPoints(nodes)).toEqual({
      total: 8,
      remaining: 5,
      completed: 3,
      unestimated: 1,
      pendingCount: 2,
    })
  })
  it("calculates team capacity and marks estimates as partial", () => {
    const velocity = calculateVelocity([cycle("1", 10, 1), cycle("2", 30, 8)])
    const points = {
      total: 50,
      remaining: 40,
      completed: 10,
      unestimated: 2,
      pendingCount: 8,
    }
    expect(forecastPlan(points, velocity, false)).toEqual({
      cycles: 2,
      days: 14,
      partial: true,
    })
    expect(forecastPlan(points, velocity, true)).toBeNull()
    expect(
      forecastPlan(points, calculateVelocity([cycle("one", 10, 1)]), false)
    ).toBeNull()
    expect(
      forecastPlan(
        points,
        calculateVelocity([cycle("1", 0, 1), cycle("2", 0, 8)]),
        false
      )
    ).toBeNull()
  })
})
