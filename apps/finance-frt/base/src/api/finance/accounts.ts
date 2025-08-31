import api from '../../../../../packages/ui/src/api'

export const getAccounts = () => api.get('/finance/accounts')
export const getAccount = (id: string) => api.get(`/finance/accounts/${id}`)
export const createAccount = (data: any) => api.post('/finance/accounts', data)
export const updateAccount = (id: string, data: any) => api.put(`/finance/accounts/${id}`, data)
export const deleteAccount = (id: string) => api.delete(`/finance/accounts/${id}`)
