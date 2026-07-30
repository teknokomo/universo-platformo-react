import { useCallback, useEffect, useState } from 'react'
import { buildStructureRuntimePath, readRouteMatrixCellId, readRouteStructureId } from './workspaceRuntime'

type UseStructureRouteOptions = {
    applicationId?: string | null
    conceptSectionId?: string | null
    navigate?: (path: string) => void
    singleMode?: boolean
}

export function useStructureRoute({ applicationId, conceptSectionId, navigate, singleMode = false }: UseStructureRouteOptions) {
    const [routeStructureId, setRouteStructureId] = useState<string | null>(() => (singleMode ? null : readRouteStructureId(applicationId)))
    const [routeCellId, setRouteCellId] = useState<string | null>(() => readRouteMatrixCellId())

    const navigateToStructure = useCallback(
        (structureId: string | null, options: { replace?: boolean; focusedCellId?: string | null } = {}) => {
            const nextPath = buildStructureRuntimePath(
                applicationId ?? undefined,
                conceptSectionId,
                singleMode ? null : structureId,
                options.focusedCellId ?? null,
                { includeStructureSection: !singleMode }
            )
            if (!nextPath || typeof window === 'undefined') return

            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
            if (nextPath !== currentPath) {
                if (options.replace) {
                    window.history.replaceState(null, '', nextPath)
                    window.dispatchEvent(new PopStateEvent('popstate'))
                } else if (navigate) {
                    navigate(nextPath)
                } else {
                    window.history.pushState(null, '', nextPath)
                    window.dispatchEvent(new PopStateEvent('popstate'))
                }
            }
            setRouteStructureId(singleMode ? null : structureId)
            setRouteCellId(options.focusedCellId ?? null)
        },
        [applicationId, conceptSectionId, navigate, singleMode]
    )

    const navigateToCell = useCallback(
        (cellId: string | null, options: { replace?: boolean } = {}) => {
            navigateToStructure(singleMode ? null : routeStructureId, { ...options, focusedCellId: cellId })
        },
        [navigateToStructure, routeStructureId, singleMode]
    )

    useEffect(() => {
        const handlePopState = () => {
            setRouteStructureId(singleMode ? null : readRouteStructureId(applicationId))
            setRouteCellId(readRouteMatrixCellId())
        }

        handlePopState()
        if (typeof window === 'undefined') return undefined
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [applicationId, singleMode])

    return { routeStructureId, routeCellId, navigateToStructure, navigateToCell }
}
