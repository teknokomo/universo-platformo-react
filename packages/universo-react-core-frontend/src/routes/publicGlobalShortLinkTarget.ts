import type { GlobalShortLinkTarget } from '@universo-react/types'

/** Build only same-origin application paths from the validated target union. */
export const getPublicGlobalShortLinkPath = (target: GlobalShortLinkTarget): string | null => {
    if (target.kind === 'lms-access-link') return null

    const applicationPath = `/a/${encodeURIComponent(target.applicationId)}`
    if (target.kind === 'application-entry') return applicationPath

    if (target.kind === 'application-section') {
        if (target.section === 'dashboard') return applicationPath
        if (target.section === 'workspace') return `${applicationPath}/workspaces`
        return null
    }

    if (target.kind === 'application-resource') {
        const query = new URLSearchParams({ targetKind: target.targetKind, entityTypeCodename: target.entityTypeCodename })
        return `${applicationPath}?${query.toString()}`
    }

    // Quiz targets are resolved through the dedicated guest-runtime route.
    return null
}
