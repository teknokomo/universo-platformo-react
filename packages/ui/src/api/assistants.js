import client from './client'

// OpenAI Assistant
const getAssistantObj = (id, credentialId, unikId) => client.get(`/unik/${unikId}/openai-assistants/${id}?credential=${credentialId}`)

const getAllAvailableAssistants = (credentialId, unikId) => client.get(`/unik/${unikId}/openai-assistants?credential=${credentialId}`)

// Assistant
const createNewAssistant = (unikId, body) => client.post(`/unik/${unikId}/assistants`, body)

const getAllAssistants = (type, unikId) => client.get(`/unik/${unikId}/assistants?type=${type}`)

const getSpecificAssistant = (unikId, id) => client.get(`/unik/${unikId}/assistants/${id}`)

const updateAssistant = (unikId, id, body) => client.put(`/unik/${unikId}/assistants/${id}`, body)

const deleteAssistant = (unikId, id, isDeleteBoth) =>
    isDeleteBoth ? client.delete(`/unik/${unikId}/assistants/${id}?isDeleteBoth=true`) : client.delete(`/unik/${unikId}/assistants/${id}`)

// Vector Store
const getAssistantVectorStore = (id, credentialId, unikId) => client.get(`/unik/${unikId}/openai-assistants-vector-store/${id}?credential=${credentialId}`)

const listAssistantVectorStore = (credentialId, unikId) => client.get(`/unik/${unikId}/openai-assistants-vector-store?credential=${credentialId}`)

const createAssistantVectorStore = (credentialId, unikId, body) => client.post(`/unik/${unikId}/openai-assistants-vector-store?credential=${credentialId}`, body)

const updateAssistantVectorStore = (id, credentialId, unikId, body) =>
    client.put(`/unik/${unikId}/openai-assistants-vector-store/${id}?credential=${credentialId}`, body)

const deleteAssistantVectorStore = (id, credentialId, unikId) => client.delete(`/unik/${unikId}/openai-assistants-vector-store/${id}?credential=${credentialId}`)

// Vector Store Files
const uploadFilesToAssistantVectorStore = (id, credentialId, unikId, formData) =>
    client.post(`/unik/${unikId}/openai-assistants-vector-store/${id}?credential=${credentialId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })

const deleteFilesFromAssistantVectorStore = (id, credentialId, unikId, body) =>
    client.patch(`/unik/${unikId}/openai-assistants-vector-store/${id}?credential=${credentialId}`, body)

// Files
const uploadFilesToAssistant = (credentialId, unikId, formData) =>
    client.post(`/unik/${unikId}/openai-assistants-file/upload?credential=${credentialId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })

const getChatModels = (unikId) => client.get(`/unik/${unikId}/assistants/components/chatmodels`)
const getDocStores = (unikId) => client.get(`/unik/${unikId}/assistants/components/docstores`)
const getTools = (unikId) => client.get(`/unik/${unikId}/assistants/components/tools`)

const generateAssistantInstruction = (unikId, body) => client.post(`/unik/${unikId}/assistants/generate/instruction`, body)

export default {
    getAllAssistants,
    getSpecificAssistant,
    getAssistantObj,
    getAllAvailableAssistants,
    createNewAssistant,
    updateAssistant,
    deleteAssistant,
    getAssistantVectorStore,
    listAssistantVectorStore,
    updateAssistantVectorStore,
    createAssistantVectorStore,
    uploadFilesToAssistant,
    uploadFilesToAssistantVectorStore,
    deleteFilesFromAssistantVectorStore,
    deleteAssistantVectorStore,
    getChatModels,
    getDocStores,
    getTools,
    generateAssistantInstruction
}
