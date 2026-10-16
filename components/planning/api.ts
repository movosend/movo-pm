export async function planningRequest<T>(
  url: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined
  )
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la operación.")
  return data
}
