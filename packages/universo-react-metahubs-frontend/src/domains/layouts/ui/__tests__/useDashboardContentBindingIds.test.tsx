import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetBindingReadDto } from '@universo-react/types'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../../types'

const mocks = vi.hoisted(() => ({ getLayoutZoneWidgetBindings: vi.fn() }))

vi.mock('../../api', () => ({ getLayoutZoneWidgetBindings: mocks.getLayoutZoneWidgetBindings }))

import { hasSingleRecordSemanticBinding, useDashboardContentBindingIds } from '../useDashboardContentBindingIds'

const layout: MetahubLayout = {
    id: 'layout-1',
    templateKey: 'dashboard',
    name: { _schema: '1', _primary: 'en', locales: {} },
    config: {},
    isActive: true,
    isDefault: false,
    sortOrder: 0,
    version: 1,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z'
}

const placement = (id: string, widgetKey = 'overviewTitle'): MetahubLayoutZoneWidget => ({
    id,
    layoutId: layout.id,
    zone: 'center',
    widgetKey,
    instanceKey: `${id}-instance`,
    parentInstanceKey: null,
    slotKey: null,
    sortOrder: 0,
    config: { level: 'h2' },
    isActive: true,
    version: 1,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z'
})

const semanticBinding: WidgetBindingReadDto = {
    widgetKey: 'overviewTitle',
    version: 1,
    bindings: [
        {
            slot: 'content',
            sourceKey: 'DashboardDemoContent',
            sourceName: 'Dashboard demo content',
            selectorKind: 'semantic-key',
            selectionLabel: 'Overview heading',
            semanticKey: 'overview-heading'
        }
    ]
}

describe('useDashboardContentBindingIds', () => {
    beforeEach(() => mocks.getLayoutZoneWidgetBindings.mockReset())

    it('recognizes only non-empty semantic bindings for single-record widgets', () => {
        expect(hasSingleRecordSemanticBinding('overviewTitle', { level: 'h2' }, semanticBinding)).toBe(true)
        expect(
            hasSingleRecordSemanticBinding(
                'overviewTitle',
                { level: 'h2' },
                {
                    ...semanticBinding,
                    bindings: [{ ...semanticBinding.bindings[0], selectorKind: 'record-set', semanticKey: undefined }]
                }
            )
        ).toBe(false)
        expect(
            hasSingleRecordSemanticBinding(
                'overviewTitle',
                { level: 'h2' },
                {
                    ...semanticBinding,
                    bindings: [{ ...semanticBinding.bindings[0], semanticKey: '  ' }]
                }
            )
        ).toBe(false)
        expect(hasSingleRecordSemanticBinding('detailsTable', {}, semanticBinding)).toBe(false)
    })

    it('returns the current layout placements with a persisted semantic binding', async () => {
        mocks.getLayoutZoneWidgetBindings.mockImplementation(async (_metahubId: string, _layoutId: string, widgetId: string) => ({
            data: widgetId === 'bound' ? semanticBinding : { ...semanticBinding, bindings: [] }
        }))
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        const { result } = renderHook(
            () =>
                useDashboardContentBindingIds({
                    metahubId: 'metahub-1',
                    layoutId: layout.id,
                    layout,
                    placements: [placement('bound'), placement('unbound'), placement('record-set', 'detailsTable')],
                    locale: 'en',
                    enabled: true
                }),
            { wrapper }
        )

        await waitFor(() => expect(result.current.has('bound')).toBe(true))
        expect(result.current.has('unbound')).toBe(false)
        expect(result.current.has('record-set')).toBe(false)
        expect(mocks.getLayoutZoneWidgetBindings).toHaveBeenCalledTimes(2)
        queryClient.clear()
    })

    it('does not request binding data when content editing is not authorized', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        const { result } = renderHook(
            () =>
                useDashboardContentBindingIds({
                    metahubId: 'metahub-1',
                    layoutId: layout.id,
                    layout,
                    placements: [placement('bound')],
                    locale: 'en',
                    enabled: false
                }),
            { wrapper }
        )

        expect(result.current.size).toBe(0)
        expect(mocks.getLayoutZoneWidgetBindings).not.toHaveBeenCalled()
        queryClient.clear()
    })
})
