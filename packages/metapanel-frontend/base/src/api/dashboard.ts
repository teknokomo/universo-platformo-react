import axios from 'axios'
import type { AdminDashboardStats } from '@universo/types'

const client = axios.create({
    baseURL: '/api/v1',
    withCredentials: true
})

export async function getMetapanelStats(): Promise<AdminDashboardStats> {
    const response = await client.get<{ data: AdminDashboardStats }>('/admin/dashboard/stats')
    return response.data.data
}
