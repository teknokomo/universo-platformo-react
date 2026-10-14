const readCurrentRuntimeUrl = (): URL | undefined => {
    if (typeof window === 'undefined') return undefined

    const hashRoute = window.location.hash.startsWith('#/a/') ? window.location.hash.slice(1) : undefined
    try {
        return new URL(hashRoute ?? `${window.location.pathname}${window.location.search}${window.location.hash}`, window.location.origin)
    } catch {
        return undefined
    }
}

/** Builds the same runtime route with its workspace context changed. */
export const buildWorkspaceSwitchHref = (workspaceId: string): string | undefined => {
    const currentUrl = readCurrentRuntimeUrl()
    if (!currentUrl || !currentUrl.pathname.startsWith('/a/')) return undefined

    const workspaceRoute = currentUrl.pathname.match(/^(\/a\/[^/]+\/workspaces)\/[^/]+(\/(?:access|settings))?$/u)
    if (workspaceRoute) {
        currentUrl.pathname = `${workspaceRoute[1]}/${encodeURIComponent(workspaceId)}${workspaceRoute[2] ?? ''}`
    }
    currentUrl.searchParams.set('workspaceId', workspaceId)

    return `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
}
