const router = {
  refresh: () => window.dispatchEvent(new Event("fixture-refresh")),
}
export function useRouter() {
  return router
}
