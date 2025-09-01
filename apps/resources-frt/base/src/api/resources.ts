import client from 'flowise-ui/src/api/client'

export const listCategories = (): Promise<{ data: import('../types').Category[] }> => client.get('/resources/categories')
export const listResources = (): Promise<{ data: import('../types').Resource[] }> => client.get('/resources')
export const getResource = (id: string): Promise<{ data: import('../types').Resource }> => client.get(`/resources/${id}`)
export const listRevisions = (id: string): Promise<{ data: import('../types').Revision[] }> => client.get(`/resources/${id}/revisions`)
export const getResourceTree = (id: string): Promise<{ data: import('../types').TreeNode }> => client.get(`/resources/${id}/tree`)
export const createResource = (data: any): Promise<{ data: import('../types').Resource }> => client.post('/resources', data)
