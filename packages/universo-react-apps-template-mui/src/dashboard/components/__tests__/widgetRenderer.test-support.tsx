import { act, render } from '@testing-library/react'
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

export const renderRuntimeWidget = (widget: ZoneWidgetItem, details: Partial<DashboardDetailsSlot> = {}) =>
    render(
        <DashboardDetailsProvider value={{ title: 'Runtime', locale: 'en', ...details }}>{renderWidget(widget)}</DashboardDetailsProvider>
    )

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
