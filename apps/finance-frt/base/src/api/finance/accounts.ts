import api from 'flowise-ui/src/api'

export const getAccounts = (unikId: string) => api.get(`/uniks/${unikId}/finance/accounts`)
export const getAccount = (unikId: string, id: string) => api.get(`/uniks/${unikId}/finance/accounts/${id}`)
export const createAccount = (unikId: string, data: any) => api.post(`/uniks/${unikId}/finance/accounts`, data)
export const updateAccount = (unikId: string, id: string, data: any) =>
    api.put(`/uniks/${unikId}/finance/accounts/${id}`, data)
export const deleteAccount = (unikId: string, id: string) =>
    api.delete(`/uniks/${unikId}/finance/accounts/${id}`)
