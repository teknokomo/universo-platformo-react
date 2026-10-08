import type { DashboardFixtureRecord, DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'

export const assertBuilderSavedReportsSlot = (
    context: DashboardFixtureValidationContext,
    label: string,
    children: DashboardFixtureRecord[]
): void => {
    const { readWidgetConfig, errors } = context
    const reports = children.filter((widget) => widget?.widgetKey === 'detailsTable')
    const reportCodenames = new Set(
        reports
            .map((widget) => readWidgetConfig(widget.config))
            .filter((config) => config.variant === 'report' && !Object.prototype.hasOwnProperty.call(config, 'reportDefinition'))
            .map((config) => config.reportCodename)
            .filter((value): value is string => typeof value === 'string')
    )
    for (const reportCodename of ['LearningContentSummary', 'LearnerProgress']) {
        if (!reportCodenames.has(reportCodename)) {
            errors.push(label + ' reports slot must reference saved report ' + reportCodename + ' by reportCodename only')
        }
    }
}

export const assertLmsReportsLayout = (context: DashboardFixtureValidationContext): void => {
    const { reportsLayout, widgets, readWidgetConfig, errors } = context
    const reportsSummaryWidget =
        reportsLayout &&
        widgets.find((widget) => {
            if (widget?.layoutId !== reportsLayout.id || widget?.widgetKey !== 'detailsTable') return false
            const config = readWidgetConfig(widget?.config)
            return config.reportCodename === 'LearningContentSummary' && !Object.prototype.hasOwnProperty.call(config, 'reportDefinition')
        })
    if (!reportsSummaryWidget) {
        errors.push('Reports layout must expose LearningContentSummary through the generic detailsTable reportCodename surface')
    }
}
