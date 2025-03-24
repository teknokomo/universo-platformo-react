import client from './client'

const getAllVariables = (unikId) => client.get(`/uniks/${unikId}/variables`)

const createVariable = (unikId, body) => client.post(`/uniks/${unikId}/variables`, body)

const updateVariable = (unikId, id, body) => client.put(`/uniks/${unikId}/variables/${id}`, body)

const deleteVariable = (unikId, id) => client.delete(`/uniks/${unikId}/variables/${id}`)

export default {
    getAllVariables,
    createVariable,
    updateVariable,
    deleteVariable
}
