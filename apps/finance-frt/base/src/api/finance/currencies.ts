import api from 'flowise-ui/src/api'

export const getCurrencies = (unikId: string) => api.get(`/uniks/${unikId}/finance/currencies`)
export const getCurrency = (unikId: string, id: string) => api.get(`/uniks/${unikId}/finance/currencies/${id}`)
export const createCurrency = (unikId: string, data: any) => api.post(`/uniks/${unikId}/finance/currencies`, data)
export const updateCurrency = (unikId: string, id: string, data: any) => api.put(`/uniks/${unikId}/finance/currencies/${id}`, data)
export const deleteCurrency = (unikId: string, id: string) => api.delete(`/uniks/${unikId}/finance/currencies/${id}`)
