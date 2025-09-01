import client from 'flowise-ui/src/api/client'

export const listEntities = () => client.get('/entities')
export const getEntity = (id: string) => client.get(`/entities/${id}`)
export const createEntity = (body: any) => client.post('/entities', body)

export const listTemplates = () => client.get('/entities/templates')
export const createTemplate = (body: any) => client.post('/entities/templates', body)
