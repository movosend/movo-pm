import { beforeEach, describe, expect, it, vi } from "vitest"
import { normalDag } from "@/lib/graph/__fixtures__"
vi.mock("server-only", () => ({}))
const mocks = vi.hoisted(() => ({
  getIssueDetail: vi.fn(),
  createDependency: vi.fn(),
  deleteDependency: vi.fn(),
  requireStage: vi.fn(),
  stageItems: vi.fn(),
}))
vi.mock("@/lib/linear/client", () => ({ getLinearSource: () => mocks }))
vi.mock("./store", () => ({
  requireStage: mocks.requireStage,
  stageItems: mocks.stageItems,
  teamKey: () => "MOVO",
}))
import { editDependency } from "./dependencies"
const root = {
  ...normalDag.nodes[1],
  id: "MOVO-1",
  uuid: "uuid-1",
  isEpic: false,
}
const target = {
  ...normalDag.nodes[2],
  id: "MOVO-2",
  uuid: "uuid-2",
  isEpic: false,
}
const detail = (node = root, blocks: [string, string][] = []) => ({
  nodes: [node],
  blocks,
  states: [],
  members: [],
  blockingRelations: [],
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.stageItems.mockResolvedValue([{ issueId: root.uuid }])
  mocks.getIssueDetail.mockImplementation(async (id: string) =>
    detail(id === "MOVO-2" ? target : root)
  )
})
describe("editing dependencies", () => {
  it("writes blocked-by in the correct Linear direction", async () => {
    await editDependency("stage", {
      sourceId: "MOVO-1",
      targetId: "MOVO-2",
      direction: "blockedBy",
      requestId: "request",
    })
    expect(mocks.createDependency).toHaveBeenCalledWith(
      "request",
      "uuid-2",
      "uuid-1"
    )
  })
  it("writes blocks in the opposite direction", async () => {
    await editDependency("stage", {
      sourceId: "MOVO-1",
      targetId: "MOVO-2",
      direction: "blocks",
      requestId: "request",
    })
    expect(mocks.createDependency).toHaveBeenCalledWith(
      "request",
      "uuid-1",
      "uuid-2"
    )
  })
  it("rejects self-blocking, epics and issues not in the sheet", async () => {
    await expect(
      editDependency("stage", {
        sourceId: "MOVO-1",
        targetId: "MOVO-1",
        direction: "blocks",
        requestId: "request",
      })
    ).rejects.toThrow("sí misma")
    mocks.getIssueDetail.mockResolvedValue(detail({ ...root, isEpic: true }))
    await expect(
      editDependency("stage", { sourceId: "MOVO-1" })
    ).rejects.toThrow("trabajo")
    mocks.getIssueDetail.mockResolvedValue(detail())
    mocks.stageItems.mockResolvedValue([])
    await expect(
      editDependency("stage", { sourceId: "MOVO-1" })
    ).rejects.toThrow("plan")
    expect(mocks.createDependency).not.toHaveBeenCalled()
  })
  it("does not recreate an existing relation", async () => {
    mocks.getIssueDetail
      .mockResolvedValueOnce(detail(root, [["MOVO-1", "MOVO-2"]]))
      .mockResolvedValueOnce(detail(target))
    expect(
      await editDependency("stage", {
        sourceId: "MOVO-1",
        targetId: "MOVO-2",
        direction: "blocks",
        requestId: "request",
      })
    ).toEqual({ changed: false })
    expect(mocks.createDependency).not.toHaveBeenCalled()
  })
  it("only removes a relation attached to the source issue", async () => {
    expect(
      await editDependency("stage", {
        sourceId: "MOVO-1",
        removeId: "unrelated",
      })
    ).toEqual({ changed: false })
    expect(mocks.deleteDependency).not.toHaveBeenCalled()
    mocks.getIssueDetail.mockResolvedValue({
      ...detail(),
      blockingRelations: [
        { id: "relation", blocker: root.id, blocked: target.id },
      ],
    })
    await editDependency("stage", { sourceId: "MOVO-1", removeId: "relation" })
    expect(mocks.deleteDependency).toHaveBeenCalledWith("relation")
  })
  it("recovers a creation whose response was lost", async () => {
    mocks.getIssueDetail
      .mockResolvedValueOnce(detail())
      .mockResolvedValueOnce(detail(target))
      .mockResolvedValueOnce(detail(root, [[root.id, target.id]]))
    mocks.createDependency.mockRejectedValue(new Error("Response lost"))
    await expect(
      editDependency("stage", {
        sourceId: root.id,
        targetId: target.id,
        direction: "blocks",
        requestId: "request",
      })
    ).resolves.toEqual({ changed: true })
    expect(mocks.createDependency).toHaveBeenCalledTimes(1)
  })
})
