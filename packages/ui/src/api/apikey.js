import client from './client'

const getAllAPIKeys = (unikId) => client.get(`/uniks/${unikId}/apikey`)

const createNewAPI = (unikId, body) => client.post(`/uniks/${unikId}/apikey`, body)

const updateAPI = (unikId, id, body) => client.put(`/uniks/${unikId}/apikey/${id}`, body)

const deleteAPI = (unikId, id) => client.delete(`/uniks/${unikId}/apikey/${id}`)

const importAPI = (unikId, body) => client.post(`/uniks/${unikId}/apikey/import`, body)

export default {
    getAllAPIKeys,
    createNewAPI,
    updateAPI,
    deleteAPI,
    importAPI
}
