import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'

import TargetEntitySelector from '../TargetEntitySelector'
import { listFixedValuesDirect } from '../../domains/entities/metadata/fixedValue/api'
import { listEntityInstances } from '../../domains/entities/api/entityInstances'
import { listEntityTypes } from '../../domains/entities/api/entityTypes'

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallbackOrOptions?: string | { defaultValue?: string }, maybeOptions?: { defaultValue?: string }) => {
            if (typeof fallbackOrOptions === 'string') {
                return fallbackOrOptions
            }

            if (typeof fallbackOrOptions?.defaultValue === 'string') {
                return fallbackOrOptions.defaultValue
            }

            if (typeof maybeOptions?.defaultValue === 'string') {
                return maybeOptions.defaultValue
            }

            return _key
        }
    })
}))

vi.mock('../../domains/entities/metadata/fixedValue/api', () => ({
    listFixedValuesDirect: vi.fn()
}))

vi.mock('../../domains/entities/api/entityTypes', () => ({
    listEntityTypes: vi.fn()
}))

vi.mock('../../domains/entities/api/entityInstances', () => ({
    listEntityInstances: vi.fn()
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

const mockAnchorLayout = () =>
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 16,
        y: 16,
        top: 16,
        left: 16,
        right: 216,
        bottom: 56,
        width: 200,
        height: 40,
        toJSON: () => ({})
    } as DOMRect)

describe('TargetEntitySelector', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(listFixedValuesDirect).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
        vi.mocked(listEntityTypes).mockResolvedValue({
            items: [
                {
                    kindKey: 'object',
                    capabilities: { dataSchema: { enabled: true } },
                    ui: { iconName: 'IconDatabase', tabs: [], sidebarSection: 'objects', nameKey: 'Object' }
                },
                {
                    kindKey: 'enumeration',
                    capabilities: { dataSchema: false },
                    ui: { iconName: 'IconFiles', tabs: [], sidebarSection: 'objects', nameKey: 'Enumeration' }
                },
                {
                    kindKey: 'set',
                    capabilities: { dataSchema: { enabled: true } },
                    ui: { iconName: 'IconFileText', tabs: [], sidebarSection: 'objects', nameKey: 'Set' }
                },
                {
                    kindKey: 'custom.invoice',
                    capabilities: { dataSchema: { enabled: true } },
                    ui: { iconName: 'IconLayoutDashboard', tabs: [], sidebarSection: 'objects', nameKey: 'Invoices' }
                }
            ],
            pagination: { limit: 100, offset: 0, total: 4, count: 4, hasMore: false }
        })
        vi.mocked(listEntityInstances).mockResolvedValue({
            items: [],
            pagination: { limit: 100, offset: 0, total: 0, count: 0, hasMore: false }
        })
    })

    it('loads fixedValues when REF target kind is set and target set is selected', async () => {
        vi.mocked(listFixedValuesDirect).mockResolvedValue({
            items: [
                {
                    id: 'constant-1',
                    valueGroupId: 'set-1',
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
            expect(listFixedValuesDirect).toHaveBeenCalledWith('metahub-1', 'set-1', expect.objectContaining({ locale: 'ru', limit: 500 }))
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
                    targetEntityKind='object'
                    targetEntityId='object-1'
                    targetConstantId='constant-1'
                    onEntityKindChange={onEntityKindChange}
                    onEntityIdChange={onEntityIdChange}
                    onTargetConstantIdChange={onTargetConstantIdChange}
                />
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(listEntityTypes).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({ limit: 500, offset: 0, sortBy: 'updated', sortOrder: 'desc' })
            )
        })

        const entityKindCombobox = screen.getByRole('combobox', { name: 'Target Entity Type' })
        const anchorLayoutSpy = mockAnchorLayout()

        try {
            await user.click(entityKindCombobox)
            await user.click(await screen.findByRole('option', { name: 'set' }))
        } finally {
            anchorLayoutSpy.mockRestore()
        }

        expect(onEntityKindChange).toHaveBeenCalledWith('set')
        expect(onEntityIdChange).toHaveBeenCalledWith(null)
        expect(onTargetConstantIdChange).toHaveBeenCalledWith(null)
    })

    it('loads generic entity instances for custom dataSchema-backed kinds', async () => {
        vi.mocked(listEntityInstances).mockResolvedValueOnce({
            items: [
                {
                    id: 'invoice-1',
                    kind: 'custom.invoice',
                    codename: createVlc('owner-invoice'),
                    name: createVlc('Owner invoice')
                }
            ],
            pagination: { limit: 100, offset: 0, total: 1, count: 1, hasMore: false }
        })

        const queryClient = createQueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <TargetEntitySelector
                    metahubId='metahub-1'
                    targetEntityKind='custom.invoice'
                    targetEntityId='invoice-1'
                    onEntityKindChange={() => undefined}
                    onEntityIdChange={() => undefined}
                    onTargetConstantIdChange={() => undefined}
                    uiLocale='ru'
                />
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(listEntityInstances).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({ kind: 'custom.invoice', locale: 'ru', limit: 500 })
            )
        })

        expect(screen.getByLabelText('Target Entity')).toBeInTheDocument()
    })
})
