import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { MarketingWidgetBindingDialogViewModel } from '../useMarketingWidgetBindingDialog'

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))

vi.mock('@universo-react/template-mui', () => ({
    useConfirm: () => ({ confirm: mocks.confirm })
}))
vi.mock('@universo-react/template-mui/components/dialogs', () => ({
    DynamicEntityFormDialog: () => null,
    StandardDialog: ({ open, title, actions, children }: { open: boolean; title: string; actions: ReactNode; children: ReactNode }) =>
        open ? (
            <div role='dialog' aria-label={title} data-testid='shared-standard-dialog'>
                {children}
                <div>{actions}</div>
            </div>
        ) : null
}))
vi.mock('../MarketingWidgetBindingSlots', () => ({
    default: ({ model }: { model: { state?: { draftBindings?: Record<string, { selectionLabel?: string }> } } }) => (
        <div data-testid='binding-draft'>{model.state?.draftBindings?.content?.selectionLabel ?? ''}</div>
    )
}))

import MarketingWidgetBindingDialogView from '../MarketingWidgetBindingDialogView'

const createModel = (options?: {
    onClose?: () => void
    widgetId?: string | null
    placementId?: string | null
    isDirty?: boolean
    sourceProvisionOpen?: boolean
    sourceProvisionName?: string
    sourceProvisionPending?: boolean
    recordFormError?: string | null
}) => {
    const onClose = options?.onClose ?? vi.fn()
    const model = {
        dialog: {
            open: true,
            widgetId: options?.widgetId === undefined ? 'widget-1' : options.widgetId,
            canManageLayouts: true,
            onClose,
            onConfigurePresentation: undefined,
            rawLocale: 'en',
            sectionTargets: []
        },
        state: {
            draftBindings: { content: { selectionLabel: 'Draft content' } },
            recordFormMode: null,
            recordFormInitialData: {},
            recordFormError: options?.recordFormError ?? null,
            recordFieldError: null,
            isRecordSaving: false,
            isCreatingSelection: false,
            sourceProvisionOpen: options?.sourceProvisionOpen ?? false,
            sourceProvisionName: options?.sourceProvisionName ?? '',
            sourceProvisionError: false
        },
        queries: {
            bindingQuery: { isError: false },
            updateMutation: { isPending: false },
            sourceProvisionMutation: { isPending: options?.sourceProvisionPending ?? false, mutateAsync: vi.fn() }
        },
        data: {
            title: 'Hero',
            isBusy: false,
            canSubmit: true,
            isDirty: options?.isDirty ?? true,
            canCreatePlacement: true,
            isBindingReady: true,
            recordFields: [],
            placementId: options?.placementId === undefined ? 'widget-1' : options.placementId
        },
        actions: {
            handleConfigurePresentation: vi.fn(),
            handleSave: vi.fn(),
            handleCreateSelection: vi.fn(),
            closeSourceProvision: vi.fn(),
            closeRecordForm: vi.fn(),
            openEditRecord: vi.fn(),
            saveRecordForm: vi.fn(),
            setRecordFieldError: vi.fn(),
            setSourceProvisionName: vi.fn(),
            setSourceProvisionError: vi.fn()
        },
        refs: { sourceProvisionNameInputRef: { current: null } },
        t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key
    }
    return { model: model as unknown as MarketingWidgetBindingDialogViewModel, onClose }
}

describe('MarketingWidgetBindingDialogView discard contract', () => {
    it('renders the binding surface through the shared StandardDialog primitive', () => {
        const { model } = createModel()

        render(<MarketingWidgetBindingDialogView model={model} />)

        const sharedDialog = screen.getByTestId('shared-standard-dialog')
        expect(screen.getByRole('dialog', { name: 'Hero', exact: true })).toBe(sharedDialog)
        expect(within(sharedDialog).getByRole('button', { name: 'Cancel', exact: true })).toBeInTheDocument()
        expect(within(sharedDialog).getByRole('button', { name: 'Save', exact: true })).toBeInTheDocument()
    })

    it('shows a localized retry action when loading the selected content record fails', async () => {
        const user = userEvent.setup()
        const { model } = createModel({ recordFormError: 'The selected content record could not be loaded.' })
        const openEditRecord = model.actions.openEditRecord as ReturnType<typeof vi.fn>

        render(<MarketingWidgetBindingDialogView model={model} />)

        expect(screen.getByRole('alert')).toHaveTextContent('The selected content record could not be loaded.')
        await user.click(screen.getByRole('button', { name: 'Retry', exact: true }))

        expect(openEditRecord).toHaveBeenCalledTimes(1)
    })

    it('preserves a dirty binding draft when discard is canceled and closes after confirmation', async () => {
        const user = userEvent.setup()
        const { model, onClose } = createModel()
        mocks.confirm.mockReset().mockResolvedValueOnce(false).mockResolvedValueOnce(true)

        render(<MarketingWidgetBindingDialogView model={model} />)

        const bindingDialog = screen.getByRole('dialog', { name: 'Hero', exact: true })
        expect(screen.getByTestId('binding-draft')).toHaveTextContent('Draft content')
        await user.click(within(bindingDialog).getByRole('button', { name: 'Cancel', exact: true }))

        await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
        expect(mocks.confirm).toHaveBeenLastCalledWith({
            title: 'Discard unsaved changes?',
            description: 'Your unsaved changes will be lost.',
            confirmButtonName: 'Discard',
            cancelButtonName: 'Keep editing'
        })
        expect(onClose).not.toHaveBeenCalled()
        expect(bindingDialog).toBeVisible()
        expect(screen.getByTestId('binding-draft')).toHaveTextContent('Draft content')

        await user.click(within(bindingDialog).getByRole('button', { name: 'Cancel', exact: true }))
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    })

    it('confirms closing a new placement after a binding is selected', async () => {
        const user = userEvent.setup()
        const { model, onClose } = createModel({ widgetId: null, placementId: null, isDirty: false })
        mocks.confirm.mockReset().mockResolvedValue(false)

        render(<MarketingWidgetBindingDialogView model={model} />)
        await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }))

        expect(mocks.confirm).toHaveBeenCalledWith({
            title: 'Discard unsaved changes?',
            description: 'Your unsaved changes will be lost.',
            confirmButtonName: 'Discard',
            cancelButtonName: 'Keep editing'
        })
        expect(onClose).not.toHaveBeenCalled()
    })

    it('preserves a source-provisioning name until the user confirms discarding it', async () => {
        const user = userEvent.setup()
        const { model } = createModel({ sourceProvisionOpen: true, sourceProvisionName: 'Partner stories' })
        const closeSourceProvision = model.actions.closeSourceProvision as ReturnType<typeof vi.fn>
        mocks.confirm.mockReset().mockResolvedValueOnce(false).mockResolvedValueOnce(true)

        render(<MarketingWidgetBindingDialogView model={model} />)

        const provisionDialog = screen.getByRole('dialog', { name: 'Create a separate content source', exact: true })
        const nameField = within(provisionDialog).getByRole('textbox', { name: 'Content source name', exact: true })
        expect(nameField).toHaveValue('Partner stories')

        await user.click(within(provisionDialog).getByRole('button', { name: 'Cancel', exact: true }))
        await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
        expect(closeSourceProvision).not.toHaveBeenCalled()
        expect(nameField).toHaveValue('Partner stories')

        await user.click(within(provisionDialog).getByRole('button', { name: 'Cancel', exact: true }))
        await waitFor(() => expect(closeSourceProvision).toHaveBeenCalledTimes(1))
    })

    it('does not close source provisioning while creation is pending', () => {
        const { model } = createModel({ sourceProvisionOpen: true, sourceProvisionName: 'Partner stories', sourceProvisionPending: true })
        const closeSourceProvision = model.actions.closeSourceProvision as ReturnType<typeof vi.fn>
        mocks.confirm.mockReset()

        render(<MarketingWidgetBindingDialogView model={model} />)

        const provisionDialog = screen.getByRole('dialog', { name: 'Create a separate content source', exact: true })
        const cancel = within(provisionDialog).getByRole('button', { name: 'Cancel', exact: true })
        expect(cancel).toBeDisabled()
        expect(mocks.confirm).not.toHaveBeenCalled()
        expect(closeSourceProvision).not.toHaveBeenCalled()
    })
})
