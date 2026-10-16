/** Bound Linear requests without dropping results or changing their order. */
export async function mapConcurrent<T, R>(
  values: T[],
  map: (value: T) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const result: R[] = new Array(values.length)
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (index < values.length) {
        const current = index++
        result[current] = await map(values[current])
      }
    })
  )
  return result
}
