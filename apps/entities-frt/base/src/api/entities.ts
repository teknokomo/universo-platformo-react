import client from 'flowise-ui/src/api/client'
import { Entity, Template, Status, Owner, Resource } from '../types'

export const listEntities = (): Promise<{ data: Entity[] }> => client.get('/entities')
export const getEntity = (entityId: string): Promise<{ data: Entity }> => client.get(`/entities/${entityId}`)
export const createEntity = (body: Partial<Entity>): Promise<{ data: Entity }> => client.post('/entities', body)

export const listTemplates = (): Promise<{ data: Template[] }> => client.get('/entities/templates')
export const createTemplate = (body: Partial<Template>): Promise<{ data: Template }> => client.post('/entities/templates', body)
export const listStatuses = (): Promise<{ data: Status[] }> => client.get('/entities/statuses')

export const listEntityOwners = (entityId: string): Promise<{ data: Owner[] }> => client.get(`/entities/${entityId}/owners`)
export const listEntityResources = (entityId: string): Promise<{ data: Resource[] }> =>
  client.get(`/entities/${entityId}/resources`).then((response: { data: Array<{ resource: Resource }> }) => ({
    data: response.data.map((link) => link.resource)
  }))
