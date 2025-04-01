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
    getAllowChatflowUploads
}
