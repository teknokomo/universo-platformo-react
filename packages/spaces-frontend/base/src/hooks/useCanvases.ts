// English-only comments in code files.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { api, Canvas as ApiCanvas, CreateCanvasPayload, UpdateCanvasPayload, ReorderCanvasPayload } from '@universo/api-client' // Replaced: import canvasesApi from '../api/canvases'
import useApi from './useApi'

// Extended Canvas type with local UI state
interface Canvas extends Omit<ApiCanvas, 'flowData'> {
    flowData: string | null
    sortOrder?: number
    isDirty?: boolean
}

interface CanvasCreateOptions {
    flowData?: string | { nodes: unknown[]; edges: unknown[] }
    sortOrder?: number
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

    // API hooks - explicitly typed wrappers around API calls
    const getCanvasesApi = useApi<Canvas[]>(async () => {
        if (!unikId || !spaceId) return { data: [] }
        const result = await api.canvases.getCanvases(unikId, spaceId)
        return { data: (result.canvases || result.data || []) as Canvas[] }
    })
    const createCanvasApi = useApi<Canvas>(async (...args: unknown[]) => {
        const [unikId, spaceId, body] = args as [string, string, CreateCanvasPayload]
        const result = await api.canvases.createCanvas(unikId, spaceId, body)
        return { data: result as Canvas }
    })
    const updateCanvasApi = useApi<Canvas>(async (...args: unknown[]) => {
        const [unik, canvasId, body] = args as [string, string, UpdateCanvasPayload]
        const result = await api.canvases.updateCanvas(unik, canvasId, body, { spaceId })
        return { data: result as Canvas }
    })
    const deleteCanvasApi = useApi<void>(async (...args: unknown[]) => {
        const [unik, canvasId] = args as [string, string]
        await api.canvases.deleteCanvas(unik, canvasId, { spaceId })
        return { data: undefined as void }
    })
    const reorderCanvasesApi = useApi<void>(async (...args: unknown[]) => {
        const [unikId, spaceId, body] = args as [string, string, ReorderCanvasPayload]
        await api.canvases.reorderCanvases(unikId, spaceId, body)
        return { data: undefined as void }
    })

    // Load canvases when spaceId changes
    useEffect(() => {
        if (spaceId && unikId) getCanvasesApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId, unikId])

    // Update local state when API data changes
    useEffect(() => {
        console.log('[useCanvases] getCanvasesApi.data updated:', {
            hasData: !!getCanvasesApi.data,
            dataType: typeof getCanvasesApi.data,
            isArray: Array.isArray(getCanvasesApi.data),
            dataKeys: getCanvasesApi.data ? Object.keys(getCanvasesApi.data) : [],
            dataLength: Array.isArray(getCanvasesApi.data) ? getCanvasesApi.data.length : 'N/A',
            firstElement:
                Array.isArray(getCanvasesApi.data) && getCanvasesApi.data.length > 0
                    ? {
                          id: getCanvasesApi.data[0]?.id,
                          name: getCanvasesApi.data[0]?.name,
                          hasFlowData: !!getCanvasesApi.data[0]?.flowData
                      }
                    : null
        })

        if (!getCanvasesApi.data) {
            console.log('[useCanvases] No data, exiting')
            return
        }

        const raw = getCanvasesApi.data
        let list: Canvas[] = []
        let matchedPath = 'NONE'

        if (Array.isArray(raw)) {
            console.log('[useCanvases] Matched: Array.isArray(raw), length:', raw.length)
            list = raw
            matchedPath = 'Array.isArray(raw)'
        } else if (Array.isArray((raw as { data?: { canvases?: Canvas[] } })?.data?.canvases)) {
            console.log('[useCanvases] Matched: raw.data.canvases, length:', (raw as any).data.canvases.length)
            list = (raw as { data: { canvases: Canvas[] } }).data.canvases
            matchedPath = 'raw.data.canvases'
        } else if (Array.isArray((raw as { canvases?: Canvas[] })?.canvases)) {
            console.log('[useCanvases] Matched: raw.canvases, length:', (raw as any).canvases.length)
            list = (raw as { canvases: Canvas[] }).canvases
            matchedPath = 'raw.canvases'
        } else {
            console.log('[useCanvases] NO MATCH for parsing logic!')
        }

        console.log('[useCanvases] Parsing result:', {
            matchedPath,
            listLength: list.length,
            firstCanvasId: list.length > 0 ? list[0]?.id : null
        })

        const sorted = [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        setCanvases(sorted)

        console.log('[useCanvases] After setCanvases:', {
            sortedLength: sorted.length,
            activeCanvasId,
            willSetActiveCanvasId: !activeCanvasId && sorted.length > 0
        })

        if (!activeCanvasId && sorted.length > 0) {
            console.log('[useCanvases] Setting activeCanvasId to:', sorted[0].id)
            setActiveCanvasId(sorted[0].id)
        }
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
        if (apiError instanceof Error) {
            setError(apiError)
        } else if (typeof apiError === 'string') {
            setError(apiError)
        } else if (apiError) {
            setError(String(apiError))
        } else {
            setError(null)
        }
    }, [getCanvasesApi.error, createCanvasApi.error, updateCanvasApi.error, deleteCanvasApi.error, reorderCanvasesApi.error])

    // Operations
    const selectCanvas = useCallback((canvasId: string) => {
        setActiveCanvasId(canvasId)
    }, [])

    const createCanvas = useCallback(
        async (name = 'New Canvas', options: CanvasCreateOptions = {}): Promise<Canvas | null> => {
            if (!spaceId || !unikId) return null
            const flowPayload = options.flowData
            const flowDataString = typeof flowPayload === 'string' ? flowPayload : JSON.stringify(flowPayload || { nodes: [], edges: [] })
            const created = (await createCanvasApi.request(unikId, spaceId, {
                name,
                flowData: flowDataString,
                deployed: false
            })) as Canvas | undefined
            if (created?.id) setActiveCanvasId(created.id)
            if (created) {
                setCanvases((prev) => {
                    const next = [...prev, { ...created }]
                    return next.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                })
            }
            return created || null
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [spaceId, unikId, canvases.length]
    )

    const renameCanvas = useCallback(
        async (canvasId: string, newName: string): Promise<boolean> => {
            if (!canvasId || !newName?.trim() || !unikId) return false
            await updateCanvasApi.request(unikId, canvasId, { name: newName.trim() })
            setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, name: newName.trim() } : c)))
            return true
        },
        [unikId, updateCanvasApi]
    )

    const deleteCanvas = useCallback(
        async (canvasId: string): Promise<boolean> => {
            if (!canvasId || canvases.length <= 1 || !unikId) return false
            await deleteCanvasApi.request(unikId, canvasId)
            if (activeCanvasId === canvasId) {
                const remain = canvases.filter((c) => c.id !== canvasId)
                if (remain.length > 0) setActiveCanvasId(remain[0].id)
            }
            await getCanvasesApi.request()
            return true
        },
        [canvases, activeCanvasId, unikId, deleteCanvasApi, getCanvasesApi]
    )

    const duplicateCanvas = useCallback(
        async (canvasId: string): Promise<Canvas | null> => {
            if (!unikId || !spaceId) return null
            const src = canvases.find((c) => c.id === canvasId)
            if (!src) return null
            const dupe = (await createCanvasApi.request(unikId, spaceId, {
                name: `${src.name} (Copy)`,
                flowData: src.flowData || undefined,
                deployed: false
            })) as Canvas | undefined
            if (dupe?.id) setActiveCanvasId(dupe.id)
            await getCanvasesApi.request()
            return dupe || null
        },
        [canvases, unikId, spaceId, createCanvasApi, getCanvasesApi]
    )

    const reorderCanvas = useCallback(
        async (canvasId: string, newIndex: number): Promise<boolean> => {
            if (!canvasId || newIndex < 0 || newIndex >= canvases.length || !unikId || !spaceId) return false
            const reordered = [...canvases]
            const currIdx = reordered.findIndex((c) => c.id === canvasId)
            if (currIdx === -1) return false
            const [moved] = reordered.splice(currIdx, 1)
            reordered.splice(newIndex, 0, moved)
            const canvasOrders = reordered.map((c, i) => ({
                id: c.id,
                order: i + 1
            }))
            await reorderCanvasesApi.request(unikId, spaceId, { canvases: canvasOrders })
            await getCanvasesApi.request()
            return true
        },
        [canvases, unikId, spaceId, reorderCanvasesApi, getCanvasesApi]
    )

    const updateCanvasData = useCallback(
        async (canvasId: string, data: Partial<Canvas>): Promise<boolean> => {
            if (!canvasId || !unikId) return false
            await updateCanvasApi.request(unikId, canvasId, data)
            setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, ...data } : c)))
            return true
        },
        [unikId, updateCanvasApi]
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
