import { afterEach, describe, expect, it, vi } from "vitest"
import {
  scopedApiUrl,
  scopedPageUrl,
  workspaceBase,
  workspacePath,
} from "./routes"

const workspaceId = "11111111-1111-4111-8111-111111111111"
const teamId = "22222222-2222-4222-8222-222222222222"
const base = workspacePath(workspaceId, teamId)

afterEach(() => vi.unstubAllGlobals())

describe("workspace routes", () => {
  it("keeps navigation within the selected team", () => {
    expect(workspaceBase(`${base}/planning/stage`)).toBe(base)
    expect(scopedPageUrl("/planning/stage", `${base}/planning`)).toBe(
      `${base}/planning/stage`
    )
  })

  it("includes the selected workspace and team in every API request", () => {
    vi.stubGlobal("window", {
      location: { pathname: `${base}/planning`, origin: "https://example.com" },
    })
    expect(scopedApiUrl("/api/issues/MOVO-1?cycle=current")).toBe(
      `/api/issues/MOVO-1?cycle=current&workspaceId=${workspaceId}&teamId=${teamId}`
    )
  })
})
