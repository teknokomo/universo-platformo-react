import client from './client'

const getAllChatflows = (unikId) => client.get(`/uniks/${unikId}/chatflows?type=CHATFLOW`)

const getAllAgentflows = (unikId) => client.get(`/uniks/${unikId}/chatflows?type=MULTIAGENT`)

const getSpecificChatflow = (unikId, id) => client.get(`/uniks/${unikId}/chatflows/${id}`)

const getSpecificChatflowFromPublicEndpoint = (id) => client.get(`/public-chatflows/${id}`)

const createNewChatflow = (unikId, body) => client.post(`/uniks/${unikId}/chatflows`, body)

const importChatflows = (unikId, body) => client.post(`/uniks/${unikId}/chatflows/importchatflows`, body)

const updateChatflow = (unikId, id, body) => client.put(`/uniks/${unikId}/chatflows/${id}`, body)

const deleteChatflow = (unikId, id) => client.delete(`/uniks/${unikId}/chatflows/${id}`)

const getIsChatflowStreaming = (unikId, id) => client.get(`/uniks/${unikId}/chatflows-streaming/${id}`)

const getAllowChatflowUploads = (unikId, id) => client.get(`/uniks/${unikId}/chatflows-uploads/${id}`)

const getChatflowById = (unikId, id) => client.get(`/uniks/${unikId}/chatflows/${id}`)

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
