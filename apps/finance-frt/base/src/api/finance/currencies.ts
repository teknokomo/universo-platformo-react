import api from 'flowise-ui/src/api'

export const getCurrencies = (unikId: string) => api.get(`/unik/${unikId}/finance/currencies`)
export const getCurrency = (unikId: string, id: string) => api.get(`/unik/${unikId}/finance/currencies/${id}`)
export const createCurrency = (unikId: string, data: any) => api.post(`/unik/${unikId}/finance/currencies`, data)
export const updateCurrency = (unikId: string, id: string, data: any) => api.put(`/unik/${unikId}/finance/currencies/${id}`, data)
export const deleteCurrency = (unikId: string, id: string) => api.delete(`/unik/${unikId}/finance/currencies/${id}`)
