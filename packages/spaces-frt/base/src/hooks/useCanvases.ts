// English-only comments in code files.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@universo/api-client' // Replaced: import canvasesApi from '../api/canvases'
import useApi from './useApi'

interface Canvas {
    id: string
    name: string
    flowData: string
    sortOrder?: number
    isDirty?: boolean
    [key: string]: unknown
}

interface CanvasCreateOptions {
    flowData?: string | { nodes: unknown[]; edges: unknown[] }
    sortOrder?: number
}

interface CanvasOrderItem {
    canvasId: string
    sortOrder: number
}

interface UseCanvasesReturn {
    canvases: Canvas[]
    activeCanvasId: string | null
    loading: boolean
    error: Error | string | null
    selectCanvas: (canvasId: string) => void
    createCanvas: (name?: string, options?: CanvasCreateOptions) => Promise<Canvas | null>
    renameCanvas: (canvasId: string, newName: string) => Promise<boolean>
    deleteCanvas: (canvasId: string) => Promise<boolean>
    duplicateCanvas: (canvasId: string) => Promise<Canvas | null>
    reorderCanvas: (canvasId: string, newIndex: number) => Promise<boolean>
    updateCanvasData: (canvasId: string, data: Partial<Canvas>) => Promise<boolean>
    markCanvasDirty: (canvasId: string, isDirty?: boolean) => void
    getActiveCanvas: () => Canvas | null
    refresh: (...args: unknown[]) => Promise<unknown>
}

// Hook to manage canvases list/state within a Space
const useCanvases = (spaceId: string | undefined): UseCanvasesReturn => {
    const { unikId } = useParams<{ unikId: string }>()
    const [canvases, setCanvases] = useState<Canvas[]>([])
    const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | string | null>(null)

    // API hooks
    const getCanvasesApi = useApi(() => api.canvases.getCanvases(unikId, spaceId))
    const createCanvasApi = useApi(api.canvases.createCanvas)
    const updateCanvasApi = useApi((unik: string, canvasId: string, body: unknown, options = {}) =>
        api.canvases.updateCanvas(unik, canvasId, body, { ...options, spaceId })
    )
    const deleteCanvasApi = useApi((unik: string, canvasId: string, options = {}) =>
        api.canvases.deleteCanvas(unik, canvasId, { ...options, spaceId })
    )
    const reorderCanvasesApi = useApi(api.canvases.reorderCanvases)

    // Load canvases when spaceId changes
    useEffect(() => {
        if (spaceId && unikId) getCanvasesApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId, unikId])

    // Update local state when API data changes
    useEffect(() => {
        if (!getCanvasesApi.data) return
        const raw = getCanvasesApi.data
        let list: Canvas[] = []
        if (Array.isArray(raw)) list = raw
        else if (Array.isArray((raw as { data?: { canvases?: Canvas[] } })?.data?.canvases))
            list = (raw as { data: { canvases: Canvas[] } }).data.canvases
        else if (Array.isArray((raw as { canvases?: Canvas[] })?.canvases)) list = (raw as { canvases: Canvas[] }).canvases

        const sorted = [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        setCanvases(sorted)
        if (!activeCanvasId && sorted.length > 0) setActiveCanvasId(sorted[0].id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getCanvasesApi.data])

    // Update loading state
    useEffect(() => {
        setLoading(
            getCanvasesApi.loading ||
                createCanvasApi.loading ||
                updateCanvasApi.loading ||
                deleteCanvasApi.loading ||
                reorderCanvasesApi.loading
        )
    }, [getCanvasesApi.loading, createCanvasApi.loading, updateCanvasApi.loading, deleteCanvasApi.loading, reorderCanvasesApi.loading])

    // Update error state
    useEffect(() => {
        const apiError =
            getCanvasesApi.error || createCanvasApi.error || updateCanvasApi.error || deleteCanvasApi.error || reorderCanvasesApi.error
        setError(apiError)
    }, [getCanvasesApi.error, createCanvasApi.error, updateCanvasApi.error, deleteCanvasApi.error, reorderCanvasesApi.error])

    // Operations
    const selectCanvas = useCallback((canvasId: string) => {
        setActiveCanvasId(canvasId)
    }, [])

    const createCanvas = useCallback(
        async (name = 'New Canvas', options: CanvasCreateOptions = {}): Promise<Canvas | null> => {
            if (!spaceId || !unikId) return null
            try {
                const flowPayload = options.flowData
                const flowDataString =
                    typeof flowPayload === 'string' ? flowPayload : JSON.stringify(flowPayload || { nodes: [], edges: [] })
                const created = (await createCanvasApi.request(unikId, spaceId, {
                    name,
                    flowData: flowDataString,
                    sortOrder: options.sortOrder ?? canvases.length + 1
                })) as Canvas | undefined
                if (created?.id) setActiveCanvasId(created.id)
                if (created) {
                    setCanvases((prev) => {
                        const next = [...prev, { ...created }]
                        return next.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    })
                }
                return created || null
            } catch (err) {
                throw err
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [spaceId, unikId, canvases.length]
    )

    const renameCanvas = useCallback(
        async (canvasId: string, newName: string): Promise<boolean> => {
            if (!canvasId || !newName?.trim()) return false
            await updateCanvasApi.request(unikId, canvasId, { name: newName.trim() }, { spaceId })
            setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, name: newName.trim() } : c)))
            return true
        },
        [unikId, spaceId, updateCanvasApi]
    )

    const deleteCanvas = useCallback(
        async (canvasId: string): Promise<boolean> => {
            if (!canvasId || canvases.length <= 1) return false
            await deleteCanvasApi.request(unikId, canvasId, { spaceId })
            if (activeCanvasId === canvasId) {
                const remain = canvases.filter((c) => c.id !== canvasId)
                if (remain.length > 0) setActiveCanvasId(remain[0].id)
            }
            await getCanvasesApi.request()
            return true
        },
        [canvases, activeCanvasId, unikId, spaceId, deleteCanvasApi, getCanvasesApi]
    )

    const duplicateCanvas = useCallback(
        async (canvasId: string): Promise<Canvas | null> => {
            const src = canvases.find((c) => c.id === canvasId)
            if (!src) return null
            const dupe = (await createCanvasApi.request(unikId, spaceId, {
                name: `${src.name} (Copy)`,
                flowData: src.flowData,
                sortOrder: canvases.length + 1
            })) as Canvas | undefined
            if (dupe?.id) setActiveCanvasId(dupe.id)
            await getCanvasesApi.request()
            return dupe || null
        },
        [canvases, unikId, spaceId, createCanvasApi, getCanvasesApi]
    )

    const reorderCanvas = useCallback(
        async (canvasId: string, newIndex: number): Promise<boolean> => {
            if (!canvasId || newIndex < 0 || newIndex >= canvases.length) return false
            const reordered = [...canvases]
            const currIdx = reordered.findIndex((c) => c.id === canvasId)
            if (currIdx === -1) return false
            const [moved] = reordered.splice(currIdx, 1)
            reordered.splice(newIndex, 0, moved)
            const canvasOrders: CanvasOrderItem[] = reordered.map((c, i) => ({
                canvasId: c.id,
                sortOrder: i + 1
            }))
            await reorderCanvasesApi.request(unikId, spaceId, { canvasOrders })
            await getCanvasesApi.request()
            return true
        },
        [canvases, unikId, spaceId, reorderCanvasesApi, getCanvasesApi]
    )

    const updateCanvasData = useCallback(
        async (canvasId: string, data: Partial<Canvas>): Promise<boolean> => {
            if (!canvasId) return false
            await updateCanvasApi.request(unikId, canvasId, data, { spaceId })
            setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, ...data } : c)))
            return true
        },
        [unikId, spaceId, updateCanvasApi]
    )

    const getActiveCanvas = useCallback(
        (): Canvas | null => canvases.find((c) => c.id === activeCanvasId) || null,
        [canvases, activeCanvasId]
    )

    const markCanvasDirty = useCallback((canvasId: string, isDirty = true) => {
        setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, isDirty } : c)))
    }, [])

    return {
        canvases,
        activeCanvasId,
        loading,
        error,
        selectCanvas,
        createCanvas,
        renameCanvas,
        deleteCanvas,
        duplicateCanvas,
        reorderCanvas,
        updateCanvasData,
        markCanvasDirty,
        getActiveCanvas,
        refresh: getCanvasesApi.request
    }
}

export default useCanvases
