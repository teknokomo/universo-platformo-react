// English-only comments in code files.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import canvasesApi from '../api/canvases'
import useApi from './useApi'

// Hook to manage canvases list/state within a Space
const useCanvases = (spaceId) => {
  const { unikId } = useParams()
  const [canvases, setCanvases] = useState([])
  const [activeCanvasId, setActiveCanvasId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // API hooks
  const getCanvasesApi = useApi(() => canvasesApi.getCanvases(unikId, spaceId))
  const createCanvasApi = useApi(canvasesApi.createCanvas)
  const updateCanvasApi = useApi((unik, canvasId, body, options = {}) =>
    canvasesApi.updateCanvas(unik, canvasId, body, { ...options, spaceId })
  )
  const deleteCanvasApi = useApi((unik, canvasId, options = {}) =>
    canvasesApi.deleteCanvas(unik, canvasId, { ...options, spaceId })
  )
  const reorderCanvasesApi = useApi(canvasesApi.reorderCanvases)

  // Load canvases when spaceId changes
  useEffect(() => {
    if (spaceId && unikId) getCanvasesApi.request()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, unikId])

  // Update local state when API data changes
  useEffect(() => {
    if (!getCanvasesApi.data) return
    const raw = getCanvasesApi.data
    let list = []
    if (Array.isArray(raw)) list = raw
    else if (Array.isArray(raw?.data?.canvases)) list = raw.data.canvases
    else if (Array.isArray(raw?.canvases)) list = raw.canvases

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
  }, [
    getCanvasesApi.loading,
    createCanvasApi.loading,
    updateCanvasApi.loading,
    deleteCanvasApi.loading,
    reorderCanvasesApi.loading
  ])

  // Update error state
  useEffect(() => {
    const apiError =
      getCanvasesApi.error ||
      createCanvasApi.error ||
      updateCanvasApi.error ||
      deleteCanvasApi.error ||
      reorderCanvasesApi.error
    setError(apiError)
  }, [
    getCanvasesApi.error,
    createCanvasApi.error,
    updateCanvasApi.error,
    deleteCanvasApi.error,
    reorderCanvasesApi.error
  ])

  // Operations
  const selectCanvas = useCallback((canvasId) => {
    setActiveCanvasId(canvasId)
  }, [])

  const createCanvas = useCallback(async (name = 'New Canvas', options = {}) => {
    if (!spaceId || !unikId) return null
    try {
      const flowPayload = options.flowData
      const flowDataString =
        typeof flowPayload === 'string'
          ? flowPayload
          : JSON.stringify(flowPayload || { nodes: [], edges: [] })
      const created = await createCanvasApi.request(unikId, spaceId, {
        name,
        flowData: flowDataString,
        sortOrder: options.sortOrder ?? canvases.length + 1
      })
      if (created?.id) setActiveCanvasId(created.id)
      if (created) {
        setCanvases((prev) => {
          const next = [...prev, { ...created }]
          return next.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        })
      }
      return created
    } catch (err) {
      throw err
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, unikId, canvases.length])

  const renameCanvas = useCallback(async (canvasId, newName) => {
    if (!canvasId || !newName?.trim()) return false
    await updateCanvasApi.request(unikId, canvasId, { name: newName.trim() }, { spaceId })
    setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, name: newName.trim() } : c)))
    return true
  }, [unikId, spaceId, updateCanvasApi])

  const deleteCanvas = useCallback(async (canvasId) => {
    if (!canvasId || canvases.length <= 1) return false
    await deleteCanvasApi.request(unikId, canvasId, { spaceId })
    if (activeCanvasId === canvasId) {
      const remain = canvases.filter((c) => c.id !== canvasId)
      if (remain.length > 0) setActiveCanvasId(remain[0].id)
    }
    await getCanvasesApi.request()
    return true
  }, [canvases, activeCanvasId, unikId, spaceId, deleteCanvasApi, getCanvasesApi])

  const duplicateCanvas = useCallback(async (canvasId) => {
    const src = canvases.find((c) => c.id === canvasId)
    if (!src) return null
    const dupe = await createCanvasApi.request(unikId, spaceId, {
      name: `${src.name} (Copy)`,
      flowData: src.flowData,
      sortOrder: canvases.length + 1
    })
    if (dupe?.id) setActiveCanvasId(dupe.id)
    await getCanvasesApi.request()
    return dupe
  }, [canvases, unikId, spaceId, createCanvasApi, getCanvasesApi])

  const reorderCanvas = useCallback(async (canvasId, newIndex) => {
    if (!canvasId || newIndex < 0 || newIndex >= canvases.length) return false
    const reordered = [...canvases]
    const currIdx = reordered.findIndex((c) => c.id === canvasId)
    if (currIdx === -1) return false
    const [moved] = reordered.splice(currIdx, 1)
    reordered.splice(newIndex, 0, moved)
    const canvasOrders = reordered.map((c, i) => ({ canvasId: c.id, sortOrder: i + 1 }))
    await reorderCanvasesApi.request(unikId, spaceId, { canvasOrders })
    await getCanvasesApi.request()
    return true
  }, [canvases, unikId, spaceId, reorderCanvasesApi, getCanvasesApi])

  const updateCanvasData = useCallback(async (canvasId, data) => {
    if (!canvasId) return false
    await updateCanvasApi.request(unikId, canvasId, data, { spaceId })
    setCanvases((prev) => prev.map((c) => (c.id === canvasId ? { ...c, ...data } : c)))
    return true
  }, [unikId, spaceId, updateCanvasApi])

  const getActiveCanvas = useCallback(() => canvases.find((c) => c.id === activeCanvasId) || null, [canvases, activeCanvasId])

  const markCanvasDirty = useCallback((canvasId, isDirty = true) => {
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
