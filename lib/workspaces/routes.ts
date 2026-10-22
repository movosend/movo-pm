export function workspacePath(
  workspaceId: string,
  teamId: string,
  suffix = ""
) {
  return `/w/${workspaceId}/t/${teamId}${suffix}`
}

export function currentWorkspacePath(): string {
  if (typeof window === "undefined") return ""
  return workspaceBase(window.location.pathname)
}

export function workspaceBase(pathname: string): string {
  const match = pathname.match(
    /^\/w\/([0-9a-f-]{36})\/t\/([0-9a-f-]{36})(?:\/|$)/i
  )
  return match ? workspacePath(match[1], match[2]) : ""
}

export function scopedPageUrl(path: string, pathname?: string): string {
  return `${pathname ? workspaceBase(pathname) : currentWorkspacePath()}${path === "/" ? "" : path}`
}

export function scopedApiUrl(path: string): string {
  const base = currentWorkspacePath()
  if (!base) return path
  const match = base.match(/^\/w\/([^/]+)\/t\/([^/]+)$/)!
  const url = new URL(path, window.location.origin)
  url.searchParams.set("workspaceId", match[1])
  url.searchParams.set("teamId", match[2])
  return url.pathname + url.search
}
