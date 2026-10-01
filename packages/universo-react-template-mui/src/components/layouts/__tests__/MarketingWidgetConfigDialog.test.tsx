import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { ConfirmContextProvider } from '../../../contexts'

import * as sharedDialogModule from '../../dialogs/StandardDialog'
import { ConfirmDialog } from '../../dialogs/ConfirmDialog'
import { MarketingWidgetConfigDialog } from '../MarketingWidgetConfigDialog'

jest.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({ t: (key: string) => `common.${key}` })
}))

const translate = (_key: string, defaultValue?: string) => defaultValue ?? _key

describe('MarketingWidgetConfigDialog', () => {
    it('preserves presentation edits when discard is canceled and closes after discard is confirmed', async () => {
        const user = userEvent.setup()
        const onCancel = jest.fn()
        const onSave = jest.fn()

        render(
            <ConfirmContextProvider>
                <MarketingWidgetConfigDialog
                    open
                    widgetKey='marketing.hero'
                    initialConfig={{ showLeadForm: true }}
                    title='Hero settings'
                    t={translate}
                    onSave={onSave}
                    onCancel={onCancel}
                />
                <ConfirmDialog />
            </ConfirmContextProvider>
        )

        const presentationDialog = screen.getByRole('dialog', { name: 'Hero settings', exact: true })
        const leadForm = screen.getByRole('switch', { name: 'Show lead form' })
        await user.click(leadForm)
        expect(leadForm).not.toBeChecked()
        await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }))

        const discardDialog = screen.getByRole('dialog', { name: 'common.unsavedChanges.title' })
        expect(discardDialog).toHaveAccessibleDescription('common.unsavedChanges.description')
        await user.click(screen.getByRole('button', { name: 'common.unsavedChanges.cancel' }))

        expect(onCancel).not.toHaveBeenCalled()
        expect(presentationDialog).toBeVisible()
        expect(leadForm).not.toBeChecked()

        await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
        await user.click(screen.getByRole('button', { name: 'common.unsavedChanges.confirm' }))

        await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
        expect(onSave).not.toHaveBeenCalled()
    })

    it('uses the shared StandardDialog primitive', () => {
        const standardDialogSpy = jest.spyOn(sharedDialogModule, 'StandardDialog')
        try {
            render(
                <MarketingWidgetConfigDialog
                    open
                    widgetKey='marketing.hero'
                    title='Hero settings'
                    t={translate}
                    onSave={() => undefined}
                    onCancel={() => undefined}
                />
            )
            expect(standardDialogSpy.mock.calls.some(([props]) => props.open && props.title === 'Hero settings')).toBe(true)
        } finally {
            standardDialogSpy.mockRestore()
        }
    })

    it('edits only registered Hero presentation and preserves instance identity', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)
        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                initialConfig={{ instanceKey: 'hero-main', showLeadForm: true }}
                title='Hero settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        const leadForm = screen.getByRole('switch', { name: 'Show lead form' })
        expect(leadForm).toBeChecked()
        expect(screen.getByRole('alert')).toHaveTextContent('bound Entity records')
        await user.click(leadForm)
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ instanceKey: 'hero-main', showLeadForm: false }))
    })

    it('renders registry presentation fields and excludes source selection from the saved config', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)
        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.collection'
                initialConfig={{
                    instanceKey: 'feature-list',
                    variant: 'features',
                    source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' }
                }}
                title='Features'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByRole('alert')).toHaveTextContent('bound Entity records')
        expect(screen.getByRole('combobox', { name: 'Content type' })).toHaveTextContent('Features')
        expect(screen.getByLabelText('Maximum items')).toHaveValue(100)
        expect(screen.getByRole('switch', { name: 'Show item descriptions' })).toBeChecked()
        expect(screen.queryByText('MarketingPageFeature')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    instanceKey: 'feature-list',
                    variant: 'features',
                    maxItems: 100,
                    showItemDescriptions: true,
                    fixedItemsHeight: false
                })
            )
        )
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('source')
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('copySource')
    })

    it('keeps Image and Brand records in Entity content instead of widget settings', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)
        const { rerender } = render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    instanceKey: 'hero-image',
                    media: { kind: 'hero', resource: { type: 'url', url: 'https://example.test/hero.webp' } }
                }}
                title='Image'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByRole('alert')).toHaveTextContent('bound Entity records')
        expect(screen.queryByLabelText('Image URL')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ instanceKey: 'hero-image' }))

        rerender(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.brand'
                initialConfig={{ instanceKey: 'brand-main' }}
                title='Brand'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )
        expect(screen.getByRole('alert')).toHaveTextContent('bound Entity records')
        expect(screen.queryByLabelText('Brand name')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({ instanceKey: 'brand-main' }))
    })

    it('localizes registry labels and associates helper text with controls', () => {
        const localized = jest.fn((key: string, defaultValue?: string) =>
            key === 'layouts.marketing.widget.showLeadForm' ? 'Show signup form' : defaultValue ?? key
        )
        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                title='Hero'
                t={localized}
                onSave={() => undefined}
                onCancel={() => undefined}
            />
        )
        const control = screen.getByRole('switch', { name: 'Show signup form' })
        expect(control).toHaveAttribute('aria-describedby', 'marketing-widget-showLeadForm-helper')
        expect(screen.getByText('Show the email signup form in this Hero placement.')).toBeInTheDocument()
    })

    it('keeps authentication presentation on the auth widget only', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined)
        const { rerender } = render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.navigation'
                title='Navigation'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )
        expect(screen.queryByRole('switch', { name: 'Show authentication actions' })).not.toBeInTheDocument()

        rerender(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.auth'
                title='Authentication'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )
        const authActions = screen.getByRole('switch', { name: 'Show authentication actions' })
        expect(authActions).toBeChecked()
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ showAuthActions: true }))
    })
})
