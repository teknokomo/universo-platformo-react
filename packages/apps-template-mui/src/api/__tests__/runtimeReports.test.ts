import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runRuntimeReport } from '../api'
import type { ReportDefinition } from '@universo/types'

const reportDefinition: ReportDefinition = {
    codename: 'LearnerProgress',
    title: 'Learner progress',
    datasource: {
        kind: 'records.list',
        sectionCodename: 'ModuleProgress'
    },
    columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }],
    filters: [],
    aggregations: []
}

describe('runtime report API helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('runs a report through the runtime reports endpoint with CSRF protection', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/reports/run?workspaceId=workspace-1')
            return new Response(
                JSON.stringify({
                    rows: [{ ProgressPercent: 75 }],
                    total: 1,
                    aggregations: { AverageProgress: 75 },
                    definition: reportDefinition
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await runRuntimeReport({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            reportCodename: 'LearnerProgress',
            limit: 25,
            offset: 0,
            workspaceId: 'workspace-1'
        })

        expect(result.rows).toEqual([{ ProgressPercent: 75 }])
        expect(result.total).toBe(1)
        expect(result.aggregations).toEqual({ AverageProgress: 75 })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const reportRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(reportRequest.method).toBe('POST')
        expect(reportRequest.body).toBe(JSON.stringify({ reportCodename: 'LearnerProgress', limit: 25, offset: 0 }))
        expect(new Headers(reportRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })
})
