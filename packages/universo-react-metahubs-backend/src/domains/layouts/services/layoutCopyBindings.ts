import { decodeWidgetConfigEnvelope, type ApplicationTemplateKey } from '@universo-react/types'
import { MetahubDomainError } from '../../shared/domainErrors'

type LayoutCopyWidgetRow = {
    id?: string
    zone?: string
    widget_key?: string
    config?: unknown
    is_active?: boolean
}

type LayoutCopyOverrideRow = {
    base_widget_id?: string
    zone?: string | null
    sort_order?: number | null
    config?: unknown
    is_active?: boolean | null
    is_deleted_override?: boolean
}

type PreparedLayoutCopyWidget<TWidget extends LayoutCopyWidgetRow> = {
    widget: TWidget
    config: unknown
    isActive: boolean
}

type HeroBindingCopyMode = 'reuse' | 'omit'

interface ResolveLayoutCopyBindingsInput<TWidget extends LayoutCopyWidgetRow, TBase extends LayoutCopyWidgetRow & { id: string }> {
    templateKey: ApplicationTemplateKey
    preparedWidgets: readonly PreparedLayoutCopyWidget<TWidget>[]
    baseWidgets: readonly TBase[]
    sourceOverrides: readonly LayoutCopyOverrideRow[]
    copyMode: HeroBindingCopyMode | undefined
}

/** Classify direct and inherited Entity bindings before the copy transaction writes any rows. */
export const resolveLayoutCopyBindings = <TWidget extends LayoutCopyWidgetRow, TBase extends LayoutCopyWidgetRow & { id: string }>({
    templateKey,
    preparedWidgets,
    baseWidgets,
    sourceOverrides,
    copyMode
}: ResolveLayoutCopyBindingsInput<TWidget, TBase>) => {
    const sourceOverrideByWidgetId = new Map(
        sourceOverrides
            .filter((row) => typeof row.base_widget_id === 'string' && row.base_widget_id.length > 0)
            .map((row) => [row.base_widget_id as string, row])
    )
    const boundHeroWidgets = new Set(
        preparedWidgets.filter(({ widget, config }) => {
            if (widget.widget_key !== 'marketing.hero') return false
            const envelope = decodeWidgetConfigEnvelope(config, {
                templateKey,
                widgetKey: 'marketing.hero',
                zone: String(widget.zone),
                requireBindings: true
            })
            return envelope.neutral.bindings !== undefined
        })
    )
    const boundInheritedHeroWidgets = new Set(
        baseWidgets
            .filter((widget) => {
                if (widget.widget_key !== 'marketing.hero') return false
                const sourceOverride = sourceOverrideByWidgetId.get(widget.id)
                if (sourceOverride?.is_deleted_override === true) return false
                const config = sourceOverride?.config ?? widget.config
                try {
                    return (
                        decodeWidgetConfigEnvelope(config ?? {}, {
                            templateKey,
                            widgetKey: 'marketing.hero',
                            zone: String(sourceOverride?.zone ?? widget.zone),
                            requireBindings: true
                        }).neutral.bindings !== undefined
                    )
                } catch {
                    throw new MetahubDomainError({
                        message: 'Layout widget configuration is invalid',
                        statusCode: 409,
                        code: 'VALIDATION_ERROR',
                        details: { operation: 'copy-layout' }
                    })
                }
            })
            .map((widget) => widget.id)
    )

    if (boundHeroWidgets.size + boundInheritedHeroWidgets.size > 0 && copyMode === undefined) {
        throw new MetahubDomainError({
            message: 'Choose how to copy bound Hero placements',
            statusCode: 409,
            code: 'MARKETING_HERO_COPY_MODE_REQUIRED',
            details: { operation: 'copy-layout' }
        })
    }

    return {
        sourceOverrideByWidgetId,
        boundHeroWidgets,
        boundInheritedHeroWidgets,
        preparedWidgets: copyMode === 'omit' ? preparedWidgets.filter((item) => !boundHeroWidgets.has(item)) : [...preparedWidgets]
    }
}
