import client from './client'

const getAllChatflowsMarketplaces = (unikId) => client.get(`/uniks/${unikId}/marketplaces/chatflows`)
const getAllToolsMarketplaces = (unikId) => client.get(`/uniks/${unikId}/marketplaces/tools`)
const getAllTemplatesFromMarketplaces = (unikId) => client.get(`/uniks/${unikId}/templates`)

const getAllCustomTemplates = (unikId) => client.get(`/uniks/${unikId}/templates/custom`)
const saveAsCustomTemplate = (unikId, body) => client.post(`/uniks/${unikId}/templates/custom`, body)
const deleteCustomTemplate = (unikId, id) => client.delete(`/uniks/${unikId}/templates/custom/${id}`)

export default {
    getAllChatflowsMarketplaces,
    getAllToolsMarketplaces,
    getAllTemplatesFromMarketplaces,

    getAllCustomTemplates,
    saveAsCustomTemplate,
    deleteCustomTemplate
}
