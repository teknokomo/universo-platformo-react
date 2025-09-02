import client from 'flowise-ui/src/api/client'

export const listEntities = (): Promise<any> => client.get('/entities')
export const getEntity = (id: string): Promise<any> => client.get(`/entities/${id}`)
export const createEntity = (body: any): Promise<any> => client.post('/entities', body)

export const listTemplates = (): Promise<any> => client.get('/entities/templates')
export const createTemplate = (body: any): Promise<any> => client.post('/entities/templates', body)
export const listStatuses = (): Promise<any> => client.get('/entities/statuses')
