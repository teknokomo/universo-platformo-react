import client from 'flowise-ui/src/api/client'
import { Entity, Template, Status } from '../types'

export const listEntities = (): Promise<{ data: Entity[] }> => client.get('/entities')
export const getEntity = (id: string): Promise<{ data: Entity }> => client.get(`/entities/${id}`)
export const createEntity = (body: Partial<Entity>): Promise<{ data: Entity }> => client.post('/entities', body)

export const listTemplates = (): Promise<{ data: Template[] }> => client.get('/entities/templates')
export const createTemplate = (body: Partial<Template>): Promise<{ data: Template }> => client.post('/entities/templates', body)
export const listStatuses = (): Promise<{ data: Status[] }> => client.get('/entities/statuses')
