import { describe, expect, it } from "vitest"
import { transferDecision } from "./transfer-decision"
const base = {
  before: null,
  destination: "next",
  undo: false,
  attempted: false,
}
describe("transfer recovery and undo", () => {
  it("writes only when the current cycle matches the review", () => {
    expect(transferDecision({ ...base, current: null })).toBe("write")
    expect(transferDecision({ ...base, current: "another" })).toBe("conflict")
  })
  it("does not claim an issue already moved by somebody else", () => {
    expect(transferDecision({ ...base, current: "next" })).toBe("skipped")
  })
  it("recovers a lost response without repeating the mutation", () => {
    expect(
      transferDecision({ ...base, attempted: true, current: "next" })
    ).toBe("done")
  })
  it("undoes only assignments still matching the destination", () => {
    expect(transferDecision({ ...base, undo: true, current: "next" })).toBe(
      "write"
    )
    expect(transferDecision({ ...base, undo: true, current: "other" })).toBe(
      "conflict"
    )
    expect(transferDecision({ ...base, undo: true, current: null })).toBe(
      "undone"
    )
  })
  it("restores the prior cycle, including an assignment moved from another cycle", () => {
    expect(
      transferDecision({ ...base, before: "old", undo: true, current: "old" })
    ).toBe("undone")
    expect(transferDecision({ ...base, before: "old", current: "old" })).toBe(
      "write"
    )
  })
})
