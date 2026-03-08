import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'

import TargetEntitySelector from '../TargetEntitySelector'
import { listAllCatalogs } from '../../domains/catalogs/api'
import { listAllEnumerations } from '../../domains/enumerations/api'
import { listAllSets } from '../../domains/sets/api'
import { listConstantsDirect } from '../../domains/constants/api'

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('../../domains/catalogs/api', () => ({
    listAllCatalogs: vi.fn()
}))

vi.mock('../../domains/enumerations/api', () => ({
    listAllEnumerations: vi.fn()
}))

vi.mock('../../domains/sets/api', () => ({
    listAllSets: vi.fn()
}))

vi.mock('../../domains/constants/api', () => ({
    listConstantsDirect: vi.fn()
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                staleTime: 0
            }
        }
    })

const createVlc = (value: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
})

describe('TargetEntitySelector', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(listAllCatalogs).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
        vi.mocked(listAllEnumerations).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
        vi.mocked(listAllSets).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
        vi.mocked(listConstantsDirect).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
    })

    it('loads constants when REF target kind is set and target set is selected', async () => {
        vi.mocked(listAllSets).mockResolvedValue({
            items: [
                {
                    id: 'set-1',
                    metahubId: 'metahub-1',
                    codename: 'ProductsSet',
                    name: createVlc('Products Set'),
                    description: createVlc('Set description'),
                    isSingleHub: false,
                    isRequiredHub: false,
                    sortOrder: 1,
                    createdAt: '2026-03-05T00:00:00.000Z',
                    updatedAt: '2026-03-05T00:00:00.000Z',
                    hubs: []
                }
            ],
            pagination: { limit: 100, offset: 0, total: 1, count: 1, hasMore: false }
        })
        vi.mocked(listConstantsDirect).mockResolvedValue({
            items: [
                {
                    id: 'constant-1',
                    setId: 'set-1',
                    codename: 'TaxRate',
                    name: createVlc('Tax Rate'),
                    dataType: 'NUMBER',
                    sortOrder: 1,
                    createdAt: '2026-03-05T00:00:00.000Z',
                    updatedAt: '2026-03-05T00:00:00.000Z'
                }
            ],
            pagination: { limit: 100, offset: 0, total: 1, count: 1, hasMore: false }
        })

        const queryClient = createQueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <TargetEntitySelector
                    metahubId='metahub-1'
                    targetEntityKind='set'
                    targetEntityId='set-1'
                    targetConstantId='constant-1'
                    onEntityKindChange={() => undefined}
                    onEntityIdChange={() => undefined}
                    onTargetConstantIdChange={() => undefined}
                    uiLocale='ru'
                />
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(listConstantsDirect).toHaveBeenCalledWith('metahub-1', 'set-1', expect.objectContaining({ locale: 'ru', limit: 500 }))
        })

        expect(screen.getByLabelText('Target Constant')).toBeInTheDocument()
    })

    it('clears selected entity and constant IDs when entity kind changes', async () => {
        const onEntityKindChange = vi.fn()
        const onEntityIdChange = vi.fn()
        const onTargetConstantIdChange = vi.fn()
        const queryClient = createQueryClient()
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <TargetEntitySelector
                    metahubId='metahub-1'
                    targetEntityKind='catalog'
                    targetEntityId='catalog-1'
                    targetConstantId='constant-1'
                    onEntityKindChange={onEntityKindChange}
                    onEntityIdChange={onEntityIdChange}
                    onTargetConstantIdChange={onTargetConstantIdChange}
                />
            </QueryClientProvider>
        )

        await user.click(screen.getByRole('combobox', { name: 'Target Entity Type' }))
        await user.click(screen.getByRole('option', { name: 'Set' }))

        expect(onEntityKindChange).toHaveBeenCalledWith('set')
        expect(onEntityIdChange).toHaveBeenCalledWith(null)
        expect(onTargetConstantIdChange).toHaveBeenCalledWith(null)
    })
})
