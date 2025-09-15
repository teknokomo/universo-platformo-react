// English-only comments
import client from '@/api/client'

const spacesApi = {
  getAllSpaces: (unikId) => client.get(`/unik/${unikId}/spaces`),
  getSpace: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}`),
  createSpace: (unikId, spaceData) => client.post(`/unik/${unikId}/spaces`, spaceData),
  updateSpace: (unikId, spaceId, spaceData) => client.put(`/unik/${unikId}/spaces/${spaceId}`, spaceData),
  deleteSpace: (unikId, spaceId) => client.delete(`/unik/${unikId}/spaces/${spaceId}`)
}

export default spacesApi
