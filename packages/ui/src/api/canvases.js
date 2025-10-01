import client from './client'

const buildParamsConfig = (params) => {
    if (!params || Object.keys(params).length === 0) return undefined
    return { params }
}

const resolveRequestOptions = (options) => {
    if (!options) return { config: undefined, spaceId: null }
    const hasSpaceId = Object.prototype.hasOwnProperty.call(options, 'spaceId')
    const hasConfig = Object.prototype.hasOwnProperty.call(options, 'config')
    if (hasSpaceId || hasConfig) {
        return {
            spaceId: options.spaceId ?? null,
            config: options.config
        }
    }
    return { spaceId: null, config: options }
}

const normalizeIdentifier = (value) => {
    if (value === null || value === undefined) return null
    const normalized = String(value).trim()
    return normalized.length ? normalized : null
}

const ensureIdentifier = (value, field, method) => {
    const normalized = normalizeIdentifier(value)
    if (!normalized) {
        throw new Error(`canvasesApi.${method} requires a valid ${field}`)
    }
    return normalized
}

const buildCanvasPath = (unikId, canvasId, spaceId, suffix = '') => {
    const base = spaceId
        ? `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}`
        : `/unik/${unikId}/canvases/${canvasId}`
    return `${base}${suffix}`
}

const getCanvases = (unikId, spaceId, params) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvases')
    const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'getCanvases')
    return client.get(`/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases`, buildParamsConfig(params))
}

const getCanvas = (unikId, canvasId, options) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvas')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'getCanvas')
    const { spaceId, config } = resolveRequestOptions(options)
    const resolvedSpaceId = normalizeIdentifier(spaceId)
    return client.get(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId), config)
}
const getCanvasById = (canvasId, config) => client.get(`/canvases/${canvasId}`, config)
const getPublicCanvas = (canvasId, config) => client.get(`/public/canvases/${canvasId}`, config)

const createCanvas = (unikId, spaceId, body) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'createCanvas')
    const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'createCanvas')
    return client.post(`/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases`, body)
}

const updateCanvas = (unikId, canvasId, body, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'updateCanvas')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'updateCanvas')
    const resolvedSpaceId = normalizeIdentifier(options.spaceId)
    return client.put(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId), body)
}

const deleteCanvas = (unikId, canvasId, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'deleteCanvas')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'deleteCanvas')
    const resolvedSpaceId = normalizeIdentifier(options.spaceId)
    return client.delete(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId))
}

const reorderCanvases = (unikId, spaceId, body) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'reorderCanvases')
    const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'reorderCanvases')
    return client.put(`/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases/reorder`, body)
}

const duplicateCanvas = (unikId, canvasId, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'duplicateCanvas')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'duplicateCanvas')
    const resolvedSpaceId = normalizeIdentifier(options.spaceId)
    return client.post(`${buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId)}/duplicate`)
}

const exportCanvas = (unikId, canvasId, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'exportCanvas')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'exportCanvas')
    const { spaceId, config } = resolveRequestOptions(options)
    const resolvedSpaceId = normalizeIdentifier(spaceId)
    return client.get(`${buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId)}/export`, config)
}

const importCanvas = (unikId, spaceId, body) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'importCanvas')
    const resolvedSpaceId = ensureIdentifier(spaceId, 'spaceId', 'importCanvas')
    return client.post(`/unik/${resolvedUnikId}/spaces/${resolvedSpaceId}/canvases/import`, body)
}

const getCanvasStreaming = (unikId, canvasId, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvasStreaming')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'getCanvasStreaming')
    const { spaceId, config } = resolveRequestOptions(options)
    const resolvedSpaceId = normalizeIdentifier(spaceId)
    return client.get(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId, '/streaming'), config)
}

const getCanvasUploads = (unikId, canvasId, options = {}) => {
    const resolvedUnikId = ensureIdentifier(unikId, 'unikId', 'getCanvasUploads')
    const resolvedCanvasId = ensureIdentifier(canvasId, 'canvasId', 'getCanvasUploads')
    const { spaceId, config } = resolveRequestOptions(options)
    const resolvedSpaceId = normalizeIdentifier(spaceId)
    return client.get(buildCanvasPath(resolvedUnikId, resolvedCanvasId, resolvedSpaceId, '/uploads'), config)
}

const getCanvasByApiKey = (apiKey, config) => client.get(`/canvases/apikey/${apiKey}`, config)

export default {
    getCanvases,
    getCanvas,
    getCanvasById,
    getPublicCanvas,
    createCanvas,
    updateCanvas,
    deleteCanvas,
    reorderCanvases,
    duplicateCanvas,
    exportCanvas,
    importCanvas,
    getCanvasStreaming,
    getCanvasUploads,
    getCanvasByApiKey
}
