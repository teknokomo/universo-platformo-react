import api from '../../../../../packages/ui/src/api'

export const getCurrencies = () => api.get('/finance/currencies')
export const getCurrency = (id: string) => api.get(`/finance/currencies/${id}`)
export const createCurrency = (data: any) => api.post('/finance/currencies', data)
export const updateCurrency = (id: string, data: any) => api.put(`/finance/currencies/${id}`, data)
export const deleteCurrency = (id: string) => api.delete(`/finance/currencies/${id}`)
