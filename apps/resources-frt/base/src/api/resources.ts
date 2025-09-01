import client from 'flowise-ui/src/api/client'

export const listCategories = () => client.get('/resources/categories')
export const listResources = () => client.get('/resources')
export const getResource = (id: string) => client.get(`/resources/${id}`)
export const listRevisions = (id: string) => client.get(`/resources/${id}/revisions`)
export const getResourceTree = (id: string) => client.get(`/resources/${id}/tree`)
