import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const createChildComponentMutate = vi.fn()
const moveComponentMutateAsync = vi.fn()
const toggleComponentRequiredMutateAsync = vi.fn()
const setDisplayComponentMutateAsync = vi.fn()
const clearDisplayComponentMutateAsync = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({
        enqueueSnackbar: vi.fn()
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn()
    }),
    useQuery: () => ({
        data: { items: [] },
        isLoading: false,
        error: null
    })
}))

vi.mock('../../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'kebab-case',
        alphabet: 'en',
        allowMixed: false,
        autoConvertMixedAlphabets: true,
        autoReformat: true,
        requireReformat: false
    })
}))

vi.mock('../../../../settings/hooks/useSettings', () => ({
    useSettingValue: (key: string) => {
        if (key === 'entity.object.componentCodenameScope') return 'per-level'
        if (key === 'entity.object.allowedComponentTypes') return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'TABLE']
        if (key === 'entity.object.allowComponentCopy') return true
        if (key === 'entity.object.allowComponentDelete') return true
        if (key === 'entity.object.allowDeleteLastDisplayComponent') return true
        return undefined
    }
}))

vi.mock('../../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateChildComponent: () => ({ mutate: createChildComponentMutate, isPending: false }),
    useUpdateChildComponent: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteChildComponent: () => ({ mutate: vi.fn(), isPending: false }),
    useCopyChildComponent: () => ({ mutate: vi.fn(), isPending: false }),
    useMoveComponent: () => ({ mutateAsync: moveComponentMutateAsync, isPending: false }),
    useToggleComponentRequired: () => ({ mutateAsync: toggleComponentRequiredMutateAsync, isPending: false }),
    useSetDisplayComponent: () => ({ mutateAsync: setDisplayComponentMutateAsync, isPending: false }),
    useClearDisplayComponent: () => ({ mutateAsync: clearDisplayComponentMutateAsync, isPending: false })
}))

vi.mock('../../../../../shared', () => ({
    metahubsQueryKeys: {
        allComponentCodenames: () => ['componentCodenames'],
        componentsDirect: () => ['componentsDirect']
    },
    invalidateComponentsQueries: {
        allCodenames: vi.fn(),
        all: vi.fn()
    }
}))

vi.mock('../../api', () => ({}))

vi.mock('../ComponentFormFields', () => ({
    __esModule: true,
    default: () => null,
    PresentationTabFields: () => null
}))

vi.mock('../dnd', () => ({
    useContainerRegistry: () => ({ register: vi.fn(), unregister: vi.fn() }),
    useComponentDndState: () => ({
        activeContainerId: null,
        overContainerId: null,
        pendingTransfer: null,
        activeComponent: null
    })
}))

vi.mock('../../../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    CodenameField: () => null
}))

const templateMuiMock = vi.hoisted(() => ({
    BaseEntityMenu: () => null,
    FlowListTable: () => <div>child-table</div>,
    notifyError: vi.fn(),
    createMemberActions: vi.fn(() => ({}))
}))

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    return {
        ...templateMuiMock,
        useListDialogs: actual.useListDialogs
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    ...templateMuiMock,
    EntityFormDialog: ({ open, onSave }: { open: boolean; onSave: (data: Record<string, unknown>) => Promise<void> }) => {
        if (!open) return null

        const values = {
            nameVlc: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Child component' } } },
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'child_component' } } },
            codenameTouched: true,
            dataType: 'STRING',
            isRequired: false,
            isDisplayComponent: false,
            validationRules: {},
            uiConfig: {},
            targetEntityId: null,
            targetEntityKind: null,
            _hasCodenameDuplicate: false
        }

        return (
            <div data-testid='child-create-dialog'>
                <button onClick={() => void onSave(values)} type='button'>
                    submit-child-create
                </button>
            </div>
        )
    },
    ConfirmDeleteDialog: () => null
}))

import NestedComponentList from '../NestedComponentList'

describe('NestedComponentList optimistic create flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dispatches the child optimistic create hook and closes the dialog immediately', async () => {
        render(
            <NestedComponentList
                metahubId='metahub-1'
                treeEntityId='hub-1'
                objectCollectionId='object-1'
                parentComponentId='component-parent-1'
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'create' }))
        expect(screen.getByTestId('child-create-dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'submit-child-create' }))

        await waitFor(() => {
            expect(createChildComponentMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    metahubId: 'metahub-1',
                    treeEntityId: 'hub-1',
                    objectCollectionId: 'object-1',
                    parentComponentId: 'component-parent-1',
                    data: expect.objectContaining({
                        codename: expect.objectContaining({
                            _primary: 'en',
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'child_component' })
                            })
                        }),
                        dataType: 'STRING'
                    })
                }),
                expect.any(Object)
            )
        })

        expect(screen.queryByTestId('child-create-dialog')).not.toBeInTheDocument()
    })
})
