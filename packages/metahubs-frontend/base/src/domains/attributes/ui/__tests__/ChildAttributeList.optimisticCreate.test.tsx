import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const createChildAttributeMutate = vi.fn()

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

vi.mock('../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'kebab-case',
        alphabet: 'en',
        allowMixed: false,
        autoConvertMixedAlphabets: true,
        autoReformat: true,
        requireReformat: false,
        localizedEnabled: false
    })
}))

vi.mock('../../../settings/hooks/useSettings', () => ({
    useSettingValue: (key: string) => {
        if (key === 'catalogs.attributeCodenameScope') return 'per-level'
        if (key === 'catalogs.allowedAttributeTypes') return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'TABLE']
        if (key === 'catalogs.allowAttributeCopy') return true
        if (key === 'catalogs.allowAttributeDelete') return true
        if (key === 'catalogs.allowDeleteLastDisplayAttribute') return true
        return undefined
    }
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateChildAttribute: () => ({ mutate: createChildAttributeMutate, isPending: false }),
    useUpdateChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useCopyChildAttribute: () => ({ mutate: vi.fn(), isPending: false }),
    useMoveAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useToggleAttributeRequired: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSetDisplayAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClearDisplayAttribute: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../../shared', () => ({
    metahubsQueryKeys: {
        allAttributeCodenames: () => ['attributeCodenames'],
        attributesDirect: () => ['attributesDirect']
    },
    invalidateAttributesQueries: {
        allCodenames: vi.fn(),
        all: vi.fn()
    }
}))

vi.mock('../../api', () => ({}))

vi.mock('../AttributeFormFields', () => ({
    __esModule: true,
    default: () => null,
    PresentationTabFields: () => null
}))

vi.mock('../dnd', () => ({
    useContainerRegistry: () => ({ register: vi.fn(), unregister: vi.fn() }),
    useAttributeDndState: () => ({
        activeContainerId: null,
        overContainerId: null,
        pendingTransfer: null,
        activeAttribute: null
    })
}))

vi.mock('../../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    CodenameField: () => null
}))

const templateMuiMock = vi.hoisted(() => ({
    BaseEntityMenu: () => null,
    FlowListTable: () => <div>child-table</div>,
    notifyError: vi.fn()
}))

vi.mock('@universo/template-mui', () => ({
    ...templateMuiMock
}))

vi.mock('@universo/template-mui/components/dialogs', () => ({
    ...templateMuiMock,
    EntityFormDialog: ({ open, onSave }: { open: boolean; onSave: (data: Record<string, unknown>) => Promise<void> }) => {
        if (!open) return null

        const values = {
            nameVlc: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Child attribute' } } },
            codenameVlc: null,
            codename: 'child_attribute',
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

import ChildAttributeList from '../ChildAttributeList'

describe('ChildAttributeList optimistic create flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dispatches the child optimistic create hook and closes the dialog immediately', async () => {
        render(<ChildAttributeList metahubId='metahub-1' hubId='hub-1' catalogId='catalog-1' parentAttributeId='attribute-parent-1' />)

        fireEvent.click(screen.getByRole('button', { name: 'create' }))
        expect(screen.getByTestId('child-create-dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'submit-child-create' }))

        await waitFor(() => {
            expect(createChildAttributeMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    metahubId: 'metahub-1',
                    hubId: 'hub-1',
                    catalogId: 'catalog-1',
                    parentAttributeId: 'attribute-parent-1',
                    data: expect.objectContaining({
                        codename: 'child-attribute',
                        dataType: 'STRING'
                    })
                }),
                expect.any(Object)
            )
        })

        expect(screen.queryByTestId('child-create-dialog')).not.toBeInTheDocument()
    })
})
