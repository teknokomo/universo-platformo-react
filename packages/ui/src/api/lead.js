import client from './client'

const getLeads = (id) => client.get(`/leads/${id}`)
const getAllLeads = (chatflowid) => client.get(`/leads/${chatflowid}`)
const addLead = (body) => client.post(`/leads/`, body)

export default {
    getLeads,
    getAllLeads,
    addLead
}
