import client from './client'

const exportData = (unikId, body) => client.post(`/uniks/${unikId}/export-import/export`, body)
const importData = (unikId, body) => client.post(`/uniks/${unikId}/export-import/import`, body)

export default {
    exportData,
    importData
}
