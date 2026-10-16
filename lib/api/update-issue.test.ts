import { describe, expect, it, vi } from "vitest"
import {
  IssueConflictError,
  updateIssueWithReceipt,
} from "@/lib/api/update-issue"
import { issueRequestSchema, type IssueValues } from "@/lib/schema/issue-update"

function source(initial: Partial<IssueValues> = {}) {
  let current: IssueValues = {
    stateId: "todo",
    assigneeId: null,
    cycleId: null,
    estimate: null,
    ...initial,
  }
  return {
    getIssueValues: vi.fn(async () => ({ ...current })),
    updateIssue: vi.fn(async (_id: string, input: Partial<IssueValues>) => {
      current = { ...current, ...input }
    }),
  }
}
describe("updates with undo receipts", () => {
  it("reads current Linear values and restores only the edited field, including null", async () => {
    const linear = source()
    const sync = vi.fn(async () => {})
    const result = await updateIssueWithReceipt(linear, sync, "MOVO-1", {
      assigneeId: "ana",
    })
    expect(result.before).toEqual({ assigneeId: null })
    expect(result.after).toEqual({ assigneeId: "ana" })
    await updateIssueWithReceipt(
      linear,
      sync,
      result.issueId,
      result.before,
      result.after
    )
    expect(await linear.getIssueValues()).toMatchObject({
      stateId: "todo",
      assigneeId: null,
    })
  })
  it.each([null, "old-cycle"])(
    "restores previous cycle %s",
    async (cycleId) => {
      const linear = source({ cycleId })
      const result = await updateIssueWithReceipt(
        linear,
        async () => {},
        "MOVO-1",
        { cycleId: "current-cycle" }
      )
      await updateIssueWithReceipt(
        linear,
        async () => {},
        result.issueId,
        result.before,
        result.after
      )
      expect((await linear.getIssueValues()).cycleId).toBe(cycleId)
    }
  )
  it("rejects undo after a later change without writing or syncing", async () => {
    const linear = source({ estimate: 8 })
    const sync = vi.fn()
    await expect(
      updateIssueWithReceipt(
        linear,
        sync,
        "MOVO-1",
        { estimate: null },
        { estimate: 3 }
      )
    ).rejects.toBeInstanceOf(IssueConflictError)
    expect(linear.updateIssue).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })
  it("keeps receipt and reports successful write when sync fails", async () => {
    const linear = source()
    const result = await updateIssueWithReceipt(
      linear,
      async () => {
        throw new Error("database unavailable")
      },
      "MOVO-1",
      { estimate: 0 }
    )
    expect(result).toMatchObject({
      synced: false,
      before: { estimate: null },
      after: { estimate: 0 },
    })
    expect(result.syncError).toBeTruthy()
    expect(linear.updateIssue).toHaveBeenCalledTimes(1)
  })
  it("does not sync or create a receipt when Linear rejects the update", async () => {
    const linear = source()
    linear.updateIssue.mockRejectedValueOnce(new Error("Linear unavailable"))
    const sync = vi.fn()
    await expect(
      updateIssueWithReceipt(linear, sync, "MOVO-1", { stateId: "done" })
    ).rejects.toThrow("Linear unavailable")
    expect(sync).not.toHaveBeenCalled()
  })
  it("validates exact expected fields and rejects malformed mutations", () => {
    expect(
      issueRequestSchema.safeParse({
        issueId: "MOVO-1",
        input: { cycleId: null },
        expected: { cycleId: "current" },
      }).success
    ).toBe(true)
    for (const input of [
      {},
      { stateId: null },
      { estimate: -1 },
      { estimate: "3" },
      { unknown: true },
    ])
      expect(
        issueRequestSchema.safeParse({ issueId: "MOVO-1", input }).success
      ).toBe(false)
    expect(
      issueRequestSchema.safeParse({
        issueId: "MOVO-1",
        input: { estimate: 3 },
        expected: { stateId: "done" },
      }).success
    ).toBe(false)
  })
})
