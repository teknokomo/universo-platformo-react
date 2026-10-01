import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getLayoutWidgetDefinition, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import {
    apiMocks,
    confirmMocks,
    createMarketingLayout,
    initializeApplicationLayouts,
    localeMocks,
    marketingResetLocaleCases,
    prepareMarketingLayout,
    renderPage,
    resetApplicationLayoutsMocks,
    snackbarMocks
} from './ApplicationLayouts.test-support'

describe('ApplicationLayouts marketing', () => {
    beforeAll(initializeApplicationLayouts, 30_000)
    beforeEach(resetApplicationLayoutsMocks)

    it('keeps source-managed Add and Duplicate actions disabled across every required Marketing registry variant', () => {
        const expectedSourceManagedKeys = new Set([
            'marketing.brand',
            'marketing.navigation',
            'marketing.hero',
            'marketing.image',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        const sourceManagedVariants = LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => {
            if (!definition.supportedTemplates.includes('marketing-page')) return []
            const variants = definition.bindingVariants ? Object.keys(definition.bindingVariants) : [undefined]

            return variants.flatMap((variant) => {
                const resolvedDefinition = getLayoutWidgetDefinition(definition.key, variant ? { variant } : {})
                if (!(resolvedDefinition?.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)) return []

                expect(expectedSourceManagedKeys.has(definition.key)).toBe(true)
                expect(resolvedDefinition?.authoring?.application).toMatchObject({
                    presentationOnly: true,
                    canAdd: false,
                    canDuplicate: false
                })
                return [{ widgetKey: definition.key, variant }]
            })
        })

        expect(sourceManagedVariants).toHaveLength(11)
        expect(new Set(sourceManagedVariants.map(({ widgetKey }) => widgetKey))).toEqual(expectedSourceManagedKeys)
    })

    it('keeps Add and Duplicate disabled for every required Entity-backed Marketing widget variant', () => {
        const expectedSourceManagedKeys = new Set([
            'marketing.brand',
            'marketing.navigation',
            'marketing.hero',
            'marketing.image',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        const sourceManagedVariants = LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => {
            if (!definition.supportedTemplates.includes('marketing-page')) return []
            const variants = definition.bindingVariants ? Object.keys(definition.bindingVariants) : [undefined]

            return variants.flatMap((variant) => {
                const rendererConfig = { ...(variant ? { variant } : {}) }
                const resolvedDefinition = getLayoutWidgetDefinition(definition.key, rendererConfig)
                const hasRequiredSourceBinding = (resolvedDefinition?.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)
                if (!hasRequiredSourceBinding) return []

                expect(expectedSourceManagedKeys.has(definition.key)).toBe(true)
                expect(resolvedDefinition?.authoring?.application).toMatchObject({
                    presentationOnly: true,
                    canAdd: false,
                    canDuplicate: false
                })
                return [{ widgetKey: definition.key, variant }]
            })
        })

        expect(sourceManagedVariants).toHaveLength(11)
        expect(new Set(sourceManagedVariants.map(({ widgetKey }) => widgetKey))).toEqual(expectedSourceManagedKeys)
    })

    it.each([
        ['en', 'This section is used by a Hero action. Change that action or keep the section active.'],
        ['ru', 'Этот раздел используется в действии первого экрана. Измените действие или оставьте раздел включённым.']
    ])('localizes the explanation when hiding a section would break a Hero action (%s)', async (language, message) => {
        const user = userEvent.setup()
        localeMocks.language = language as 'en' | 'ru'
        apiMocks.toggleApplicationLayoutWidget.mockRejectedValue({
            isAxiosError: true,
            response: {
                status: 409,
                data: { code: 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT' }
            }
        })

        renderPage()

        const deactivateButton = await screen.findByRole('button', { name: 'Deactivate widget: Menu: Training' })
        await user.click(deactivateButton)

        const conflictMessage = await screen.findByText(message)
        expect(conflictMessage.closest('[role="alert"]')).not.toBeNull()
        expect(snackbarMocks.enqueueSnackbar).not.toHaveBeenCalledWith(message, { variant: 'error' })
        expect(screen.getByRole('button', { name: 'Deactivate widget: Menu: Training' })).toBeInTheDocument()
        expect(snackbarMocks.enqueueSnackbar.mock.calls.flat().join(' ')).not.toContain('APPLICATION_LAYOUT_MARKETING_HERO_ACTION')
    })

    it('shows the persistent localized conflict alert when the API client exposes the conflict code as its message', async () => {
        const user = userEvent.setup()
        localeMocks.language = 'ru'
        apiMocks.toggleApplicationLayoutWidget.mockRejectedValue({
            isAxiosError: true,
            response: {
                status: 409,
                data: { message: 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT' }
            }
        })

        renderPage()

        await user.click(await screen.findByRole('button', { name: 'Deactivate widget: Menu: Training' }))

        const conflictMessage = await screen.findByText(
            'Этот раздел используется в действии первого экрана. Измените действие или оставьте раздел включённым.'
        )
        expect(conflictMessage.closest('[role="alert"]')).not.toBeNull()
    })

    it.each([
        ['en', 'Customized in application', 'Inherited from metahub'],
        ['ru', 'Настроено в приложении', 'Унаследовано из метахаба']
    ] as const)('labels explicit widget ownership in %s', async (language, applicationLabel, inheritedLabel) => {
        localeMocks.language = language
        const marketingLayout = {
            ...createMarketingLayout(),
            sourceKind: 'metahub',
            sourceLayoutId: 'source-layout-1',
            syncState: 'clean'
        }
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({
            item: marketingLayout,
            widgets: [
                {
                    id: 'widget-application-owned',
                    layoutId: 'layout-1',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    sortOrder: 0,
                    config: {},
                    sourceConfig: { source: 'metahub', headline: 'edited' },
                    sourceWidgetId: 'source-widget-1',
                    sourceBaseWidgetId: 'source-widget-1',
                    isCustomized: true,
                    isActive: true,
                    version: 1
                },
                {
                    id: 'widget-inherited',
                    layoutId: 'layout-1',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    sortOrder: 1,
                    config: {},
                    sourceConfig: { source: 'metahub' },
                    sourceWidgetId: 'source-widget-1',
                    sourceBaseWidgetId: 'source-widget-1',
                    isCustomized: false,
                    isActive: true,
                    version: 1
                }
            ]
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Marketing content')).toBeInTheDocument())
        expect(screen.getByText(applicationLabel)).toBeInTheDocument()
        expect(screen.getByText(inheritedLabel)).toBeInTheDocument()
        expect(screen.queryByText('source-widget-1')).not.toBeInTheDocument()
    })

    it('labels shared switcher rows inherited from a metahub layout', async () => {
        const metahubLayout = {
            id: 'layout-1',
            scopeId: 'global',
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'marketing-page',
            name: { en: 'Marketing' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'metahub',
            sourceLayoutId: 'source-layout-1',
            sourceSnapshotHash: null,
            sourceContentHash: null,
            localContentHash: null,
            syncState: 'clean',
            isSourceExcluded: false,
            version: 1
        }
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [metahubLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({
            item: metahubLayout,
            widgets: [
                {
                    id: 'widget-language-switcher',
                    layoutId: 'layout-1',
                    zone: 'marketing-header',
                    widgetKey: 'languageSwitcher',
                    sortOrder: 0,
                    config: {},
                    sourceConfig: null,
                    sourceWidgetId: null,
                    sourceBaseWidgetId: null,
                    isCustomized: false,
                    isActive: true,
                    version: 1
                }
            ]
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Marketing')).toBeInTheDocument())
        expect(screen.getByText('Inherited from metahub')).toBeInTheDocument()
    })

    it('uses the shared zone settings dialog for a marketing header and saves its descriptor value', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout()
        apiMocks.listApplicationLayouts.mockResolvedValueOnce({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValueOnce({ item: marketingLayout, widgets: [] })
        apiMocks.updateApplicationLayoutZoneSetting.mockResolvedValueOnce(marketingLayout)

        renderPage()

        await waitFor(() => expect(screen.getByTestId('layout-zone-settings-marketing-header')).toBeInTheDocument())
        await user.click(screen.getByTestId('layout-zone-settings-marketing-header'))

        const dialog = screen.getByRole('dialog', { name: 'Settings: Marketing header' })
        expect(within(dialog).getByText('Inherited from the current layout source')).toBeInTheDocument()
        await user.click(within(dialog).getByRole('radio', { name: 'Scrolls with page' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(apiMocks.updateApplicationLayoutZoneSetting).toHaveBeenCalledWith('app-1', 'layout-1', 'marketing-header', 'position', {
                value: 'flow',
                expectedVersion: 7
            })
        })
    })

    it('keeps the zone settings dialog open and localizes a legacy conflict error payload', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout()
        apiMocks.listApplicationLayouts.mockResolvedValueOnce({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValueOnce({ item: marketingLayout, widgets: [] })
        apiMocks.updateApplicationLayoutZoneSetting.mockRejectedValueOnce({
            isAxiosError: true,
            response: {
                status: 409,
                data: { error: 'APPLICATION_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' }
            }
        })

        renderPage()

        await waitFor(() => expect(screen.getByTestId('layout-zone-settings-marketing-header')).toBeInTheDocument())
        await user.click(screen.getByTestId('layout-zone-settings-marketing-header'))

        const dialog = screen.getByRole('dialog', { name: 'Settings: Marketing header' })
        await user.click(within(dialog).getByRole('radio', { name: 'Scrolls with page' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith('This layout changed in another session. Reload it and try again.', {
                variant: 'error'
            })
        })
        expect(dialog).toBeInTheDocument()
        expect(within(dialog).getByText('This layout changed in another session. Reload it and try again.')).toBeInTheDocument()
    })

    it('confirms and resets marketing appearance to template defaults with the layout version', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout()
        apiMocks.listApplicationLayouts.mockResolvedValue({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValue({ item: marketingLayout, widgets: [] })
        apiMocks.updateApplicationLayout.mockResolvedValue(marketingLayout)
        apiMocks.resetApplicationLayoutConfig.mockResolvedValueOnce({
            ...marketingLayout,
            config: {
                themeMode: 'system',
                allowEmailActions: true,
                allowTelephoneActions: true,
                externalLinkTarget: 'new-tab'
            },
            version: 8
        })

        renderPage()

        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        const resetButton = screen.getByRole('button', { name: 'Restore template defaults' })
        expect(resetButton).toBeEnabled()
        await user.click(resetButton)

        await waitFor(() => {
            expect(confirmMocks.confirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Restore marketing page defaults?',
                    confirmButtonName: 'Restore defaults'
                })
            )
            expect(apiMocks.resetApplicationLayoutConfig).toHaveBeenCalledWith('app-1', 'layout-1', { expectedVersion: 7 })
        })
    })

    it('does not reset marketing appearance when the confirmation is cancelled', async () => {
        const user = userEvent.setup()
        const marketingLayout = createMarketingLayout({
            themeMode: 'system'
        })
        confirmMocks.confirm.mockResolvedValueOnce(false)
        apiMocks.listApplicationLayouts.mockResolvedValueOnce({
            items: [marketingLayout],
            pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
        })
        apiMocks.getApplicationLayout.mockResolvedValueOnce({ item: marketingLayout, widgets: [] })

        renderPage()
        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        await user.click(screen.getByRole('button', { name: 'Restore template defaults' }))

        await waitFor(() => expect(confirmMocks.confirm).toHaveBeenCalled())
        expect(apiMocks.resetApplicationLayoutConfig).not.toHaveBeenCalled()
    })

    it('uses registry capabilities to hide Add and Duplicate for source-managed Marketing widgets', async () => {
        const user = userEvent.setup()
        prepareMarketingLayout([
            {
                id: 'widget-marketing-hero',
                layoutId: 'layout-1',
                zone: 'marketing-main',
                widgetKey: 'marketing.hero',
                instanceKey: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                sortOrder: 0,
                config: { instanceKey: '018f8a78-7b8f-7c1d-a111-2222333344a2', showLeadForm: true },
                sourceConfig: { instanceKey: '018f8a78-7b8f-7c1d-a111-2222333344a2', showLeadForm: true },
                sourceWidgetId: 'source-widget-hero',
                isCustomized: false,
                isActive: true,
                version: 2
            },
            {
                id: 'widget-marketing-collection',
                layoutId: 'layout-1',
                zone: 'marketing-main',
                widgetKey: 'marketing.collection',
                sortOrder: 1,
                config: { instanceKey: 'collection-one', variant: 'features' },
                sourceConfig: { instanceKey: 'collection-one', variant: 'features' },
                sourceWidgetId: 'source-widget-collection',
                isCustomized: false,
                isActive: true,
                version: 3
            },
            {
                id: 'widget-marketing-brand',
                layoutId: 'layout-1',
                zone: 'marketing-header',
                widgetKey: 'marketing.brand',
                sortOrder: 0,
                config: { instanceKey: 'brand' },
                sourceConfig: { instanceKey: 'brand' },
                sourceWidgetId: 'source-widget-brand',
                isCustomized: false,
                isActive: true,
                version: 1
            },
            {
                id: 'widget-marketing-image',
                layoutId: 'layout-1',
                zone: 'marketing-main',
                widgetKey: 'marketing.image',
                sortOrder: 2,
                config: { instanceKey: 'hero-image' },
                sourceConfig: { instanceKey: 'hero-image' },
                sourceWidgetId: 'source-widget-image',
                isCustomized: false,
                isActive: true,
                version: 1
            },
            {
                id: 'widget-marketing-language',
                layoutId: 'layout-1',
                zone: 'marketing-header',
                widgetKey: 'languageSwitcher',
                sortOrder: 0,
                config: {},
                isActive: true,
                version: 1
            }
        ])
        expect(getLayoutWidgetDefinition('marketing.hero')?.authoring?.application).toMatchObject({ canAdd: false, canDuplicate: false })
        expect(getLayoutWidgetDefinition('marketing.collection')?.authoring?.application).toMatchObject({
            canAdd: false,
            canDuplicate: false
        })
        apiMocks.upsertApplicationLayoutWidget.mockResolvedValue({})
        apiMocks.updateApplicationLayoutWidgetConfig.mockResolvedValueOnce({})

        renderPage()

        await waitFor(() => expect(screen.getByTestId('application-marketing-appearance-panel')).toBeInTheDocument())
        expect(screen.getByText('Marketing header')).toBeInTheDocument()
        expect(screen.getByText('Marketing content')).toBeInTheDocument()
        expect(screen.getByText('Marketing footer')).toBeInTheDocument()
        expect(screen.getByText('Hero')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'add-Hero', exact: true })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'add-Collection', exact: true })).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-duplicate-widget-marketing-hero')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layout-widget-duplicate-widget-marketing-collection')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit widget: Brand', exact: true })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit widget: Image', exact: true })).not.toBeInTheDocument()
        expect(screen.getByTestId('layout-widget-duplicate-widget-marketing-language')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'add-Language switcher' }))
        await waitFor(() => {
            expect(apiMocks.upsertApplicationLayoutWidget).toHaveBeenCalledWith('app-1', 'layout-1', {
                zone: 'marketing-header',
                widgetKey: 'languageSwitcher',
                expectedVersion: 7,
                config: {}
            })
        })

        await user.click(screen.getByRole('button', { name: 'Hero' }))
        expect(screen.getByTestId('marketing-widget-config-dialog-mock')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'save-marketing-widget' }))

        await waitFor(() => {
            expect(apiMocks.updateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
                'app-1',
                'layout-1',
                'widget-marketing-hero',
                expect.objectContaining({
                    expectedVersion: 2,
                    config: expect.objectContaining({
                        instanceKey: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                        showLeadForm: false
                    })
                })
            )
        })
    })

    it.each(marketingResetLocaleCases)(
        'resets an inherited customized Marketing widget with localized pending and success states in $language',
        async (labels) => {
            localeMocks.language = labels.language
            const user = userEvent.setup()
            prepareMarketingLayout([
                {
                    id: 'widget-marketing-collection',
                    layoutId: 'layout-1',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    sortOrder: 0,
                    config: { instanceKey: 'collection-one', variant: 'features' },
                    sourceConfig: { instanceKey: 'collection-one', variant: 'logos' },
                    sourceWidgetId: 'source-widget-collection',
                    sourceBaseWidgetId: 'source-widget-collection',
                    isCustomized: true,
                    isActive: true,
                    version: 4
                },
                {
                    id: 'widget-marketing-inherited',
                    layoutId: 'layout-1',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    sortOrder: 1,
                    config: { instanceKey: 'hero-one', showLeadForm: true },
                    sourceConfig: { instanceKey: 'hero-one', showLeadForm: true },
                    sourceWidgetId: 'source-widget-hero',
                    isCustomized: false,
                    isActive: true,
                    version: 2
                },
                {
                    id: 'widget-marketing-missing-baseline',
                    layoutId: 'layout-1',
                    zone: 'marketing-main',
                    widgetKey: 'marketing.image',
                    sortOrder: 2,
                    config: { instanceKey: 'image-one' },
                    sourceConfig: null,
                    isCustomized: true,
                    isActive: true,
                    version: 2
                }
            ])
            let finishReset!: (value: unknown[]) => void
            apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finishReset = resolve
                    })
            )

            renderPage()

            const resetButton = await screen.findByTestId('layout-widget-reset-widget-marketing-collection')
            expect(resetButton).toHaveAttribute('aria-label', labels.namedLabel)
            expect(screen.queryByTestId('layout-widget-reset-widget-marketing-inherited')).not.toBeInTheDocument()
            expect(screen.queryByTestId('layout-widget-reset-widget-marketing-missing-baseline')).not.toBeInTheDocument()

            await user.click(resetButton)
            expect(await screen.findByText(labels.pending)).toBeInTheDocument()
            expect(screen.queryByTestId('layout-widget-reset-widget-marketing-collection')).not.toBeInTheDocument()
            expect(apiMocks.resetApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith('app-1', {
                updates: [{ layoutId: 'layout-1', widgetId: 'widget-marketing-collection', expectedVersion: 4 }]
            })

            await act(async () => finishReset([]))
            await waitFor(() => {
                expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(labels.success, { variant: 'success' })
            })
        }
    )

    it.each(marketingResetLocaleCases)('reports localized source reset errors in $language', async (labels) => {
        localeMocks.language = labels.language
        const user = userEvent.setup()
        prepareMarketingLayout([
            {
                id: 'widget-marketing-collection',
                layoutId: 'layout-1',
                zone: 'marketing-main',
                widgetKey: 'marketing.collection',
                sortOrder: 0,
                config: { instanceKey: 'collection-one', variant: 'features' },
                sourceConfig: { instanceKey: 'collection-one', variant: 'logos' },
                sourceWidgetId: 'source-widget-collection',
                isCustomized: true,
                isActive: true,
                version: 4
            }
        ])
        apiMocks.resetApplicationLayoutWidgetConfigsBatch
            .mockRejectedValueOnce({ isAxiosError: true, response: { status: 500, data: { error: 'INTERNAL_SERVER_ERROR' } } })
            .mockRejectedValueOnce({
                isAxiosError: true,
                response: { status: 409, data: { error: 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT' } }
            })

        renderPage()

        await user.click(await screen.findByTestId('layout-widget-reset-widget-marketing-collection'))
        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(labels.error, { variant: 'error' })
        })
        expect(await screen.findByTestId('layout-widget-reset-widget-marketing-collection')).toBeInTheDocument()

        await user.click(screen.getByTestId('layout-widget-reset-widget-marketing-collection'))
        await waitFor(() => {
            expect(snackbarMocks.enqueueSnackbar).toHaveBeenCalledWith(labels.conflict, { variant: 'error' })
        })
    })
})
