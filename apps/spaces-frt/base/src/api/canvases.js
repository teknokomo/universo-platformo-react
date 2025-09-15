// English-only comments
import client from '@/api/client'

const getCanvases = (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}/canvases`)
const getCanvas = (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}`)
const createCanvas = (unikId, spaceId, body) => client.post(`/unik/${unikId}/spaces/${spaceId}/canvases`, body)
const updateCanvas = (unikId, canvasId, body) => client.put(`/unik/${unikId}/canvases/${canvasId}`, body)
const deleteCanvas = (unikId, canvasId) => client.delete(`/unik/${unikId}/canvases/${canvasId}`)
const reorderCanvases = (unikId, spaceId, body) => client.put(`/unik/${unikId}/spaces/${spaceId}/canvases/reorder`, body)
const duplicateCanvas = (unikId, canvasId) => client.post(`/unik/${unikId}/canvases/${canvasId}/duplicate`)
const exportCanvas = (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}/export`)
const importCanvas = (unikId, spaceId, body) => client.post(`/unik/${unikId}/spaces/${spaceId}/import`, body)

export default {
  getCanvases,
  getCanvas,
  createCanvas,
  updateCanvas,
  deleteCanvas,
  reorderCanvases,
  duplicateCanvas,
  exportCanvas,
  importCanvas
}
