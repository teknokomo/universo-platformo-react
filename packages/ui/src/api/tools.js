import client from './client'

const getAllTools = (unikId) => client.get(`/uniks/${unikId}/tools`)

const getSpecificTool = (unikId, id) => client.get(`/uniks/${unikId}/tools/${id}`)

const createNewTool = (unikId, body) => client.post(`/uniks/${unikId}/tools`, body)

const updateTool = (unikId, id, body) => client.put(`/uniks/${unikId}/tools/${id}`, body)

const deleteTool = (unikId, id) => client.delete(`/uniks/${unikId}/tools/${id}`)

export default {
    getAllTools,
    getSpecificTool,
    createNewTool,
    updateTool,
    deleteTool
}
