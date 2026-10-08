import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach } from '@jest/globals'
import { ConfirmContextProvider } from '../../../contexts'
import enCommonLocale from '@universo-react/i18n/locales/en/common.json'
import ruCommonLocale from '@universo-react/i18n/locales/ru/common.json'

import * as sharedDialogModule from '../../dialogs/StandardDialog'
import { ConfirmDialog } from '../../dialogs/ConfirmDialog'
import { LayoutWidgetPresentationDialog, MarketingWidgetConfigDialog } from '../MarketingWidgetConfigDialog'

const mockCommonLocaleState = { language: 'en' as 'en' | 'ru' }
const mockCommonLocales = {
    en: enCommonLocale.common as Record<string, unknown>,
    ru: ruCommonLocale.common as Record<string, unknown>
}

jest.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            if (!key.startsWith('layouts.widgetPresentation.')) return `common.${key}`
            let value: unknown = mockCommonLocales[mockCommonLocaleState.language]
            for (const segment of key.split('.')) {
                if (!value || typeof value !== 'object') return options?.defaultValue ?? key
                value = (value as Record<string, unknown>)[segment]
            }
            return typeof value === 'string' ? value : options?.defaultValue ?? key
        }
    })
}))

const translate = (_key: string, defaultValue?: string) => defaultValue ?? _key

beforeEach(() => {
    mockCommonLocaleState.language = 'en'
})

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

    it('edits only registered Hero presentation and keeps placement identity out of renderer config', async () => {
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

        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ showLeadForm: false }))
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('instanceKey')
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
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({}))

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
        await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({}))
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
        expect(control).toHaveAttribute('aria-describedby', 'layout-widget-showLeadForm-helper')
        expect(screen.getByText('Show the email signup form in this Hero placement.')).toBeInTheDocument()
    })

    it.each([
        {
            language: 'en' as const,
            maxCardsLabel: enCommonLocale.common.layouts.widgetPresentation.maxCards.label,
            densityLabel: enCommonLocale.common.layouts.widgetPresentation.density.label,
            compactLabel: enCommonLocale.common.layouts.widgetPresentation.density.compact,
            comfortableLabel: enCommonLocale.common.layouts.widgetPresentation.density.comfortable
        },
        {
            language: 'ru' as const,
            maxCardsLabel: ruCommonLocale.common.layouts.widgetPresentation.maxCards.label,
            densityLabel: ruCommonLocale.common.layouts.widgetPresentation.density.label,
            compactLabel: ruCommonLocale.common.layouts.widgetPresentation.density.compact,
            comfortableLabel: ruCommonLocale.common.layouts.widgetPresentation.density.comfortable
        }
    ])('uses registry-only Dashboard presentation fields and common $language labels', async (labels) => {
        mockCommonLocaleState.language = labels.language
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)
        render(
            <LayoutWidgetPresentationDialog
                open
                widgetKey='overviewCards'
                initialConfig={{
                    maxCards: 4,
                    density: 'compact',
                    datasource: { kind: 'records.list', sectionId: 'internal-id' },
                    cards: [{ title: 'Legacy content config' }]
                }}
                title='Overview cards'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByTestId('layout-widget-presentation-dialog')).toBeInTheDocument()
        expect(screen.getByRole('spinbutton', { name: labels.maxCardsLabel })).toHaveValue(4)
        const density = screen.getByRole('combobox', { name: labels.densityLabel })
        expect(density).toHaveTextContent(labels.compactLabel)
        expect(screen.queryByLabelText(/datasource|content|card title/i)).not.toBeInTheDocument()
        expect(screen.queryByText('internal-id')).not.toBeInTheDocument()
        expect(screen.queryByText('Legacy content config')).not.toBeInTheDocument()

        await user.clear(screen.getByRole('spinbutton', { name: labels.maxCardsLabel }))
        await user.type(screen.getByRole('spinbutton', { name: labels.maxCardsLabel }), '7')
        await user.click(density)
        await user.click(screen.getByRole('option', { name: labels.comfortableLabel }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ maxCards: 7, density: 'comfortable' }))
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('datasource')
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('cards')
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('instanceKey')
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
