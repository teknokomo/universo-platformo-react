import type { AxiosPromise } from 'axios'

import client from '@/api/client'

type EntityId = string | number

type CanvasPayload = Record<string, unknown>

type ReorderPayload = Record<string, unknown>

type ImportPayload = Record<string, unknown>

type CanvasApi = {
  getCanvases: (unikId: EntityId, spaceId: EntityId) => AxiosPromise
  getCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  createCanvas: (unikId: EntityId, spaceId: EntityId, body: CanvasPayload) => AxiosPromise
  updateCanvas: (unikId: EntityId, canvasId: EntityId, body: CanvasPayload) => AxiosPromise
  deleteCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  reorderCanvases: (unikId: EntityId, spaceId: EntityId, body: ReorderPayload) => AxiosPromise
  duplicateCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  exportCanvas: (unikId: EntityId, canvasId: EntityId) => AxiosPromise
  importCanvas: (unikId: EntityId, spaceId: EntityId, body: ImportPayload) => AxiosPromise
}

const canvasesApi: CanvasApi = {
  getCanvases: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}/canvases`),
  getCanvas: (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}`),
  createCanvas: (unikId, spaceId, body) => client.post(`/unik/${unikId}/spaces/${spaceId}/canvases`, body),
  updateCanvas: (unikId, canvasId, body) => client.put(`/unik/${unikId}/canvases/${canvasId}`, body),
  deleteCanvas: (unikId, canvasId) => client.delete(`/unik/${unikId}/canvases/${canvasId}`),
  reorderCanvases: (unikId, spaceId, body) => client.put(`/unik/${unikId}/spaces/${spaceId}/canvases/reorder`, body),
  duplicateCanvas: (unikId, canvasId) => client.post(`/unik/${unikId}/canvases/${canvasId}/duplicate`),
  exportCanvas: (unikId, canvasId) => client.get(`/unik/${unikId}/canvases/${canvasId}/export`),
  importCanvas: (unikId, spaceId, body) => client.post(`/unik/${unikId}/spaces/${spaceId}/import`, body),
}

export default canvasesApi
export type { CanvasApi }
