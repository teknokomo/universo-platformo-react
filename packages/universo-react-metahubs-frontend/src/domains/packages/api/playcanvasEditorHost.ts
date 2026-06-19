import { useQuery } from '@tanstack/react-query'
import type { PackageAuthoringHostDescriptor, PackageDisplayMode } from '@universo-react/types'

import { metahubsQueryKeys } from '../../shared'
import { packagesApi } from './packagesApi'

export const PLAYCANVAS_EDITOR_PACKAGE_SLUG = 'playcanvas-editor'

/**
 * Display mode the PlayCanvas Editor package is configured to open in, or `null`
 * when the package is not attached as a display surface. `null` and any
 * non-`openSeparately` mode resolve to inline navigation in {@link openPlayCanvasEditor}.
 */
export type EditorDisplayMode = PackageDisplayMode | null

export const resolveEditorDisplayMode = (host: PackageAuthoringHostDescriptor | undefined): EditorDisplayMode => {
    const config = host?.attachmentConfig
    if (!config || config.kind !== 'display') return null
    return config.display.mode ?? 'disabled'
}

/**
 * Single shared query for the PlayCanvas Editor authoring-host descriptor of a
 * metahub. Every consumer (binding card, row action) reuses this key so the
 * React Query cache and its invalidation surface are shared — changing the
 * package's display mode updates all consumers at once.
 */
export const usePlayCanvasEditorHostQuery = (metahubId: string | undefined, enabled = true) =>
    useQuery({
        queryKey: [...metahubsQueryKeys.packagesAttached(metahubId ?? ''), 'playcanvas-editor-host'],
        queryFn: () => packagesApi.getAuthoringHost(metahubId as string, PLAYCANVAS_EDITOR_PACKAGE_SLUG),
        enabled: Boolean(metahubId) && enabled
    })

/**
 * Opens the PlayCanvas Editor for a metahub, honoring the package's display
 * mode: `openSeparately` pops the `/fullscreen` route in a new tab, every other
 * mode navigates inline. `projectId` is forwarded as `?projectId=…` so the
 * bridge session pins to THIS project instead of the package default.
 */
export const openPlayCanvasEditor = (params: { metahubId: string; projectId?: string | null; displayMode: EditorDisplayMode }): void => {
    const basePath = `/metahub/${params.metahubId}/resources/packages/${PLAYCANVAS_EDITOR_PACKAGE_SLUG}/editor`
    const useFullscreen = params.displayMode === 'openSeparately'
    const targetPath = useFullscreen ? `${basePath}/fullscreen` : basePath
    const query = params.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : ''
    const fullUrl = `${targetPath}${query}`
    if (useFullscreen) {
        window.open(fullUrl, '_blank', 'noopener,noreferrer')
    } else {
        window.location.assign(fullUrl)
    }
}
