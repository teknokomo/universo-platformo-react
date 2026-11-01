import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { confirmOptimisticCreate } from './optimisticCrud'

describe('confirmOptimisticCreate', () => {
    it('merges the server entity into an optimistic item while preserving client-only context', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(['applications', 'list'], {
            items: [
                { id: 'source', name: 'Source Application' },
                {
                    id: 'optimistic-copy',
                    name: 'Source Application',
                    showInAppList: true,
                    localOnly: 'preserved',
                    __pending: true,
                    __pendingAction: 'copy'
                }
            ],
            pagination: { total: 2 }
        })

        confirmOptimisticCreate(queryClient, ['applications'], 'optimistic-copy', 'copied-application', {
            serverEntity: {
                id: 'optimistic-copy',
                name: 'Copied Application',
                showInAppList: false,
                role: 'owner'
            }
        })

        const data = queryClient.getQueryData<{
            items: Array<Record<string, unknown>>
            pagination: { total: number }
        }>(['applications', 'list'])
        expect(data?.items).toHaveLength(2)
        expect(data?.items[1]).toMatchObject({
            id: 'copied-application',
            name: 'Copied Application',
            showInAppList: false,
            role: 'owner',
            localOnly: 'preserved'
        })
        expect(data?.items[1]?.__pending).toBeUndefined()
        expect(data?.items[1]?.__pendingAction).toBeUndefined()
        expect(data?.pagination.total).toBe(2)

        queryClient.clear()
    })

    it('merges the server entity into an already present real row without duplicating it', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(['applications', 'rows'], {
            rows: [
                { id: 'optimistic-copy', name: 'Source Application' },
                { id: 'copied-application', name: 'Stale cached name' }
            ]
        })

        confirmOptimisticCreate(queryClient, ['applications'], 'optimistic-copy', 'copied-application', {
            serverEntity: { id: 'optimistic-copy', name: 'Copied Application' }
        })

        const data = queryClient.getQueryData<{ rows: Array<Record<string, unknown>> }>(['applications', 'rows'])
        expect(data?.rows).toEqual([{ id: 'copied-application', name: 'Copied Application' }])

        queryClient.clear()
    })
})
