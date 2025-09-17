import client from '@/api/client'

const spacesApi = {
  // Spaces
  getAllSpaces: (unikId) => client.get(`/unik/${unikId}/spaces`),
  getSpaces: (unikId) => client.get(`/unik/${unikId}/spaces`), // Alias for analytics compatibility
  getSpace: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}`),
  createSpace: (unikId, spaceData) => client.post(`/unik/${unikId}/spaces`, spaceData),
  updateSpace: (unikId, spaceId, spaceData) => client.put(`/unik/${unikId}/spaces/${spaceId}`, spaceData),
  deleteSpace: (unikId, spaceId) => client.delete(`/unik/${unikId}/spaces/${spaceId}`),
  
  // Canvases
  getCanvases: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}/canvases`),
  getCanvas: (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}`),
  createCanvas: (unikId, spaceId, canvasData) => client.post(`/unik/${unikId}/spaces/${spaceId}/canvases`, canvasData),
  updateCanvas: (unikId, canvasId, canvasData) => client.put(`/unik/${unikId}/canvases/${canvasId}`, canvasData),
  deleteCanvas: (unikId, canvasId) => client.delete(`/unik/${unikId}/canvases/${canvasId}`),
  reorderCanvases: (unikId, spaceId, reorderData) => client.put(`/unik/${unikId}/spaces/${spaceId}/canvases/reorder`, reorderData)
}

export default spacesApi
