import { useCallback, useEffect, useState } from 'react'
import { buildStructureRuntimePath, readRouteMatrixCellId, readRouteStructureId } from './workspaceRuntime'

type UseStructureRouteOptions = {
    applicationId?: string | null
    conceptSectionId?: string | null
    navigate?: (path: string) => void
}

export function useStructureRoute({ applicationId, conceptSectionId, navigate }: UseStructureRouteOptions) {
    const [routeStructureId, setRouteStructureId] = useState<string | null>(() => readRouteStructureId(applicationId))
    const [routeCellId, setRouteCellId] = useState<string | null>(() => readRouteMatrixCellId())

    const navigateToStructure = useCallback(
        (structureId: string | null, options: { replace?: boolean; focusedCellId?: string | null } = {}) => {
            const nextPath = buildStructureRuntimePath(
                applicationId ?? undefined,
                conceptSectionId,
                structureId,
                options.focusedCellId ?? null
            )
            if (!nextPath || typeof window === 'undefined') return

            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
            if (nextPath !== currentPath) {
                if (options.replace) {
                    window.history.replaceState(null, '', nextPath)
                } else if (navigate) {
                    navigate(nextPath)
                } else {
                    window.history.pushState(null, '', nextPath)
                }
            }
            setRouteStructureId(structureId)
            setRouteCellId(options.focusedCellId ?? null)
        },
        [applicationId, conceptSectionId, navigate]
    )

    const navigateToCell = useCallback(
        (cellId: string | null, options: { replace?: boolean } = {}) => {
            navigateToStructure(routeStructureId, { ...options, focusedCellId: cellId })
        },
        [navigateToStructure, routeStructureId]
    )

    useEffect(() => {
        const handlePopState = () => {
            setRouteStructureId(readRouteStructureId(applicationId))
            setRouteCellId(readRouteMatrixCellId())
        }

        handlePopState()
        if (typeof window === 'undefined') return undefined
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [applicationId])

    return { routeStructureId, routeCellId, navigateToStructure, navigateToCell }
}
