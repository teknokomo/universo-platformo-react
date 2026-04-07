import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockLayoutList = vi.fn()

vi.mock('../../../layouts/ui/LayoutList', () => ({
    default: (props: Record<string, unknown>) => {
        mockLayoutList(props)
        return <div data-testid='catalog-layout-list' />
    }
}))

import { buildFormTabs as buildCatalogFormTabs, type CatalogActionContext, type CatalogDisplayWithHub } from '../CatalogActions'
import { buildFormTabs as buildSetFormTabs, type SetActionContext, type SetDisplayWithHub } from '../../../sets/ui/SetActions'
import {
    buildFormTabs as buildEnumerationFormTabs,
    type EnumerationActionContext,
    type EnumerationDisplayWithHub
} from '../../../enumerations/ui/EnumerationActions'

const translate = (key: string, options?: string | { defaultValue?: string }) => {
    if (typeof options === 'string') {
        return options
    }

    return options?.defaultValue ?? key
}

const baseHub = { id: 'hub-1', codename: 'hub-1', name: 'Hub 1' }

const createCatalogContext = (metahubId: string | null): CatalogActionContext => ({
    entity: {
        id: 'catalog-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'catalog-1',
        name: 'Catalog 1',
        description: '',
        hubId: 'hub-1',
        hubs: [baseHub]
    } as CatalogDisplayWithHub,
    entityKind: 'catalog',
    t: translate,
    uiLocale: 'en',
    catalogMap: new Map(),
    currentHubId: 'hub-1',
    metahubId
})

const createSetContext = (metahubId: string | null): SetActionContext => ({
    entity: {
        id: 'set-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'set-1',
        name: 'Set 1',
        description: '',
        hubId: 'hub-1',
        hubs: [baseHub]
    } as SetDisplayWithHub,
    entityKind: 'set',
    t: translate,
    uiLocale: 'en',
    setMap: new Map(),
    currentHubId: 'hub-1',
    metahubId
})

const createEnumerationContext = (metahubId: string | null): EnumerationActionContext => ({
    entity: {
        id: 'enumeration-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'enum-1',
        name: 'Enum 1',
        description: '',
        hubId: 'hub-1',
        hubs: [baseHub]
    } as EnumerationDisplayWithHub,
    entityKind: 'enumeration',
    t: translate,
    uiLocale: 'en',
    enumerationMap: new Map(),
    currentHubId: 'hub-1',
    metahubId
})

describe('Settings-origin shared form tabs', () => {
    beforeEach(() => {
        mockLayoutList.mockReset()
    })

    it('renders the catalog layout manager and scripts tab when the edit context carries metahubId', () => {
        const tabs = buildCatalogFormTabs(createCatalogContext('metahub-1'), [baseHub] as never[], 'catalog-1')({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'hubs', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        render(<>{layoutTab?.content}</>)

        expect(screen.getByTestId('catalog-layout-list')).toBeInTheDocument()
        expect(mockLayoutList).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                catalogId: 'catalog-1',
                embedded: true
            })
        )
    })

    it('still renders the catalog layout manager when metahubId is available on the edited entity', () => {
        const tabs = buildCatalogFormTabs(createCatalogContext(null), [baseHub] as never[], 'catalog-1')({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'hubs', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        render(<>{layoutTab?.content}</>)

        expect(screen.getByTestId('catalog-layout-list')).toBeInTheDocument()
        expect(mockLayoutList).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                catalogId: 'catalog-1',
                embedded: true
            })
        )
    })

    it('includes scripts tabs for set and enumeration edit contexts when metahubId is present', () => {
        const setTabs = buildSetFormTabs(createSetContext('metahub-1'), [baseHub] as never[], 'set-1')({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })
        const enumerationTabs = buildEnumerationFormTabs(createEnumerationContext('metahub-1'), [baseHub] as never[], 'enumeration-1')({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(setTabs.map((tab) => tab.id)).toContain('scripts')
        expect(enumerationTabs.map((tab) => tab.id)).toContain('scripts')
    })
})