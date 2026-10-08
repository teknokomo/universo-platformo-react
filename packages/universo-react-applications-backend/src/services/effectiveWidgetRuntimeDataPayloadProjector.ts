import type { loadRuntimeWidgetBindingMetadata } from '../persistence/widgetBindingRuntimeStore'
import { projectManualRuntimeMenu } from './effectiveWidgetRuntimeMenu'
import type { ResolvedWidgetBindingTarget } from './widgetBindingResolver'
import {
    projectMetrics,
    projectRelation,
    projectResource,
    projectSeries,
    projectTable
} from './effectiveWidgetRuntimeDataBindingProjectors'
import { semanticText, type PreparedWidget } from './effectiveWidgetRuntimeDataProjectionShared'
import type { EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'

export const projectPayload = (
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    targets: readonly ResolvedWidgetBindingTarget[],
    locale: string,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    allowRowActions: boolean,
    allowRowReordering: boolean
): unknown | null => {
    if (targets.length === 0 && widget.candidate.widgetKey !== 'detailsTable') return null
    switch (widget.candidate.widgetKey) {
        case 'infoCard': {
            const target = targets.length === 1 ? targets[0] : undefined
            return target
                ? {
                      kind: 'info-card',
                      title: semanticText(target.data.title, locale, 160),
                      body: semanticText(target.data.body, locale, 2000)
                  }
                : null
        }
        case 'overviewTitle':
        case 'detailsTitle': {
            const target = targets.length === 1 ? targets[0] : undefined
            return target ? { kind: 'title', text: semanticText(target.data.title, locale, 160) } : null
        }
        case 'detailsTable':
            return projectTable(scope, widget, targets, locale, metadata, allowRowActions, allowRowReordering)
        case 'sessionsChart':
        case 'pageViewsChart':
            return projectSeries(widget, targets, locale)
        case 'overviewCards':
            return projectMetrics(widget, targets, locale)
        case 'relationBuilder':
            return projectRelation(scope, widget, targets, locale, metadata)
        case 'learnerPlayer':
            return null
        case 'resourcePreview': {
            const target = targets.length === 1 ? targets[0] : undefined
            const source = target ? projectResource(target.data.resource) : null
            if (!target || !source) return null
            return {
                kind: 'resource',
                title: semanticText(widget.candidate.config.titleOverride, locale, 160) || semanticText(target.data.title, locale, 160),
                source
            }
        }
        case 'menuWidget':
            return projectManualRuntimeMenu(targets, locale)
        default:
            return null
    }
}
