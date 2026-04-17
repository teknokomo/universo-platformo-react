import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const createChildFieldDefinitionMutate = vi.fn()
const moveFieldDefinitionMutateAsync = vi.fn()
const toggleFieldDefinitionRequiredMutateAsync = vi.fn()
const setDisplayFieldDefinitionMutateAsync = vi.fn()
const clearDisplayFieldDefinitionMutateAsync = vi.fn()

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
        if (key === 'entity.catalog.attributeCodenameScope') return 'per-level'
        if (key === 'entity.catalog.allowedAttributeTypes') return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'TABLE']
        if (key === 'entity.catalog.allowAttributeCopy') return true
        if (key === 'entity.catalog.allowAttributeDelete') return true
        if (key === 'entity.catalog.allowDeleteLastDisplayAttribute') return true
        return undefined
    }
}))

vi.mock('../../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateChildFieldDefinition: () => ({ mutate: createChildFieldDefinitionMutate, isPending: false }),
    useUpdateChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useCopyChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useMoveFieldDefinition: () => ({ mutateAsync: moveFieldDefinitionMutateAsync, isPending: false }),
    useToggleFieldDefinitionRequired: () => ({ mutateAsync: toggleFieldDefinitionRequiredMutateAsync, isPending: false }),
    useSetDisplayFieldDefinition: () => ({ mutateAsync: setDisplayFieldDefinitionMutateAsync, isPending: false }),
    useClearDisplayFieldDefinition: () => ({ mutateAsync: clearDisplayFieldDefinitionMutateAsync, isPending: false })
}))

vi.mock('../../../../../shared', () => ({
    metahubsQueryKeys: {
        allFieldDefinitionCodenames: () => ['attributeCodenames'],
        fieldDefinitionsDirect: () => ['fieldDefinitionsDirect']
    },
    invalidateFieldDefinitionsQueries: {
        allCodenames: vi.fn(),
        all: vi.fn()
    }
}))

vi.mock('../../api', () => ({}))

vi.mock('../FieldDefinitionFormFields', () => ({
    __esModule: true,
    default: () => null,
    PresentationTabFields: () => null
}))

vi.mock('../dnd', () => ({
    useContainerRegistry: () => ({ register: vi.fn(), unregister: vi.fn() }),
    useFieldDefinitionDndState: () => ({
        activeContainerId: null,
        overContainerId: null,
        pendingTransfer: null,
        activeFieldDefinition: null
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
            nameVlc: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Child attribute' } } },
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'child_attribute' } } },
            codenameTouched: true,
            dataType: 'STRING',
            isRequired: false,
            isDisplayAttribute: false,
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

import NestedFieldDefinitionList from '../NestedFieldDefinitionList'

describe('NestedFieldDefinitionList optimistic create flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dispatches the child optimistic create hook and closes the dialog immediately', async () => {
        render(
            <NestedFieldDefinitionList
                metahubId='metahub-1'
                treeEntityId='hub-1'
                linkedCollectionId='catalog-1'
                parentAttributeId='attribute-parent-1'
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'create' }))
        expect(screen.getByTestId('child-create-dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'submit-child-create' }))

        await waitFor(() => {
            expect(createChildFieldDefinitionMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    metahubId: 'metahub-1',
                    treeEntityId: 'hub-1',
                    linkedCollectionId: 'catalog-1',
                    parentAttributeId: 'attribute-parent-1',
                    data: expect.objectContaining({
                        codename: expect.objectContaining({
                            _primary: 'en',
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'child_attribute' })
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
