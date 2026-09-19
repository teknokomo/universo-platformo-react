import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ApplicationAliasDialog from '../ApplicationAliasDialog'

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: (key: string, fallback?: string) =>
            ({
                'aliases.dialog.application': 'Application',
                'aliases.dialog.applicationHelp': 'Choose an active application.',
                'aliases.dialog.applicationLoadError': 'Applications could not be loaded.',
                'aliases.dialog.applicationEmpty': 'No applications found.',
                'aliases.dialog.retryApplications': 'Retry applications',
                'aliases.dialog.alias': 'Alias',
                'aliases.dialog.aliasHelp': 'Use a short lowercase address.',
                'aliases.dialog.preview': 'Preview',
                'aliases.dialog.makePrimary': 'Make primary',
                'aliases.dialog.createTitle': 'Create alias',
                'aliases.actions.cancel': 'Cancel',
                addNew: 'Add',
                'aliases.actions.save': 'Save'
            }[key] ??
            fallback ??
            key)
    })
}))

vi.mock('@universo-react/template-mui/components/dialogs', () => ({
    StandardDialog: ({ open, title, children, actions }: { open: boolean; title: string; children: ReactNode; actions: ReactNode }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                <h1>{title}</h1>
                {children}
                <footer>{actions}</footer>
            </div>
        ) : null
}))

describe('ApplicationAliasDialog', () => {
    it('shows a recoverable application selector error and keeps creation disabled', async () => {
        const user = userEvent.setup()
        const onRetryApplications = vi.fn()
        const onSubmit = vi.fn()

        render(
            <ApplicationAliasDialog
                open
                mode='create'
                applicationsError
                onRetryApplications={onRetryApplications}
                onSubmit={onSubmit}
                onClose={vi.fn()}
            />
        )

        expect(screen.getByText('Applications could not be loaded.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Retry applications' }))
        expect(onRetryApplications).toHaveBeenCalledOnce()
    })

    it('renders the application selector with the canonical searchable-select affordances', async () => {
        render(
            <ApplicationAliasDialog
                open
                mode='create'
                applications={[{ id: 'app-1', label: 'Consortium' }]}
                onClose={() => undefined}
                onSubmit={() => undefined}
            />
        )

        const combobox = screen.getByRole('combobox', { name: 'Application' })
        expect(combobox.closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall')
        expect(combobox.closest('.MuiAutocomplete-root')).toBeInTheDocument()
        expect(screen.getByTestId('UnfoldMoreRoundedIcon')).toBeInTheDocument()
    })

    it('normalizes the alias before submitting the selected application', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()

        render(
            <ApplicationAliasDialog
                open
                mode='create'
                applications={[{ id: 'app-1', label: 'Consortium Marketing' }]}
                onSubmit={onSubmit}
                onClose={vi.fn()}
            />
        )

        const applicationInput = screen.getByRole('combobox', { name: 'Application' })
        await user.click(applicationInput)
        await user.click(screen.getByRole('option', { name: 'Consortium Marketing' }))

        const aliasInput = screen.getByRole('textbox', { name: 'Alias' })
        await user.type(aliasInput, '  Meridian-73  ')
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        expect(onSubmit).toHaveBeenCalledWith({ applicationId: 'app-1', alias: 'meridian-73', makePrimary: false })
    })

    it('keeps the alias helper and validation message associated with the alias field', () => {
        render(
            <ApplicationAliasDialog
                open
                mode='edit'
                fixedApplicationId='app-1'
                initialAlias='meridian-73'
                error='Use a valid lowercase alias.'
                onSubmit={vi.fn()}
                onClose={vi.fn()}
            />
        )

        const aliasInput = screen.getByRole('textbox', { name: 'Alias' })
        const describedBy = aliasInput.getAttribute('aria-describedby') ?? ''

        expect(describedBy).not.toContain('application-alias-preview')
        expect(describedBy).toBeTruthy()
        expect(document.getElementById(describedBy)).toHaveTextContent('Use a valid lowercase alias.')
    })

    it('hides the primary transition when the operator can only create aliases', () => {
        render(
            <ApplicationAliasDialog
                open
                mode='create'
                fixedApplicationId='app-1'
                canMakePrimary={false}
                onSubmit={vi.fn()}
                onClose={vi.fn()}
            />
        )

        expect(screen.queryByLabelText('Make primary')).not.toBeInTheDocument()
    })
})
