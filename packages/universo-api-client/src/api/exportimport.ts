/**
 * ExportImportApi
 *
 * Auto-generated stub - needs implementation based on exportimport.js
 */

import type { AxiosInstance } from 'axios'

export class ExportImportApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Import platform data for a specific Unik
     * POST /unik/:unikId/export-import/import
     */
    async importData(unikId: string, payload: any) {
        if (!unikId) throw new Error('unikId is required')
        const { data } = await this.client.post(`/unik/${unikId}/export-import/import`, payload)
        return data
    }

    /**
     * Export platform data for a specific Unik
     * POST /unik/:unikId/export-import/export
     */
    async exportData(unikId: string, payload: any) {
        if (!unikId) throw new Error('unikId is required')
        const { data } = await this.client.post(`/unik/${unikId}/export-import/export`, payload)
        return data
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const exportimportQueryKeys = {
    all: ['export-import'] as const
} as const
