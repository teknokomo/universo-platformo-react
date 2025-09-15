import client from './client'

const getAllDocumentStores = (unikId) => client.get(`/unik/${unikId}/document-stores/store`)
const getDocumentLoaders = (unikId) => client.get(`/unik/${unikId}/document-stores/components/loaders`)
const getSpecificDocumentStore = (unikId, id) => client.get(`/unik/${unikId}/document-stores/store/${id}`)
const createDocumentStore = (unikId, body) => client.post(`/unik/${unikId}/document-stores/store`, body)
const updateDocumentStore = (unikId, id, body) => client.put(`/unik/${unikId}/document-stores/store/${id}`, body)
const deleteDocumentStore = (unikId, id) => client.delete(`/unik/${unikId}/document-stores/store/${id}`)
const getDocumentStoreConfig = (unikId, storeId, loaderId) => client.get(`/unik/${unikId}/document-stores/store-configs/${storeId}/${loaderId}`)

const deleteLoaderFromStore = (unikId, id, fileId) => client.delete(`/unik/${unikId}/document-stores/loader/${id}/${fileId}`)
const deleteChunkFromStore = (unikId, storeId, loaderId, chunkId) => client.delete(`/unik/${unikId}/document-stores/chunks/${storeId}/${loaderId}/${chunkId}`)
const editChunkFromStore = (unikId, storeId, loaderId, chunkId, body) =>
    client.put(`/unik/${unikId}/document-stores/chunks/${storeId}/${loaderId}/${chunkId}`, body)

const getFileChunks = (unikId, storeId, fileId, pageNo) => client.get(`/unik/${unikId}/document-stores/chunks/${storeId}/${fileId}/${pageNo}`)
const previewChunks = (unikId, body) => client.post(`/unik/${unikId}/document-stores/loader/preview`, body)
const processLoader = (unikId, body, loaderId) => client.post(`/unik/${unikId}/document-stores/loader/process/${loaderId}`, body)
const saveProcessingLoader = (unikId, body) => client.post(`/unik/${unikId}/document-stores/loader/save`, body)
const refreshLoader = (unikId, storeId) => client.post(`/unik/${unikId}/document-stores/refresh/${storeId}`)

const insertIntoVectorStore = (unikId, body) => client.post(`/unik/${unikId}/document-stores/vectorstore/insert`, body)
const saveVectorStoreConfig = (unikId, body) => client.post(`/unik/${unikId}/document-stores/vectorstore/save`, body)
const updateVectorStoreConfig = (unikId, body) => client.post(`/unik/${unikId}/document-stores/vectorstore/update`, body)
const deleteVectorStoreDataFromStore = (unikId, storeId) => client.delete(`/unik/${unikId}/document-stores/vectorstore/${storeId}`)
const queryVectorStore = (unikId, body) => client.post(`/unik/${unikId}/document-stores/vectorstore/query`, body)
const getVectorStoreProviders = (unikId) => client.get(`/unik/${unikId}/document-stores/components/vectorstore`)
const getEmbeddingProviders = (unikId) => client.get(`/unik/${unikId}/document-stores/components/embeddings`)
const getRecordManagerProviders = (unikId) => client.get(`/unik/${unikId}/document-stores/components/recordmanager`)

const generateDocStoreToolDesc = (unikId, storeId, body) => client.post(`/unik/${unikId}/document-stores/generate-tool-desc/${storeId}`, body)

export default {
    getAllDocumentStores,
    getSpecificDocumentStore,
    createDocumentStore,
    deleteLoaderFromStore,
    getFileChunks,
    updateDocumentStore,
    previewChunks,
    processLoader,
    getDocumentLoaders,
    deleteChunkFromStore,
    editChunkFromStore,
    deleteDocumentStore,
    insertIntoVectorStore,
    getVectorStoreProviders,
    getEmbeddingProviders,
    getRecordManagerProviders,
    saveVectorStoreConfig,
    queryVectorStore,
    deleteVectorStoreDataFromStore,
    updateVectorStoreConfig,
    saveProcessingLoader,
    refreshLoader,
    generateDocStoreToolDesc,
    getDocumentStoreConfig
}
