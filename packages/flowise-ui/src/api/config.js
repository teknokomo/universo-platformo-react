import client from './client'

const getConfig = (unikId, id) => client.get(`/unik/${unikId}/flow-config/${id}`)
const getNodeConfig = (body) => client.post(`/node-config`, body)

export default {
    getConfig,
    getNodeConfig
}
