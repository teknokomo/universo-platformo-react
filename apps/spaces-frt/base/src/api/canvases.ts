import type { AxiosPromise } from 'axios'

import client from '@/api/client'

type EntityId = string | number

type CanvasPayload = Record<string, unknown>

type ReorderPayload = Record<string, unknown>

type ImportPayload = Record<string, unknown>

type CanvasRequestOptions = {
  spaceId?: EntityId
}

type CanvasApi = {
  getCanvases: (unikId: EntityId, spaceId: EntityId) => AxiosPromise
  getCanvas: (unikId: EntityId, canvasId: EntityId, options?: CanvasRequestOptions) => AxiosPromise
  createCanvas: (unikId: EntityId, spaceId: EntityId, body: CanvasPayload) => AxiosPromise
  updateCanvas: (
    unikId: EntityId,
    canvasId: EntityId,
    body: CanvasPayload,
    options?: CanvasRequestOptions
  ) => AxiosPromise
  deleteCanvas: (unikId: EntityId, canvasId: EntityId, options?: CanvasRequestOptions) => AxiosPromise
  reorderCanvases: (unikId: EntityId, spaceId: EntityId, body: ReorderPayload) => AxiosPromise
  duplicateCanvas: (unikId: EntityId, canvasId: EntityId, options?: CanvasRequestOptions) => AxiosPromise
  exportCanvas: (unikId: EntityId, canvasId: EntityId, options?: CanvasRequestOptions) => AxiosPromise
  importCanvas: (unikId: EntityId, spaceId: EntityId, body: ImportPayload) => AxiosPromise
}

const buildCanvasPath = (
  unikId: EntityId,
  canvasId: EntityId,
  spaceId?: EntityId,
  suffix = ''
) => {
  const spaceSegment = spaceId ? `/spaces/${spaceId}` : ''
  return `/unik/${unikId}${spaceSegment}/canvases/${canvasId}${suffix}`
}

const canvasesApi: CanvasApi = {
  getCanvases: (unikId, spaceId) => client.get(`/unik/${unikId}/spaces/${spaceId}/canvases`),
  getCanvas: (unikId, canvasId, options) =>
    client.get(buildCanvasPath(unikId, canvasId, options?.spaceId)),
  createCanvas: (unikId, spaceId, body) => client.post(`/unik/${unikId}/spaces/${spaceId}/canvases`, body),
  updateCanvas: (unikId, canvasId, body, options) =>
    client.put(buildCanvasPath(unikId, canvasId, options?.spaceId), body),
  deleteCanvas: (unikId, canvasId, options) =>
    client.delete(buildCanvasPath(unikId, canvasId, options?.spaceId)),
  reorderCanvases: (unikId, spaceId, body) => client.put(`/unik/${unikId}/spaces/${spaceId}/canvases/reorder`, body),
  duplicateCanvas: (unikId, canvasId, options) =>
    client.post(`${buildCanvasPath(unikId, canvasId, options?.spaceId)}/duplicate`),
  exportCanvas: (unikId, canvasId, options) =>
    client.get(`${buildCanvasPath(unikId, canvasId, options?.spaceId)}/export`),
  importCanvas: (unikId, spaceId, body) =>
    client.post(`/unik/${unikId}/spaces/${spaceId}/canvases/import`, body),
}

export default canvasesApi
export type { CanvasApi, CanvasRequestOptions }
