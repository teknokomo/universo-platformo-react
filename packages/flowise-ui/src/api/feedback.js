import client from './client'

const getStatsFromCanvas = (id, params) => client.get(`/stats/${id}`, { params: { ...params } })

export default {
    getStatsFromCanvas
}
