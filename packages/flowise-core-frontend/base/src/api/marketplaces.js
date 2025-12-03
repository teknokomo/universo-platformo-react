import client from './client'

const getAllToolsMarketplaces = (unikId) => client.get(`/unik/${unikId}/marketplaces/tools`)
const getAllTemplatesFromMarketplaces = (unikId) => client.get(`/unik/${unikId}/templates`)

const getAllCustomTemplates = (unikId) => client.get(`/unik/${unikId}/templates/custom`)
const saveAsCustomTemplate = (unikId, body) => client.post(`/unik/${unikId}/templates/custom`, body)
const deleteCustomTemplate = (unikId, id) => client.delete(`/unik/${unikId}/templates/custom/${id}`)

export default {
    getAllToolsMarketplaces,
    getAllTemplatesFromMarketplaces,
    getAllCustomTemplates,
    saveAsCustomTemplate,
    deleteCustomTemplate
}
