import { createAuthClient } from '@universo/auth-frontend'
import type { AdminDashboardStats } from '@universo/types'

const client = createAuthClient({
    baseURL: '/api/v1',
    redirectOn401: 'auto'
})

export async function getMetapanelStats(): Promise<AdminDashboardStats> {
    const response = await client.get<{ data: AdminDashboardStats }>('/admin/dashboard/stats')
    return response.data.data
}
