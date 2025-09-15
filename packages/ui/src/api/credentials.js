import client from './client'

const getAllCredentials = (unikId) => client.get(`/unik/${unikId}/credentials`)

const getCredentialsByName = (unikId, componentCredentialName) => client.get(`/unik/${unikId}/credentials?credentialName=${componentCredentialName}`)

const getAllComponentsCredentials = () => client.get('/components-credentials')

const getSpecificCredential = (unikId, id) => client.get(`/unik/${unikId}/credentials/${id}`)

const getSpecificComponentCredential = (name) => client.get(`/components-credentials/${name}`)

const createCredential = (unikId, body) => client.post(`/unik/${unikId}/credentials`, body)

const updateCredential = (unikId, id, body) => client.put(`/unik/${unikId}/credentials/${id}`, body)

const deleteCredential = (unikId, id) => client.delete(`/unik/${unikId}/credentials/${id}`)

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
