import client from './client'

const upsertVectorStore = (canvasId, input) => client.post(`/vector/internal-upsert/${canvasId}`, input)
const upsertVectorStoreWithFormData = (canvasId, formData) =>
    client.post(`/vector/internal-upsert/${canvasId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
const getUpsertHistory = (canvasId, params = {}) => client.get(`/upsert-history/${canvasId}`, { params: { order: 'DESC', ...params } })
const deleteUpsertHistory = (ids) => client.patch(`/upsert-history`, { ids })

export default {
    getUpsertHistory,
    upsertVectorStore,
    upsertVectorStoreWithFormData,
    deleteUpsertHistory
}
