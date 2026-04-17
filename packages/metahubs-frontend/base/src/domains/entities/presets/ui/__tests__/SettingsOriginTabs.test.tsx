import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const mockLayoutList = vi.fn()

vi.mock('../../../layouts/ui/LayoutList', () => ({
    default: (props: Record<string, unknown>) => {
        mockLayoutList(props)
        return <div data-testid='catalog-layout-list' />
    }
}))

import {
    buildFormTabs as buildLinkedCollectionFormTabs,
    type LinkedCollectionActionContext,
    type LinkedCollectionDisplayWithContainer
} from '../LinkedCollectionActions'
import {
    buildFormTabs as buildValueGroupFormTabs,
    type ValueGroupActionContext,
    type ValueGroupDisplayWithContainer
} from '../ValueGroupActions'
import {
    buildFormTabs as buildOptionListFormTabs,
    type OptionListActionContext,
    type OptionListDisplayWithContainer
} from '../OptionListActions'

const translate = (key: string, options?: string | { defaultValue?: string }) => {
    if (typeof options === 'string') {
        return options
    }

    return options?.defaultValue ?? key
}

const baseHub = { id: 'hub-1', codename: 'hub-1', name: 'TreeEntity 1' }

const renderWithProviders = (content: React.ReactNode) => {
    const queryClient = new QueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>{content}</MemoryRouter>
        </QueryClientProvider>
    )
}

const createLinkedCollectionContext = (metahubId: string | null): LinkedCollectionActionContext => ({
    entity: {
        id: 'catalog-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'catalog-1',
        name: 'LinkedCollectionEntity 1',
        description: '',
        treeEntityId: 'hub-1',
        treeEntities: [baseHub]
    } as LinkedCollectionDisplayWithContainer,
    entityKind: 'catalog',
    t: translate,
    uiLocale: 'en',
    catalogMap: new Map(),
    currentTreeEntityId: 'hub-1',
    metahubId
})

const createValueGroupContext = (metahubId: string | null): ValueGroupActionContext => ({
    entity: {
        id: 'set-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'set-1',
        name: 'Set 1',
        description: '',
        treeEntityId: 'hub-1',
        treeEntities: [baseHub]
    } as ValueGroupDisplayWithContainer,
    entityKind: 'set',
    t: translate,
    uiLocale: 'en',
    setMap: new Map(),
    currentTreeEntityId: 'hub-1',
    metahubId
})

const createOptionListContext = (metahubId: string | null): OptionListActionContext => ({
    entity: {
        id: 'enumeration-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'enum-1',
        name: 'Enum 1',
        description: '',
        treeEntityId: 'hub-1',
        treeEntities: [baseHub]
    } as OptionListDisplayWithContainer,
    entityKind: 'enumeration',
    t: translate,
    uiLocale: 'en',
    enumerationMap: new Map(),
    currentTreeEntityId: 'hub-1',
    metahubId
})

describe('Settings-origin shared form tabs', () => {
    beforeEach(() => {
        mockLayoutList.mockReset()
    })

    it('renders the catalog layout manager and scripts tab when the edit context carries metahubId', () => {
        const tabs = buildLinkedCollectionFormTabs(
            createLinkedCollectionContext('metahub-1'),
            [baseHub] as never[],
            'catalog-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'treeEntities', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        renderWithProviders(layoutTab?.content)

        expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument()
    })

    it('still renders the catalog layout manager when metahubId is available on the edited entity', () => {
        const tabs = buildLinkedCollectionFormTabs(
            createLinkedCollectionContext(null),
            [baseHub] as never[],
            'catalog-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'treeEntities', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        renderWithProviders(layoutTab?.content)

        expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument()
    })

    it('includes scripts tabs for set and enumeration edit contexts when metahubId is present', () => {
        const setTabs = buildValueGroupFormTabs(
            createValueGroupContext('metahub-1'),
            [baseHub] as never[],
            'set-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })
        const enumerationTabs = buildOptionListFormTabs(
            createOptionListContext('metahub-1'),
            [baseHub] as never[],
            'enumeration-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(setTabs.map((tab) => tab.id)).toContain('scripts')
        expect(enumerationTabs.map((tab) => tab.id)).toContain('scripts')
    })
})
