import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { MarketingWidgetConfigDialog } from '../MarketingWidgetConfigDialog'
import { LayoutAuthoringDetails } from '../LayoutAuthoringDetails'

const translate = (_key: string, defaultValue?: string) => defaultValue ?? _key

describe('MarketingWidgetConfigDialog', () => {
    it('leaves new widget identity to the server and does not expose a record key editor', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Hero settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.queryByLabelText('Record key (optional)')).not.toBeInTheDocument()
        expect(screen.getByTestId('marketing-widget-record-selection')).toHaveTextContent(
            'The published source determines which records are shown.'
        )

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: 'Site settings' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        const savedConfig = onSave.mock.calls[0][0] as Record<string, unknown>
        expect(savedConfig).not.toHaveProperty('instanceKey')
        expect(savedConfig).not.toHaveProperty('source.recordKey')
    })

    it('allows replacing an unavailable source before saving', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                initialConfig={{
                    instanceKey: 'hero-instance',
                    source: { entityCodename: 'MarketingPageRemoved', entityKind: 'object' }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Hero settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByRole('alert')).toHaveTextContent('The previously selected content source is no longer available.')
        expect(screen.getByRole('combobox')).toBeEnabled()

        await user.click(screen.getByRole('combobox'))
        await user.click(screen.getByRole('option', { name: 'Site settings' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                instanceKey: 'hero-instance',
                source: expect.objectContaining({
                    entityCodename: 'MarketingPageSiteSettings',
                    entityKind: 'object'
                })
            })
        )
    })

    it('preserves an existing record selection while editing', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)

        render(
            <MarketingWidgetConfigDialog
                open
                widgetKey='marketing.hero'
                initialConfig={{
                    instanceKey: 'hero-instance',
                    source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object', recordKey: 'homepage' }
                }}
                sourceOptions={[{ value: 'MarketingPageSiteSettings', label: 'Site settings', entityKind: 'object' }]}
                title='Hero settings'
                t={translate}
                onSave={onSave}
                onCancel={() => undefined}
            />
        )

        expect(screen.getByTestId('marketing-widget-record-selection')).toHaveTextContent(
            'The published source manages the selected record.'
        )
        await user.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                instanceKey: 'hero-instance',
                source: expect.objectContaining({ recordKey: 'homepage' })
            })
        )
    })

    it('keeps a stable source identity while displaying its localized label', async () => {
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
