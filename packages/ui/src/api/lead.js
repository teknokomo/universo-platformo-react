import client from './client'

const getCanvasLeads = (canvasId) => client.get(`/leads/${canvasId}`)
const addLead = (body) => client.post(`/leads`, body)

export default {
    getCanvasLeads,
    addLead
}
