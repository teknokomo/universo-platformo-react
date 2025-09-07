// English-only comments
import client from '@/api/client'

const spacesApi = {
  getAllSpaces: (unikId) => client.get(`/uniks/${unikId}/spaces`),
  getSpace: (unikId, spaceId) => client.get(`/uniks/${unikId}/spaces/${spaceId}`),
  createSpace: (unikId, spaceData) => client.post(`/uniks/${unikId}/spaces`, spaceData),
  updateSpace: (unikId, spaceId, spaceData) => client.put(`/uniks/${unikId}/spaces/${spaceId}`, spaceData),
  deleteSpace: (unikId, spaceId) => client.delete(`/uniks/${unikId}/spaces/${spaceId}`)
}

export default spacesApi
