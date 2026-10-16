import { test, expect, type Page } from "@playwright/test"
import { fixture } from "./fixture"
import type { IssueUpdateInput } from "@/lib/schema/issue-update"

test.beforeEach(async ({ page }) => {
  await page.route("**/api/sync", (route) =>
    route.fulfill({ json: { changed: false } })
  )
  await page.route("**/api/issues/search?*", (route) =>
    route.fulfill({ json: { results: [] } })
  )
})
async function openIssue(page: Page, id = "MOVO-1") {
  await page.goto(`/?issue=${id}&cycle=cycle-test`)
  await expect(
    page.getByRole("heading", {
      name: fixture.nodes.find((node) => node.id === id)!.title,
      exact: true,
    })
  ).toBeVisible()
}
async function mockUpdates(
  page: Page,
  opts: { conflict?: boolean; unsynced?: boolean; failOnce?: boolean } = {}
) {
  const snapshot = structuredClone(fixture)
  const requests: {
    issueId: string
    input: IssueUpdateInput
    expected?: IssueUpdateInput
  }[] = []
  let failed = false
  await page.route("**/api/issues", async (route) => {
    const body = route.request().postDataJSON() as (typeof requests)[number]
    requests.push(body)
    if (opts.failOnce && !failed) {
      failed = true
      return route.fulfill({
        status: 502,
        json: { error: "Linear temporalmente no disponible" },
      })
    }
    if (opts.conflict && body.expected)
      return route.fulfill({
        status: 409,
        json: { error: "La issue cambió después." },
      })
    const node = snapshot.nodes.find((node) => node.id === body.issueId)!
    const values = {
      stateId: node.stateId,
      assigneeId: node.assigneeId,
      estimate: node.pts,
      cycleId: node.inCycle ? snapshot.cycle.id : null,
    }
    const before = Object.fromEntries(
      Object.keys(body.input).map((key) => [
        key,
        values[key as keyof typeof values],
      ])
    )
    if ("assigneeId" in body.input) {
      node.assigneeId = body.input.assigneeId ?? null
      node.who =
        snapshot.members.find((member) => member.id === node.assigneeId)
          ?.name ?? null
    }
    if ("estimate" in body.input) node.pts = body.input.estimate ?? null
    if (body.input.stateId) {
      const state = snapshot.states.find(
        (state) => state.id === body.input.stateId
      )!
      node.stateId = state.id
      node.type = state.type
      node.status = state.name
    }
    if ("cycleId" in body.input)
      node.inCycle = body.input.cycleId === snapshot.cycle.id
    await page.evaluate(
      (next) =>
        window.dispatchEvent(
          new CustomEvent("fixture-snapshot", { detail: next })
        ),
      snapshot
    )
    return route.fulfill({
      json: {
        issueId: body.issueId,
        before,
        after: body.input,
        synced: !opts.unsynced,
        ...(opts.unsynced
          ? {
              syncError:
                "El cambio se guardó en Linear, pero no se pudo sincronizar.",
            }
          : {}),
      },
    })
  })
  return requests
}

test("combines filters without moving nodes and restores URL with back/forward", async ({
  page,
}) => {
  await page.goto("/")
  const node = page.locator('[data-node-id="MOVO-1"]')
  await expect(node).toBeVisible()
  const original = await node.getAttribute("transform")
  await page.getByRole("button", { name: "Responsable", exact: true }).click()
  await page.getByRole("menuitemcheckbox", { name: "Ana", exact: true }).click()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Bloqueadas", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "1 de 5 issues" })
  ).toBeVisible()
  expect(await node.getAttribute("transform")).toBe(original)
  await expect(page.locator('[data-node-id="MOVO-2"]')).toHaveAttribute(
    "opacity",
    "0.14"
  )
  const shared = page.url()
  await page.getByRole("button", { name: "Sin estimar", exact: true }).click()
  await expect(page.getByText("No hay issues que coincidan.")).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(shared)
  await expect(
    page.getByRole("status").filter({ hasText: "1 de 5 issues" })
  ).toBeVisible()
  await page.goForward()
  await expect(page.getByText("No hay issues que coincidan.")).toBeVisible()
  await page
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .first()
    .click()
  await expect(
    page.getByRole("status").filter({ hasText: "5 de 5 issues" })
  ).toBeVisible()
})

test("summary actions open a list, focus issues and render safe Markdown", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Ver bloqueadas", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Bloqueadas · 2", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: /Transferencias internacionales MOVO-1/ })
    .click()
  await expect(
    page.getByRole("heading", {
      name: "Implementar transferencias internacionales",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Objetivo", exact: true })
  ).toBeVisible()
  await expect(page.locator(".issue-markdown table")).toBeVisible()
  await expect(page.locator(".issue-markdown pre")).toContainText(
    "const listo = true"
  )
  expect(await page.locator(".issue-markdown script").count()).toBe(0)
  expect(
    await page
      .getByRole("link", { name: "Inseguro", exact: true })
      .getAttribute("href")
  ).not.toMatch(/^javascript:/)
  const selected = page.locator('[data-node-id="MOVO-1"]')
  await expect(selected).toHaveAttribute("aria-pressed", "true")
  await page.waitForTimeout(550)
  const bounds = await selected.boundingBox()
  const canvas = await page
    .locator("svg")
    .filter({ has: selected })
    .boundingBox()
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - (canvas!.x + canvas!.width / 2))
  ).toBeLessThan(5)
  await page.getByRole("button", { name: /Bloqueante externo MOVO-5/ }).click()
  await expect(
    page.getByRole("heading", { name: "Bloqueante externo", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Descripción del bloqueante externo.", { exact: true })
  ).toBeVisible()
  await expect(page.locator('[data-node-id="MOVO-5"]')).toBeVisible()
  await expect(
    page.getByText("Mostrando issue seleccionada fuera de los filtros.")
  ).toBeVisible()
})

test("search focuses a standalone issue and copied links restore issue plus filters", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/?condition=ready")
  await page.getByRole("button", { name: /Agregar issue/ }).click()
  await page
    .getByPlaceholder("Buscar por título o código (ej. MOVO-123)…")
    .fill("MOVO-3")
  await page.getByRole("option", { name: /Textos de onboarding/ }).click()
  await expect(
    page.getByRole("heading", {
      name: "Revisar textos del onboarding",
      exact: true,
    })
  ).toBeVisible()
  await expect(page.locator('[data-node-id="MOVO-3"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await page
    .getByRole("button", { name: "Copiar enlace de issue", exact: true })
    .click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(new URL(copied).searchParams.get("issue")).toBe("MOVO-3")
  expect(new URL(copied).searchParams.get("condition")).toBe("ready")
  await page.goto(copied)
  await expect(
    page.getByRole("heading", {
      name: "Revisar textos del onboarding",
      exact: true,
    })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Compartir vista", exact: true })
    .click()
  const view = await page.evaluate(() => navigator.clipboard.readText())
  expect(new URL(view).searchParams.get("issue")).toBeNull()
  expect(new URL(view).searchParams.get("condition")).toBe("ready")
})

test("reports missing issues and old cycles without breaking the view", async ({
  page,
}) => {
  await page.goto("/?cycle=old-cycle&issue=MOVO-999&condition=unassigned")
  await expect(
    page.getByText("El ciclo del enlace cambió.", { exact: false })
  ).toBeVisible()
  await expect(
    page.getByText("La issue MOVO-999 no está disponible", { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Acciones del ciclo", exact: true })
  ).toBeVisible()
})

test("undo restores a nullable assignee and later same-field edits invalidate old receipts", async ({
  page,
}) => {
  const requests = await mockUpdates(page)
  await openIssue(page, "MOVO-3")
  const assignee = page.getByRole("combobox", {
    name: "Responsable de MOVO-3",
    exact: true,
  })
  await assignee.selectOption("ana")
  await expect(
    page.getByText("MOVO-3 · Responsable actualizado", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Deshacer", exact: true }).click()
  await expect(assignee).toHaveValue("")
  await expect(
    page.getByText("MOVO-3 · Cambio deshecho", { exact: true })
  ).toBeVisible()
  expect(requests[1]).toMatchObject({
    input: { assigneeId: null },
    expected: { assigneeId: "ana" },
  })
  await assignee.selectOption("ana")
  await expect(assignee).toBeEnabled()
  await assignee.selectOption("bob")
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true })
  ).toHaveCount(1)
})

test("undo conflicts are explained and failed writes can be retried", async ({
  page,
}) => {
  const requests = await mockUpdates(page, { conflict: true, failOnce: true })
  await openIssue(page, "MOVO-3")
  await page
    .getByRole("combobox", { name: "Puntos de MOVO-3", exact: true })
    .selectOption("3")
  await expect(
    page.getByText("No se pudo guardar el cambio", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Reintentar", exact: true }).click()
  await expect(
    page.getByText("MOVO-3 · Puntos actualizados", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Deshacer", exact: true }).click()
  await expect(
    page.getByText("No se pudo deshacer", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Deshacer", exact: true })
  ).toHaveCount(0)
  expect(requests).toHaveLength(3)
})

test("successful Linear changes keep undo when sync fails and cycle additions restore null", async ({
  page,
}) => {
  const requests = await mockUpdates(page, { unsynced: true })
  await openIssue(page, "MOVO-5")
  await page
    .getByRole("button", { name: "Agregar al ciclo", exact: true })
    .click()
  await expect(
    page.getByText(
      "El cambio se guardó en Linear, pero no se pudo sincronizar.",
      { exact: true }
    )
  ).toBeVisible()
  await page.getByRole("button", { name: "Deshacer", exact: true }).click()
  await expect(
    page.getByText("MOVO-5 · Cambio deshecho", { exact: true })
  ).toBeVisible()
  expect(requests[1]).toMatchObject({
    input: { cycleId: null },
    expected: { cycleId: "cycle-test" },
  })
})

test("undo expires after 15 seconds and pauses while hovered", async ({
  page,
}) => {
  await page.clock.install()
  await mockUpdates(page)
  await openIssue(page, "MOVO-3")
  await page
    .getByRole("combobox", { name: "Puntos de MOVO-3", exact: true })
    .selectOption("3")
  const undo = page.getByRole("button", { name: "Deshacer", exact: true })
  await expect(undo).toBeVisible()
  await undo.hover()
  await page.clock.fastForward(20000)
  await expect(undo).toBeVisible()
  await page.mouse.move(0, 0)
  await page
    .getByRole("heading", {
      name: "Revisar textos del onboarding",
      exact: true,
    })
    .click()
  await page.clock.fastForward(16000)
  await expect(undo).toHaveCount(0)
})

test("panel resizes with keyboard and mobile detail opens as a full-width dialog", async ({
  page,
}) => {
  await openIssue(page)
  const separator = page.getByRole("separator", {
    name: "Ancho del panel",
    exact: true,
  })
  const width = Number(await separator.getAttribute("aria-valuenow"))
  await separator.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(separator).toHaveAttribute("aria-valuenow", String(width + 24))
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("dialog")).toBeVisible()
  const dialog = await page.getByRole("dialog").boundingBox()
  expect(dialog!.width).toBe(390)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page
    .getByRole("button", { name: "Expandir panel de resumen", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toBeVisible()
})
