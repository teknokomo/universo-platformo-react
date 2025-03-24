import client from './client'

const getAllCredentials = (unikId) => client.get(`/uniks/${unikId}/credentials`)

const getCredentialsByName = (unikId, componentCredentialName) => client.get(`/uniks/${unikId}/credentials?credentialName=${componentCredentialName}`)

const getAllComponentsCredentials = () => client.get('/components-credentials')

const getSpecificCredential = (unikId, id) => client.get(`/uniks/${unikId}/credentials/${id}`)

const getSpecificComponentCredential = (name) => client.get(`/components-credentials/${name}`)

const createCredential = (unikId, body) => client.post(`/uniks/${unikId}/credentials`, body)

const updateCredential = (unikId, id, body) => client.put(`/uniks/${unikId}/credentials/${id}`, body)

const deleteCredential = (unikId, id) => client.delete(`/uniks/${unikId}/credentials/${id}`)

export default {
    getAllCredentials,
    getCredentialsByName,
    getAllComponentsCredentials,
    getSpecificCredential,
    getSpecificComponentCredential,
    createCredential,
    updateCredential,
    deleteCredential
}
