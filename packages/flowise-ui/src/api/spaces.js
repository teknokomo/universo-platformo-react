import client from './client'

const buildConfig = (params) => {
    if (!params || Object.keys(params).length === 0) return undefined
    return { params }
}

const getSpaces = (unikId, params) => client.get(`/unik/${unikId}/spaces`, buildConfig(params))

const getSpace = (unikId, spaceId, config) => client.get(`/unik/${unikId}/spaces/${spaceId}`, config)

export default {
    getSpaces,
    getSpace
}
