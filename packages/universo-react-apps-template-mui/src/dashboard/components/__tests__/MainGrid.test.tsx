import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MainGrid from '../MainGrid'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import type { RuntimePlacement } from '../../runtime/widgetPlacementGraph'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string | { defaultValue?: string; progress?: number }) =>
            typeof fallback === 'string'
                ? fallback
                : fallback.defaultValue?.replace('{{progress}}', String(fallback.progress ?? '')) ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('../widgetRenderer', () => ({
    renderWidget: (widget: RuntimePlacement, options?: { placements?: readonly RuntimePlacement[] }) => (
        <div data-testid={`root-${widget.instanceKey}`} data-graph-size={options?.placements?.length ?? 0} />
    )
}))

const root: RuntimePlacement = {
    id: '018f0000-0000-7000-8000-000000000001',
    instanceKey: 'overview-columns',
    widgetKey: 'columnsContainer',
    zone: 'center',
    sortOrder: 0,
    config: { columns: [{ slotKey: 'column:primary', width: 12 }] },
    isActive: true,
    parentInstanceKey: null,
    slotKey: null
}

const child: RuntimePlacement = {
    id: '018f0000-0000-7000-8000-000000000002',
    instanceKey: 'courses-table',
    widgetKey: 'detailsTable',
    zone: 'center',
    sortOrder: 0,
    config: {},
    isActive: true,
    parentInstanceKey: 'overview-columns',
    slotKey: 'column:primary'
}

describe('Dashboard MainGrid placement composition', () => {
    it('renders only effective root placements and passes the complete semantic graph to their renderer', () => {
        render(
            <DashboardDetailsProvider value={{ title: 'Dashboard' }}>
                <MainGrid placements={[root, child]} />
            </DashboardDetailsProvider>
        )
        expect(screen.getByTestId('root-overview-columns')).toHaveAttribute('data-graph-size', '2')
        expect(screen.queryByTestId('root-courses-table')).not.toBeInTheDocument()
    })

    it('keeps nested children out of the root composition even when only flat placements are supplied', () => {
        render(
            <DashboardDetailsProvider value={{ title: 'Dashboard' }}>
                <MainGrid placements={[root, child]} />
            </DashboardDetailsProvider>
        )
        expect(screen.getByTestId('root-overview-columns')).toBeInTheDocument()
        expect(screen.queryByTestId('root-courses-table')).not.toBeInTheDocument()
    })

    it('shows a localized empty state when no root or host content exists', () => {
        render(
            <DashboardDetailsProvider value={{ title: 'Dashboard' }}>
                <MainGrid placements={[]} />
            </DashboardDetailsProvider>
        )
        expect(screen.getByRole('status')).toHaveTextContent('No dashboard content is available yet.')
    })

    it('preserves explicit host content used by standalone workspace routes', () => {
        render(
            <DashboardDetailsProvider value={{ title: 'Workspace', content: <div>Workspace page body</div> }}>
                <MainGrid placements={[]} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-host-content')).toHaveTextContent('Workspace page body')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('renders structured Page content without replacing persisted dashboard placements', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    title: 'Interpretation Network',
                    pageBlocks: [
                        { id: 'intro-title', type: 'header', data: { text: 'Interpretation Network', level: 2 } },
                        { id: 'intro-body', type: 'paragraph', data: { text: 'Build a network of interpretations.' } }
                    ]
                }}
            >
                <MainGrid placements={[root]} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-host-content')).toHaveTextContent('Interpretation Network')
        expect(screen.getByTestId('dashboard-host-content')).toHaveTextContent('Build a network of interpretations.')
        expect(screen.getByTestId('root-overview-columns')).toBeInTheDocument()
    })

    it('preserves the configured page progress player for host page blocks', async () => {
        const onProgressChange = vi.fn()
        render(
            <DashboardDetailsProvider
                value={{
                    title: 'Learning page',
                    pageBlocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Read this lesson.' } }],
                    pagePlayer: {
                        showProgressHeader: true,
                        completeButtonMode: 'manual',
                        onProgressChange
                    }
                }}
            >
                <MainGrid placements={[]} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('runtime-page-progress')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))

        await waitFor(() => expect(onProgressChange).toHaveBeenCalledWith({ action: 'complete' }))
    })
})
