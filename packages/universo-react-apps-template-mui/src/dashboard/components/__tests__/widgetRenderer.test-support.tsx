import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import i18n from '@universo-react/i18n'
import type { DashboardWidgetConfig } from '@universo-react/types'
import '../../../i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../../contracts'

export const placement = (
    widgetKey: string,
    runtimeData?: ZoneWidgetItem['runtimeData'],
    config: Record<string, unknown> = {}
): ZoneWidgetItem => ({
    id: '018f0000-0000-7000-8000-000000000001',
    instanceKey: `instance-${widgetKey}`,
    widgetKey,
    zone: 'center',
    sortOrder: 0,
    config,
    isActive: true,
    parentInstanceKey: null,
    slotKey: null,
    runtimeData
})

export const defaultRuntimeLayoutTarget = {
    targetKind: 'object' as const,
    entityTypeId: '018f0000-0000-7000-8000-000000000010'
}

export const renderRuntimeWidget = (widget: ZoneWidgetItem, details: Partial<DashboardDetailsSlot> = {}) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const result = render(
        <QueryClientProvider client={queryClient}>
            <DashboardDetailsProvider
                value={{ title: 'Runtime', locale: 'en', runtimeLayoutTarget: defaultRuntimeLayoutTarget, ...details }}
            >
                {renderWidget(widget)}
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
    return {
        ...result,
        rerender: (ui: ReactNode) => result.rerender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
    }
}

export const createTarget: NonNullable<Extract<DashboardWidgetConfig<'detailsTable'>, { variant?: 'records' }>['createTargets']>[number] = {
    id: 'create-course',
    label: { en: 'Course', ru: 'Курс' },
    objectCollectionCodename: 'Courses',
    surface: 'dialog',
    createDefaults: [{ fieldCodename: 'Title', value: 'New course' }]
}
export const createPermissions: NonNullable<DashboardDetailsSlot['permissions']> = {
    createContent: true,
    editContent: false,
    deleteContent: false,
    manageApplication: false,
    manageMembers: false,
    readReports: false
}
export const createTargetWidget = (target = createTarget) =>
    placement(
        'detailsTable',
        { status: 'ready', data: { kind: 'table', columns: [{ key: 'title', label: 'Title' }], rows: [] } },
        { showSearch: false, showViewToggle: false, createTargets: [target] }
    )

export type { DashboardDetailsSlot, ZoneWidgetItem }

export const resetRuntimeLanguage = async () => {
    await act(async () => {
        await i18n.changeLanguage('en')
    })
}
