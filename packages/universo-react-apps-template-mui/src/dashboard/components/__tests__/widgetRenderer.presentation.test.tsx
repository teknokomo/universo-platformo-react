import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from '@universo-react/i18n'

vi.mock('../StatCard', async () => {
    const { MockStatCard } = await import('./widgetRenderer.test-mocks')
    return { default: MockStatCard }
})

vi.mock('../SessionsChart', async () => {
    const { MockSessionsChart } = await import('./widgetRenderer.test-mocks')
    return { default: MockSessionsChart }
})

vi.mock('../PageViewsBarChart', async () => {
    const { MockPageViewsBarChart } = await import('./widgetRenderer.test-mocks')
    return { default: MockPageViewsBarChart }
})

vi.mock('../../../components/resource-preview', async () => {
    const { MockResourcePreview } = await import('./widgetRenderer.test-mocks')
    return { ResourcePreview: MockResourcePreview }
})

import { placement, renderRuntimeWidget, resetRuntimeLanguage } from './widgetRenderer.test-support'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

describe('Dashboard runtime widget ownership renderers', () => {
    afterEach(resetRuntimeLanguage)

    it('labels Details Tabs and associates every tab with a panel without mounting inactive widget children', async () => {
        const tabsWidget = placement('detailsTabs', undefined, {
            tabs: [
                { slotKey: 'tab:summary', label: { en: 'Summary', ru: 'Сводка' }, isDefault: true },
                { slotKey: 'tab:activity', label: { en: 'Activity', ru: 'Активность' } }
            ]
        })
        const summaryWidget = {
            ...placement('overviewTitle', { status: 'ready', data: { kind: 'title', text: 'Summary content' } }),
            instanceKey: 'summary-content',
            parentInstanceKey: tabsWidget.instanceKey,
            slotKey: 'tab:summary'
        }
        const activityWidget = {
            ...placement('overviewTitle', { status: 'ready', data: { kind: 'title', text: 'Activity content' } }),
            id: '018f0000-0000-7000-8000-000000000002',
            instanceKey: 'activity-content',
            parentInstanceKey: tabsWidget.instanceKey,
            slotKey: 'tab:activity'
        }

        render(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>
                {renderWidget(tabsWidget, { placements: [tabsWidget, summaryWidget, activityWidget] })}
            </DashboardDetailsProvider>
        )

        const tablist = screen.getByRole('tablist', { name: 'Details sections' })
        const summaryTab = screen.getByRole('tab', { name: 'Summary' })
        const activityTab = screen.getByRole('tab', { name: 'Activity' })
        expect(tablist).toBeInTheDocument()
        expect(summaryTab.id).toBeTruthy()
        expect(activityTab.id).toBeTruthy()
        expect(summaryTab.getAttribute('aria-controls')).not.toBe(activityTab.getAttribute('aria-controls'))

        for (const tab of [summaryTab, activityTab]) {
            const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '')
            expect(panel).not.toBeNull()
            expect(panel).toHaveAttribute('role', 'tabpanel')
            expect(panel).toHaveAttribute('aria-labelledby', tab.id)
        }

        const summaryPanel = document.getElementById(summaryTab.getAttribute('aria-controls') ?? '')
        const activityPanel = document.getElementById(activityTab.getAttribute('aria-controls') ?? '')
        expect(summaryPanel).toBe(screen.getByRole('tabpanel'))
        expect(screen.getByText('Summary content')).toBeInTheDocument()
        expect(screen.queryByText('Activity content')).not.toBeInTheDocument()
        expect(activityPanel).toHaveAttribute('hidden')

        fireEvent.click(activityTab)
        expect(activityTab).toHaveAttribute('aria-selected', 'true')
        expect(summaryTab).toHaveAttribute('aria-selected', 'false')
        expect(screen.getByRole('tabpanel')).toBe(activityPanel)
        expect(screen.getByText('Activity content')).toBeInTheDocument()
        expect(screen.queryByText('Summary content')).not.toBeInTheDocument()
        expect(summaryPanel).toHaveAttribute('hidden')

        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        expect(screen.getByRole('tablist', { name: 'Разделы сведений' })).toBeInTheDocument()
        expect(activityTab).toHaveAttribute('aria-selected', 'true')
    })

    it('shows a localized empty-section status when a details tab has no child placements', async () => {
        const tabsWidget = placement('detailsTabs', undefined, {
            tabs: [{ slotKey: 'tab:overview', label: { en: 'Overview', ru: 'Обзор' }, isDefault: true }]
        })

        renderRuntimeWidget(tabsWidget, { locale: 'en' })
        expect(screen.getByRole('status')).toHaveTextContent('This section is empty.')

        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        expect(screen.getByRole('status')).toHaveTextContent('В этом разделе пока нет содержимого.')
    })

    it('renders Entity-backed info-card content with its declared presentation severity', () => {
        renderRuntimeWidget(
            placement(
                'infoCard',
                { status: 'ready', data: { kind: 'info-card', title: 'Service update', body: 'The service is healthy.' } },
                { severity: 'success' }
            )
        )

        expect(screen.getByText('Service update')).toBeInTheDocument()
        expect(screen.getByText('The service is healthy.')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveClass('MuiAlert-colorSuccess')
    })

    it('applies semantic heading level and alignment from Dashboard presentation config', () => {
        renderRuntimeWidget(
            placement('overviewTitle', { status: 'ready', data: { kind: 'title', text: 'Overview' } }, { level: 'h1', align: 'center' })
        )

        const heading = screen.getByRole('heading', { level: 1, name: 'Overview' })
        expect(heading).toHaveStyle({ textAlign: 'center' })
    })

    it('renders bounded metrics through the existing StatCard and does not invent values', () => {
        const { rerender } = renderRuntimeWidget(
            placement('overviewCards', {
                status: 'ready',
                data: { kind: 'metrics', cards: [{ label: 'Open items', value: '12' }] }
            })
        )
        expect(screen.getByTestId('metric-card')).toHaveTextContent('Open items:12')

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>
                {renderWidget(placement('overviewCards', { status: 'ready', data: { kind: 'metrics', cards: [] } }))}
            </DashboardDetailsProvider>
        )
        expect(screen.queryByText('14k')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('renders real chart series in the existing line and bar chart primitives', () => {
        const series = [{ id: 'visits', label: 'Visits', values: [4, 9] }]
        const { rerender } = renderRuntimeWidget(
            placement('sessionsChart', { status: 'ready', data: { kind: 'series', title: 'Sessions', labels: ['Mon', 'Tue'], series } })
        )
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-series', '4,9')

        rerender(
            <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en' }}>
                {renderWidget(
                    placement('pageViewsChart', {
                        status: 'ready',
                        data: { kind: 'series', title: 'Views', labels: ['Mon', 'Tue'], series }
                    })
                )}
            </DashboardDetailsProvider>
        )
        expect(screen.getByTestId('page-views-chart')).toHaveAttribute('data-series', '4,9')
    })

    it('applies chart style, point limit, and localized interval to Entity-backed series data', async () => {
        await i18n.changeLanguage('ru')
        renderRuntimeWidget(
            placement(
                'sessionsChart',
                {
                    status: 'ready',
                    data: {
                        kind: 'series',
                        title: '',
                        labels: ['2026-09-25T00:00:00.000Z', '2026-09-26T00:00:00.000Z'],
                        series: [{ id: 'learningActivity', label: 'Учебная активность', values: [4, 9] }]
                    }
                },
                { chartStyle: 'bar', interval: 'day', maxPoints: 1 }
            ),
            { locale: 'ru' }
        )

        const chart = screen.getByTestId('page-views-chart')
        expect(chart).toHaveTextContent('Сессии')
        expect(chart).toHaveAttribute('data-series', '9')
        expect(chart).toHaveAttribute('data-interval', 'Дневные точки')
        expect(chart.getAttribute('data-axis')).not.toContain('T00:00:00.000Z')
    })

    it('applies the registered date-picker range and preset presentation config without demo state', () => {
        renderRuntimeWidget(placement('datePicker', undefined, { selection: 'range', showPresets: true }))

        expect(screen.getByTestId('runtime-date-picker-widget')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument()
        expect(screen.queryByText(/2023/)).not.toBeInTheDocument()
    })

    it('renders the Dashboard footer only from allowlisted host metadata and presentation config', () => {
        renderRuntimeWidget(
            placement('footer', undefined, {
                alignment: 'center',
                spacing: 'compact',
                showLegalLinks: true,
                showContact: false
            }),
            {
                footerMetadata: {
                    siteName: 'Universo',
                    legalLinks: [
                        { label: 'Privacy', href: '/privacy' },
                        { label: 'Unsafe', href: 'javascript:alert(1)' }
                    ],
                    contactLinks: [{ label: 'Support', href: 'mailto:support@example.test' }]
                }
            }
        )

        const footer = screen.getByTestId('runtime-footer-widget')
        expect(footer).toHaveTextContent('Universo')
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
        expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Support' })).not.toBeInTheDocument()
        expect(screen.queryByText('Sitemark')).not.toBeInTheDocument()
    })
})
