import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { confirmOptimisticCreate } from '../optimisticCrud'

describe('apps-template optimisticCrud', () => {
    it('drops duplicate optimistic runtime rows when the real row already exists', () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        })

        queryClient.setQueryData(['runtime', 'rows'], {
            rows: [
                {
                    id: 'opt-row-1',
                    name: 'Draft row',
                    __pending: true,
                    __pendingAction: 'create'
                },
                {
                    id: 'row-1',
                    name: 'Server row'
                }
            ]
        })

        confirmOptimisticCreate(queryClient, ['runtime'], 'opt-row-1', 'row-1')
        const data = queryClient.getQueryData(['runtime', 'rows'])

        expect(data).toEqual({
            rows: [
                {
                    id: 'row-1',
                    name: 'Server row'
                }
            ]
        })
    })
})
