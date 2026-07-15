import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import InterpretationNetworkWorkspaceWidgetEditorDialog from '../InterpretationNetworkWorkspaceWidgetEditorDialog'

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()

    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo-react/template-mui', () => ({
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave,
        onClose,
        saveButtonText,
        cancelButtonText
    }: {
        open: boolean
        title: string
        extraFields: () => ReactNode
        onSave: () => void
        onClose: () => void
        saveButtonText: string
        cancelButtonText: string
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                {extraFields()}
                <button type='button' onClick={onClose}>
                    {cancelButtonText}
                </button>
                <button type='button' onClick={onSave}>
                    {saveButtonText}
                </button>
            </div>
        ) : null
}))

vi.mock('../WidgetScopeVisibilityPanel', () => ({
    default: ({ widgetId }: { widgetId: string }) => <div data-testid='scope-visibility-panel'>{widgetId}</div>
}))

const renderDialog = (props: Partial<ComponentProps<typeof InterpretationNetworkWorkspaceWidgetEditorDialog>> = {}) => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
        <InterpretationNetworkWorkspaceWidgetEditorDialog
            open
            config={{ matrixMode: 'hierarchicalCells' }}
            onSave={onSave}
            onCancel={onCancel}
            {...props}
        />
    )

    return { onSave, onCancel }
}

describe('InterpretationNetworkWorkspaceWidgetEditorDialog', () => {
    it('enables peer Matrix views and saves a normalized default view', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog()

        expect(screen.getByRole('checkbox', { name: 'Table view' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Horizontal rows' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Vertical tree' })).toBeChecked()
        await user.click(screen.getByRole('combobox', { name: 'Default view' }))
        await user.click(screen.getByRole('option', { name: 'Table view' }))
        await user.click(screen.getByRole('combobox', { name: 'Hierarchy rows' }))
        await user.click(screen.getByRole('option', { name: 'All levels' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                hierarchyRowMode: 'allNodes',
                allowNewAxesInCellDialog: false
            })
        )
    })

    it('keeps Table view and horizontal rows available while excluding vertical tree for independent rows', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'verticalTree'
            }
        })

        expect(screen.getByRole('checkbox', { name: 'Table view' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Horizontal rows' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Vertical tree' })).toBeDisabled()
        expect(screen.getByText('Select at least one Matrix view. Vertical tree requires hierarchical cells.')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes',
                allowNewAxesInCellDialog: false
            })
        )
    })

    it('allows switching the Matrix mode from the metahub widget editor', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'verticalTree',
                tableProjection: 'hierarchicalPath'
            }
        })

        await user.click(screen.getByRole('combobox', { name: 'Matrix mode' }))
        await user.click(screen.getByRole('option', { name: 'Separate rows and columns' }))

        expect(screen.getByRole('checkbox', { name: 'Vertical tree' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes'
            })
        )
    })

    it('restores the hierarchical table projection when switching back to hierarchical cells', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes'
            }
        })

        await user.click(screen.getByRole('combobox', { name: 'Matrix mode' }))
        await user.click(screen.getByRole('option', { name: 'Hierarchical cells' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table',
                tableProjection: 'hierarchicalPath'
            })
        )
    })

    it('saves whether the cell dialog can create Matrix rows and columns', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table'
            }
        })

        const switchControl = screen.getByRole('switch', { name: 'Create rows and columns from cell dialog' })
        expect(switchControl).not.toBeChecked()

        await user.click(switchControl)
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes',
                allowNewAxesInCellDialog: true
            })
        )
    })

    it('keeps the total-cell counter setting editable for independent Matrix rows', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['horizontalRows'],
                defaultMatrixView: 'horizontalRows',
                tableProjection: 'independentAxes',
                showMatrixTreeTotalCells: false
            }
        })

        const totalCellsSwitch = screen.getByRole('switch', { name: 'Show total cells in tree' })
        expect(totalCellsSwitch).toBeEnabled()
        expect(totalCellsSwitch).not.toBeChecked()

        await user.click(totalCellsSwitch)
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['horizontalRows'],
                defaultMatrixView: 'horizontalRows',
                tableProjection: 'independentAxes',
                showMatrixTreeTotalCells: true
            })
        )
    })

    it('preserves existing widget config and shared behavior while editing display settings', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            metahubId: 'metahub-1',
            layoutId: 'layout-1',
            widgetId: 'widget-1',
            showSharedBehavior: true,
            showScopeVisibility: true,
            config: {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                conceptCodename: 'concepts',
                sharedBehavior: {
                    canDeactivate: true,
                    canExclude: false,
                    positionLocked: false
                },
                splitPane: { enabled: true }
            } as ComponentProps<typeof InterpretationNetworkWorkspaceWidgetEditorDialog>['config']
        })

        expect(screen.getByTestId('scope-visibility-panel')).toHaveTextContent('widget-1')

        await user.click(screen.getByRole('checkbox', { name: 'Table view' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['horizontalRows', 'verticalTree'],
                defaultMatrixView: 'horizontalRows',
                conceptCodename: 'concepts',
                allowNewAxesInCellDialog: false,
                splitPane: { enabled: true },
                sharedBehavior: {
                    canDeactivate: true,
                    canExclude: false,
                    positionLocked: false
                }
            })
        )
    })

    it('saves the resizable-pane setting through the shared configuration contract', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog({
            config: {
                matrixMode: 'hierarchicalCells',
                splitPane: { enabled: true }
            }
        })

        const splitPaneSwitch = screen.getByRole('switch', { name: 'Allow users to resize workspace panes' })
        expect(splitPaneSwitch).toBeChecked()

        await user.click(splitPaneSwitch)
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                splitPane: { enabled: false },
                allowNewAxesInCellDialog: false
            })
        )
    })
})
