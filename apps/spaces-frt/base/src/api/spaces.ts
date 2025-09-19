import type { AxiosInstance, AxiosPromise } from 'axios'
import rawClient from '@/api/client'

type EntityId = string | number

type SpacePayload = Record<string, unknown>
type CanvasPayload = Record<string, unknown>
type ReorderPayload = Record<string, unknown>

interface SpacesApi {
  // Spaces
  getAllSpaces: (unikId: EntityId) => AxiosPromise
  getSpaces: (unikId: EntityId) => AxiosPromise
  getSpace: (unikId: EntityId, spaceId: EntityId) => AxiosPromise
  createSpace: (unikId: EntityId, spaceData: SpacePayload) => AxiosPromise
  updateSpace: (unikId: EntityId, spaceId: EntityId, spaceData: SpacePayload) => AxiosPromise
  deleteSpace: (unikId: EntityId, spaceId: EntityId) => AxiosPromise
  // Canvases
  getCanvases: (unikId: EntityId, spaceId: EntityId) => AxiosPromise
  getCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  createCanvas: (unikId: EntityId, spaceId: EntityId, canvasData: CanvasPayload) => AxiosPromise
  updateCanvas: (unikId: EntityId, canvasId: EntityId, canvasData: CanvasPayload) => AxiosPromise
  deleteCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  reorderCanvases: (unikId: EntityId, spaceId: EntityId, reorderData: ReorderPayload) => AxiosPromise
}

const client = rawClient as AxiosInstance

const spacesApi: SpacesApi = {
  getAllSpaces: (unikId) => client.get(`/unik/${unikId}/spaces`),
  getSpaces: (unikId) => client.get(`/unik/${unikId}/spaces`),
  getSpace: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}`),
  createSpace: (unikId, spaceData) => client.post(`/unik/${unikId}/spaces`, spaceData),
  updateSpace: (unikId, spaceId, spaceData) => client.put(`/unik/${unikId}/spaces/${spaceId}`, spaceData),
  deleteSpace: (unikId, spaceId) => client.delete(`/unik/${unikId}/spaces/${spaceId}`),
  getCanvases: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}/canvases`),
  getCanvas: (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}`),
  createCanvas: (unikId, spaceId, canvasData) => client.post(`/unik/${unikId}/spaces/${spaceId}/canvases`, canvasData),
  updateCanvas: (unikId, canvasId, canvasData) => client.put(`/unik/${unikId}/canvases/${canvasId}`, canvasData),
  deleteCanvas: (unikId, canvasId) => client.delete(`/unik/${unikId}/canvases/${canvasId}`),
  reorderCanvases: (unikId, spaceId, reorderData) =>
    client.put(`/unik/${unikId}/spaces/${spaceId}/canvases/reorder`, reorderData),
}

export default spacesApi
export type { SpacesApi }
