import client from './client'

const getAllTools = (unikId) => client.get(`/unik/${unikId}/tools`)

const getSpecificTool = (unikId, id) => client.get(`/unik/${unikId}/tools/${id}`)

const createNewTool = (unikId, body) => client.post(`/unik/${unikId}/tools`, body)

const updateTool = (unikId, id, body) => client.put(`/unik/${unikId}/tools/${id}`, body)

const deleteTool = (unikId, id) => client.delete(`/unik/${unikId}/tools/${id}`)

export default {
    getAllTools,
    getSpecificTool,
    createNewTool,
    updateTool,
    deleteTool
}
