import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const mockLayoutList = vi.fn()
const mockCreateScriptsTab = vi.fn((props: Record<string, unknown>) => ({
    id: 'scripts',
    label: 'Scripts',
    content: <div data-testid='scripts-tab' data-attached-kind={String(props.attachedToKind)} />
}))

vi.mock('../../../../layouts/ui/LayoutList', () => ({
    default: (props: Record<string, unknown>) => {
        mockLayoutList(props)
        return <div data-testid='entity-layout-list' />
    }
}))

vi.mock('../../../../scripts/ui/EntityScriptsTab', () => ({
    createScriptsTab: (props: Record<string, unknown>) => mockCreateScriptsTab(props)
}))

import {
    default as objectCollectionActions,
    buildFormTabs as buildObjectCollectionFormTabs,
    type ObjectCollectionActionContext,
    type ObjectCollectionDisplayWithContainer
} from '../ObjectCollectionActions'
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

const createObjectCollectionContext = (
    metahubId: string | null,
    overrides: Partial<ObjectCollectionActionContext> = {}
): ObjectCollectionActionContext => ({
    entity: {
        id: 'object-1',
        metahubId: metahubId ?? 'metahub-1',
        codename: 'object-1',
        name: 'ObjectCollectionEntity 1',
        description: '',
        treeEntityId: 'hub-1',
        treeEntities: [baseHub]
    } as ObjectCollectionDisplayWithContainer,
    entityKind: 'object',
    t: translate,
    uiLocale: 'en',
    objectMap: new Map(),
    currentTreeEntityId: 'hub-1',
    metahubId,
    ...overrides
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
        mockCreateScriptsTab.mockClear()
    })

    it('renders the entity layout manager and scripts tab when the edit context carries metahubId', () => {
        const tabs = buildObjectCollectionFormTabs(
            createObjectCollectionContext('metahub-1'),
            [baseHub] as never[],
            'object-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'treeEntities', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        renderWithProviders(layoutTab?.content)

        expect(screen.getByTestId('entity-layout-list')).toBeInTheDocument()
        expect(mockLayoutList).toHaveBeenCalledWith(
            expect.objectContaining({
                scopeEntityId: 'object-1',
                metahubId: 'metahub-1'
            })
        )
    })

    it('still renders the entity layout manager when metahubId is available on the edited entity', () => {
        const tabs = buildObjectCollectionFormTabs(
            createObjectCollectionContext(null),
            [baseHub] as never[],
            'object-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toEqual(['general', 'treeEntities', 'layout', 'scripts'])

        const layoutTab = tabs.find((tab) => tab.id === 'layout')
        renderWithProviders(layoutTab?.content)

        expect(screen.getByTestId('entity-layout-list')).toBeInTheDocument()
        expect(mockLayoutList).toHaveBeenCalledWith(
            expect.objectContaining({
                scopeEntityId: 'object-1',
                metahubId: 'metahub-1'
            })
        )
    })

    it('uses the active object-collection kind for scripts tabs instead of the base object kind', () => {
        const tabs = buildObjectCollectionFormTabs(
            createObjectCollectionContext('metahub-1', {
                routeKindKey: 'documentObject',
                entityKind: 'object'
            }),
            [baseHub] as never[],
            'object-1'
        )({
            values: {},
            setValue: vi.fn(),
            isLoading: false,
            errors: {}
        })

        expect(tabs.map((tab) => tab.id)).toContain('scripts')
        expect(mockCreateScriptsTab).toHaveBeenCalledWith(
            expect.objectContaining({
                attachedToKind: 'documentObject',
                attachedToId: 'object-1',
                metahubId: 'metahub-1'
            })
        )
    })

    it('preserves edited record behavior in the object-collection copy payload config', async () => {
        const copyEntity = vi.fn()
        const context = createObjectCollectionContext('metahub-1', {
            recordBehaviorEnabled: true,
            api: {
                copyEntity
            } as ObjectCollectionActionContext['api']
        })
        const copyAction = objectCollectionActions.find((action) => action.id === 'copy')
        const props = copyAction?.dialog?.buildProps?.(context) as
            | {
                  onSave?: (values: Record<string, unknown>) => Promise<void>
              }
            | undefined

        await props?.onSave?.({
            nameVlc: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'Enrollment copy' } }
            },
            codename: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'EnrollmentCopy' } }
            },
            treeEntityIds: ['hub-1'],
            copyComponents: true,
            copyRecords: false,
            recordBehavior: {
                mode: 'transactional',
                posting: {
                    mode: 'manual',
                    targetLedgers: ['ProgressLedger'],
                    scriptCodename: 'EnrollmentPostingScript'
                }
            }
        })

        expect(copyEntity).toHaveBeenCalledWith(
            'object-1',
            expect.objectContaining({
                config: {
                    recordBehavior: expect.objectContaining({
                        mode: 'transactional',
                        posting: expect.objectContaining({
                            mode: 'manual',
                            targetLedgers: ['ProgressLedger'],
                            scriptCodename: 'EnrollmentPostingScript'
                        })
                    })
                },
                copyComponents: true,
                copyRecords: false
            })
        )
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
