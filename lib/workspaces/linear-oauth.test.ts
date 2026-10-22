import { afterEach, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

afterEach(() => vi.unstubAllEnvs())

it("encrypts Linear credentials with authenticated encryption", async () => {
  vi.stubEnv(
    "LINEAR_TOKEN_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64")
  )
  const { decryptToken, encryptToken } = await import("./linear-oauth")
  const first = encryptToken("secret-token")
  const second = encryptToken("secret-token")
  expect(first).not.toBe(second)
  expect(first).not.toContain("secret-token")
  expect(decryptToken(first)).toBe("secret-token")
  const tampered = Buffer.from(first, "base64")
  tampered[tampered.length - 1] ^= 1
  expect(() => decryptToken(tampered.toString("base64"))).toThrow()
})
