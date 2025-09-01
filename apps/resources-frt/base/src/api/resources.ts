import client from 'flowise-ui/src/api/client'

export const listCategories = (): Promise<any> => client.get('/resources/categories')
export const listResources = (): Promise<any> => client.get('/resources')
export const getResource = (id: string): Promise<any> => client.get(`/resources/${id}`)
export const listRevisions = (id: string): Promise<any> => client.get(`/resources/${id}/revisions`)
export const getResourceTree = (id: string): Promise<any> => client.get(`/resources/${id}/tree`)
export const createResource = (data: any): Promise<any> => client.post('/resources', data)
