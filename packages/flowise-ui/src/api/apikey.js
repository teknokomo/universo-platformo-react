import client from './client'

const getAllAPIKeys = (unikId) => client.get(`/unik/${unikId}/apikey`)

const createNewAPI = (unikId, body) => client.post(`/unik/${unikId}/apikey`, body)

const updateAPI = (unikId, id, body) => client.put(`/unik/${unikId}/apikey/${id}`, body)

const deleteAPI = (unikId, id) => client.delete(`/unik/${unikId}/apikey/${id}`)

const importAPI = (unikId, body) => client.post(`/unik/${unikId}/apikey/import`, body)

export default {
    getAllAPIKeys,
    createNewAPI,
    updateAPI,
    deleteAPI,
    importAPI
}
