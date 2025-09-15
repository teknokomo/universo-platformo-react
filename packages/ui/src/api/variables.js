import client from './client'

const getAllVariables = (unikId) => client.get(`/unik/${unikId}/variables`)

const createVariable = (unikId, body) => client.post(`/unik/${unikId}/variables`, body)

const updateVariable = (unikId, id, body) => client.put(`/unik/${unikId}/variables/${id}`, body)

const deleteVariable = (unikId, id) => client.delete(`/unik/${unikId}/variables/${id}`)

export default {
    getAllVariables,
    createVariable,
    updateVariable,
    deleteVariable
}
