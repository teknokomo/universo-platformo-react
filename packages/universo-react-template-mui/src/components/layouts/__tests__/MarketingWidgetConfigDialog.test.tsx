import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import * as sharedDialogModule from '../../dialogs/StandardDialog'
import { MarketingWidgetConfigDialog } from '../MarketingWidgetConfigDialog'
import { LayoutAuthoringDetails } from '../LayoutAuthoringDetails'

const translate = (_key: string, defaultValue?: string) => defaultValue ?? _key

describe('MarketingWidgetConfigDialog', () => {
    it('renders its authoring surface through the shared StandardDialog primitive', () => {
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

    it('saves only Hero presentation settings and edits content in its bound Object record', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                initialConfig={{ instanceKey: 'hero', showLeadForm: true }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Hero settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByRole('switch', { name: 'Show lead form' })).toBeChecked()
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
        expect(screen.queryByTestId('marketing-widget-record-selection')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Hero content is edited separately in the bound Object record.')

        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        const presentationField = LAYOUT_WIDGET_DEFINITIONS.find(
            (definition) => definition.key === 'marketing.hero'
        )?.presentationFields?.find((field) => field.key === 'showLeadForm')
        expect(presentationField?.kind).toBe('switch')
        expect(onSave).toHaveBeenCalledWith({
            instanceKey: 'hero',
            [presentationField?.key ?? 'showLeadForm']: presentationField?.defaultValue
        })
    })

    it('uses Hero presentation translation metadata and the localized record guidance key', () => {
        const definition = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'marketing.hero')
        const field = definition?.presentationFields?.find((presentationField) => presentationField.key === 'showLeadForm')
        expect(field?.kind).toBe('switch')
        if (!field || field.kind !== 'switch') throw new Error('Hero showLeadForm presentation metadata is missing.')

        const localizedValues: Record<string, string> = {
            [field.labelKey]: 'Localized lead form label',
            [field.helperTextKey]: 'Localized lead form helper',
            'layouts.marketing.widget.recordSelectionEditHint': 'Localized bound Object record guidance'
        }
        const t = jest.fn((key: string, defaultValue?: string) => localizedValues[key] ?? defaultValue ?? key)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                title='Hero settings'
                t={t}
                onSave={() => undefined}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByRole('switch', { name: 'Localized lead form label' })).toBeChecked()
        expect(screen.getByText('Localized lead form helper')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Localized bound Object record guidance')
        expect(t).toHaveBeenCalledWith(field.labelKey, field.defaultLabel)
        expect(t).toHaveBeenCalledWith(field.helperTextKey, field.defaultHelperText)
        expect(t).toHaveBeenCalledWith(
            'layouts.marketing.widget.recordSelectionEditHint',
            'Hero content is edited separately in the bound Object record.'
        )
    })

    it('keeps other entity-backed source selection and localized labels working', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.collection'
                initialConfig={{
                    instanceKey: 'logos-instance',
                    variant: 'logos',
                    source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageLogo', label: 'Логотипы клиентов', entityKind: 'object' }]}
                title='Коллекция: логотипы'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        const sourceSelect = screen.getByRole('combobox', { name: 'Content source' })
        expect(sourceSelect).toBeEnabled()
        expect(sourceSelect).toHaveTextContent('Логотипы клиентов')

        await user.click(sourceSelect)
        await user.click(screen.getByRole('option', { name: 'Логотипы клиентов' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                instanceKey: 'logos-instance',
                source: expect.objectContaining({ entityCodename: 'MarketingPageLogo', entityKind: 'object' })
            })
        )
    })

    it('edits static marketing image settings without exposing entity source controls', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    instanceKey: 'hero-image',
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                        alt: { en: 'Hero preview', ru: 'Главное изображение' },
                        decorative: false
                    }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Image settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByTestId('marketing-image-settings')).toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: 'Content source' })).not.toBeInTheDocument()
        expect(screen.getByLabelText(/Image URL/)).toHaveValue('https://example.test/hero.webp')
        expect(screen.getByLabelText(/Alternative text \(EN\)/)).toHaveValue('Hero preview')

        await user.clear(screen.getByLabelText(/Image URL/))
        await user.type(screen.getByLabelText(/Image URL/), 'https://cdn.example.test/new-hero.webp')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                instanceKey: 'hero-image',
                media: expect.objectContaining({
                    kind: 'hero',
                    resource: expect.objectContaining({
                        type: 'url',
                        url: 'https://cdn.example.test/new-hero.webp',
                        launchMode: 'inline'
                    }),
                    decorative: false
                })
            })
        )
    })

    it('shows the localized invalid-URL reason and refuses to save remote plain-HTTP media', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    instanceKey: 'hero-image',
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                        alt: { en: 'Hero preview' },
                        decorative: false
                    }
                }}
                title='Image settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        const urlField = screen.getByLabelText(/Image URL/)
        await user.clear(urlField)
        await user.type(urlField, 'http://insecure.example.test/hero.png')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(
            await screen.findByText('Enter a valid absolute HTTPS image address (or a loopback HTTP address during local development).')
        ).toBeVisible()
        expect(onSave).not.toHaveBeenCalled()
    })

    it('blocks saving a non-decorative image without alternative text', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    instanceKey: 'hero-image',
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                        alt: { en: 'Hero preview', ru: 'Главное изображение' },
                        decorative: false
                    }
                }}
                title='Image settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        await user.clear(screen.getByLabelText(/Alternative text \(EN\)/))
        await user.clear(screen.getByLabelText(/Alternative text \(RU\)/))

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(onSave).not.toHaveBeenCalled()
    })

    it('removes unsupported legacy display fields before saving a static image widget', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    instanceKey: 'hero-image',
                    maxItems: 12,
                    showNewsletter: true,
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                        alt: { en: 'Hero preview' },
                        decorative: false
                    }
                }}
                title='Image settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        const savedConfig = onSave.mock.calls[0][0] as Record<string, unknown>
        expect(savedConfig).not.toHaveProperty('maxItems')
        expect(savedConfig).not.toHaveProperty('showNewsletter')
    })

    it('prepopulates the static image editor with the shared MUI demo URL', () => {
        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                title='Image settings'
                t={translate}
                onSave={() => undefined}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByLabelText(/Image URL/)).toHaveValue(
            'https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg'
        )
    })

    it('edits the brand name and logo override on the brand widget', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.brand'
                initialConfig={{
                    instanceKey: 'brand',
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object', recordKey: 'site-settings' }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Brand settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        fireEvent.change(screen.getByLabelText('Brand name'), { target: { value: 'Consortium' } })
        fireEvent.change(screen.getByLabelText('Brand logo URL'), { target: { value: 'https://example.test/logo.png' } })
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                brandName: 'Consortium',
                brandLogo: {
                    kind: 'logo',
                    resource: { type: 'url', url: 'https://example.test/logo.png', launchMode: 'inline' },
                    decorative: true
                }
            })
        )
    })

    it('shows the localized invalid-URL reason and refuses to save a remote plain-HTTP brand logo', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.brand'
                initialConfig={{
                    instanceKey: 'brand',
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Brand settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        fireEvent.change(screen.getByLabelText('Brand logo URL'), { target: { value: 'http://insecure.example.test/logo.png' } })
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(
            await screen.findByText('Enter a valid absolute HTTPS image address (or a loopback HTTP address during local development).')
        ).toBeVisible()
        expect(onSave).not.toHaveBeenCalled()
    })

    it('rejects a brand logo URL with embedded credentials instead of the generic save error', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.brand'
                initialConfig={{
                    instanceKey: 'brand',
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Brand settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        fireEvent.change(screen.getByLabelText('Brand logo URL'), {
            target: { value: 'https://user:secret@example.test/logo.png' }
        })
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(
            await screen.findByText('Enter a valid absolute HTTPS image address (or a loopback HTTP address during local development).')
        ).toBeVisible()
        expect(screen.queryByText('Review the widget source and settings before saving.')).not.toBeInTheDocument()
        expect(onSave).not.toHaveBeenCalled()
    })

    it('exposes the uniform pricing card style and saves it', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.pricing'
                initialConfig={{
                    instanceKey: 'pricing',
                    source: { entityCodename: 'MarketingPagePricing', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPagePricing', label: 'Pricing', entityKind: 'object' }]}
                title='Pricing settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByLabelText('Pricing card style')).toHaveTextContent('Highlight one card (Recommended)')
        expect(screen.getByLabelText('Card area width')).toHaveTextContent('Standard container')

        await user.click(screen.getByLabelText('Pricing card style'))
        await user.click(screen.getByRole('option', { name: 'Equal cards without highlight' }))
        await user.click(screen.getByLabelText('Card area width'))
        await user.click(screen.getByRole('option', { name: 'Wide container' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cardStyle: 'uniform', cardWidth: 'full' }))
    })

    it('offers features-only card settings without leaking them to other collection variants', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        const { unmount } = render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.collection'
                initialConfig={{
                    instanceKey: 'features',
                    variant: 'features',
                    source: { entityCodename: 'MarketingPageFeature', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageFeature', label: 'Features', entityKind: 'object' }]}
                title='Features settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByLabelText('Show item descriptions')).toBeChecked()
        expect(screen.getByLabelText('Scroll cards in a fixed area')).not.toBeChecked()

        await user.click(screen.getByLabelText('Show item descriptions'))
        await user.click(screen.getByLabelText('Scroll cards in a fixed area'))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ showItemDescriptions: false, fixedItemsHeight: true }))

        unmount()

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.collection'
                initialConfig={{
                    instanceKey: 'logos',
                    variant: 'logos',
                    source: { entityCodename: 'MarketingPageLogo', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageLogo', label: 'Logos', entityKind: 'object' }]}
                title='Logos settings'
                t={translate}
                onSave={jest.fn()}
                onCancel={() => undefined}
            />
        )

        expect(screen.queryByLabelText('Show item descriptions')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Scroll cards in a fixed area')).not.toBeInTheDocument()
    })

    it('shows a warning when the image preview cannot be loaded', async () => {
        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.image'
                initialConfig={{
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/missing.webp', launchMode: 'inline' },
                        alt: { en: 'Missing image' },
                        decorative: false
                    }
                }}
                title='Image settings'
                t={translate}
                onSave={() => undefined}
                onCancel={() => undefined}
            />
        )

        fireEvent(screen.getByRole('img'), new Event('error', { bubbles: true }))

        await waitFor(() => expect(screen.getByText(/The image preview could not be loaded/)).toBeInTheDocument())
    })
})

describe('LayoutAuthoringDetails', () => {
    it('exposes a widget label as a keyboard-operable button when it is interactive', async () => {
        const user = userEvent.setup()
        const onClick = jest.fn()
        const onDuplicate = jest.fn()

        render(
            <LayoutAuthoringDetails
                dragHint='Drag widgets to reorder them.'
                emptyZoneLabel='No widgets'
                addWidgetLabel='Add widget'
                availableWidgetsLabel='Available widgets'
                dragHandleLabel='Reorder widget'
                zones={[
                    {
                        zone: 'marketing-main',
                        title: 'Main',
                        items: [
                            {
                                id: 'widget-1',
                                label: 'Hero',
                                isActive: true,
                                onClick,
                                onDuplicate,
                                duplicateTooltip: 'Duplicate widget',
                                duplicateAriaLabel: 'Duplicate widget: Hero'
                            },
                            {
                                id: 'widget-2',
                                label: 'Hero',
                                isActive: true
                            }
                        ],
                        availableWidgets: []
                    }
                ]}
                onDragEnd={() => undefined}
                onAddWidgetRequest={() => undefined}
            />
        )

        expect(screen.getByRole('button', { name: 'Reorder widget: Hero (1)' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Reorder widget: Hero (2)' })).toBeInTheDocument()
        const widgetButton = screen.getByRole('button', { name: 'Hero' })
        await act(async () => {
            widgetButton.focus()
        })
        await user.keyboard('{Enter}')

        expect(onClick).toHaveBeenCalledTimes(1)

        await user.click(screen.getByRole('button', { name: 'Duplicate widget: Hero' }))
        expect(onDuplicate).toHaveBeenCalledTimes(1)
    })
})
