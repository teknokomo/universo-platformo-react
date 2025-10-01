// English-only comments in code files.
// Legacy chatflows API wrapper kept for backwards compatibility. New code should prefer canvasesApi.
import client from './client'
import canvasesApi from './canvases'

const issuedWarnings = new Set()

const warnDeprecated = (method, message) => {
    if (issuedWarnings.has(method)) return
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[chatflowsApi.${method}] ${message}`)
    }
    issuedWarnings.add(method)
}

const warnMissingSpaceId = (method) =>
    warnDeprecated(
        method,
        'Legacy fallback triggered because spaceId is missing. Migrate callers to canvasesApi with explicit { unikId, spaceId }.'
    )

const missingUnikIdError = (method) =>
    new Error(
        `chatflowsApi.${method} requires a unikId. Please migrate callers to canvasesApi with explicit { unikId, spaceId }.`
    )

const buildLegacyParams = (defaults, params) => ({ ...defaults, ...(params || {}) })

const resolveSpaceId = (spaceId, body) => spaceId ?? body?.spaceId ?? body?.space_id ?? body?.spaceID

const resolveCanvasRequestOptions = (options) => {
    if (!options) {
        return {}
    }

    if (typeof options !== 'object') {
        return {}
    }

    const hasExplicitSpaceId = Object.prototype.hasOwnProperty.call(options, 'spaceId')
    const hasExplicitConfig = Object.prototype.hasOwnProperty.call(options, 'config')

    if (hasExplicitSpaceId || hasExplicitConfig) {
        return {
            spaceId: options.spaceId ?? null,
            config: options.config
        }
    }

    return {
        config: options
    }
}

const getAllChatflows = (unikId, spaceId, params) => {
    if (spaceId) {
        warnDeprecated('getAllChatflows', 'Delegating to canvasesApi.getCanvases; please import canvasesApi directly.')
        return canvasesApi.getCanvases(unikId, spaceId, { type: 'CHATFLOW', ...(params || {}) })
    }
    warnMissingSpaceId('getAllChatflows')
    return client.get(`/unik/${unikId}/chatflows`, { params: buildLegacyParams({ type: 'CHATFLOW' }, params) })
}

const getAllAgentflows = (unikId, spaceId, params) => {
    if (spaceId) {
        warnDeprecated('getAllAgentflows', 'Delegating to canvasesApi.getCanvases; please import canvasesApi directly.')
        return canvasesApi.getCanvases(unikId, spaceId, { type: 'MULTIAGENT', ...(params || {}) })
    }
    warnMissingSpaceId('getAllAgentflows')
    return client.get(`/unik/${unikId}/chatflows`, { params: buildLegacyParams({ type: 'MULTIAGENT' }, params) })
}

const getSpecificChatflow = (unikId, id, config) => {
    warnDeprecated('getSpecificChatflow', 'Delegating to canvasesApi.getCanvas; please import canvasesApi directly.')
    return canvasesApi.getCanvas(unikId, id, config)
}

const getSpecificChatflowFromPublicEndpoint = (id) => client.get(`/public/canvases/${id}`)

const createNewChatflow = (unikId, body, spaceIdParam) => {
    const spaceId = resolveSpaceId(spaceIdParam, body)
    if (spaceId) {
        warnDeprecated('createNewChatflow', 'Delegating to canvasesApi.createCanvas; please import canvasesApi directly.')
        return canvasesApi.createCanvas(unikId, spaceId, body)
    }
    warnMissingSpaceId('createNewChatflow')
    return client.post(`/unik/${unikId}/chatflows`, body)
}

const importChatflows = (unikId, body, spaceIdParam) => {
    const spaceId = resolveSpaceId(spaceIdParam, body)
    if (spaceId) {
        warnDeprecated('importChatflows', 'Delegating to canvasesApi.importCanvas; please import canvasesApi directly.')
        return canvasesApi.importCanvas(unikId, spaceId, body)
    }
    warnMissingSpaceId('importChatflows')
    return client.post(`/unik/${unikId}/chatflows/importchatflows`, body)
}

const updateChatflow = (unikId, id, body) => {
    warnDeprecated('updateChatflow', 'Delegating to canvasesApi.updateCanvas; please import canvasesApi directly.')
    return canvasesApi.updateCanvas(unikId, id, body)
}

const deleteChatflow = (unikId, id) => {
    warnDeprecated('deleteChatflow', 'Delegating to canvasesApi.deleteCanvas; please import canvasesApi directly.')
    return canvasesApi.deleteCanvas(unikId, id)
}

const getIsChatflowStreaming = (unikId, id, options) => {
    const requestOptions = resolveCanvasRequestOptions(options)

    if (!unikId) {
        warnMissingSpaceId('getIsChatflowStreaming')
        return Promise.reject(missingUnikIdError('getIsChatflowStreaming'))
    }

    warnDeprecated('getIsChatflowStreaming', 'Delegating to canvasesApi.getCanvasStreaming; please import canvasesApi directly.')
    return canvasesApi.getCanvasStreaming(unikId, id, requestOptions)
}

const getAllowChatflowUploads = (unikId, id, options) => {
    const requestOptions = resolveCanvasRequestOptions(options)

    if (!unikId) {
        warnMissingSpaceId('getAllowChatflowUploads')
        return Promise.reject(missingUnikIdError('getAllowChatflowUploads'))
    }

    warnDeprecated('getAllowChatflowUploads', 'Delegating to canvasesApi.getCanvasUploads; please import canvasesApi directly.')
    return canvasesApi.getCanvasUploads(unikId, id, requestOptions)
}

const getChatflowById = (unikId, id, config) => {
    warnDeprecated('getChatflowById', 'Delegating to canvasesApi.getCanvas; please import canvasesApi directly.')
    return canvasesApi.getCanvas(unikId, id, config)
}

const getBotConfig = (id, type = '') => client.get(`/api/v1/bots/${id}/config${type ? `?type=${type}` : ''}`)

const getChatBotConfig = (id) => getBotConfig(id, 'chat')


const renderBot = (id, type = '') => client.get(`/api/v1/bots/${id}/render${type ? `?type=${type}` : ''}`)

const renderChatBot = (id) => renderBot(id, 'chat')


const updateBotUsage = (id) => client.post(`/api/v1/bots/${id}/update-usage`)

const streamBot = (id, sessionId = '') => {
    const url = sessionId ? `/api/v1/bots/${id}/stream/${sessionId}` : `/api/v1/bots/${id}/stream`
    return client.get(url)
}

export default {
    getAllChatflows,
    getAllAgentflows,
    getSpecificChatflow,
    getSpecificChatflowFromPublicEndpoint,
    createNewChatflow,
    importChatflows,
    updateChatflow,
    deleteChatflow,
    getIsChatflowStreaming,
    getAllowChatflowUploads,
    getChatflowById,
    getBotConfig,
    renderBot,
    updateBotUsage,
    streamBot,
    getChatBotConfig,
    renderChatBot
}
