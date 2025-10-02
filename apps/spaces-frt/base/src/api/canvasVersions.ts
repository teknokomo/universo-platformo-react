import type { AxiosPromise } from 'axios'

import client from '@/api/client'

type EntityId = string | number

type CreatePayload = {
  label?: string
  description?: string
  activate?: boolean
}

type UpdatePayload = {
  label: string
  description?: string
}

type CanvasVersionsApi = {
  list: (unikId: EntityId, spaceId: EntityId, canvasId: EntityId) => AxiosPromise
  create: (unikId: EntityId, spaceId: EntityId, canvasId: EntityId, body: CreatePayload) => AxiosPromise
  update: (
    unikId: EntityId,
    spaceId: EntityId,
    canvasId: EntityId,
    versionId: EntityId,
    body: UpdatePayload
  ) => AxiosPromise
  activate: (
    unikId: EntityId,
    spaceId: EntityId,
    canvasId: EntityId,
    versionId: EntityId
  ) => AxiosPromise
  remove: (unikId: EntityId, spaceId: EntityId, canvasId: EntityId, versionId: EntityId) => AxiosPromise
}

const canvasVersionsApi: CanvasVersionsApi = {
  list: (unikId, spaceId, canvasId) =>
    client.get(`/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`),
  create: (unikId, spaceId, canvasId, body) =>
    client.post(`/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions`, body),
  update: (unikId, spaceId, canvasId, versionId, body) =>
    client.put(
      `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}`,
      body
    ),
  activate: (unikId, spaceId, canvasId, versionId) =>
    client.post(
      `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}/activate`
    ),
  remove: (unikId, spaceId, canvasId, versionId) =>
    client.delete(`/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/versions/${versionId}`)
}

export default canvasVersionsApi
export type { CanvasVersionsApi }
