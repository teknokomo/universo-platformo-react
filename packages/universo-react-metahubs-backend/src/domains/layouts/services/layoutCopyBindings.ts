import { decodeWidgetConfigEnvelope, getLayoutWidgetDefinition, type ApplicationTemplateKey } from '@universo-react/types'
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

type EntityBindingCopyMode = 'reuse' | 'omit'

interface ResolveLayoutCopyBindingsInput<TWidget extends LayoutCopyWidgetRow, TBase extends LayoutCopyWidgetRow & { id: string }> {
    templateKey: ApplicationTemplateKey
    preparedWidgets: readonly PreparedLayoutCopyWidget<TWidget>[]
    baseWidgets: readonly TBase[]
    sourceOverrides: readonly LayoutCopyOverrideRow[]
    copyOverrides: boolean
    copyMode: EntityBindingCopyMode | undefined
    isMarketingOverlay?: boolean
}

/** Classify direct and inherited Entity bindings before the copy transaction writes any rows. */
export const resolveLayoutCopyBindings = <TWidget extends LayoutCopyWidgetRow, TBase extends LayoutCopyWidgetRow & { id: string }>({
    templateKey,
    preparedWidgets,
    baseWidgets,
    sourceOverrides,
    copyOverrides,
    copyMode,
    isMarketingOverlay = false
}: ResolveLayoutCopyBindingsInput<TWidget, TBase>) => {
    const baseWidgetIds = new Set(baseWidgets.map(({ id }) => id))
    const sourceOverrideByWidgetId = new Map<string, LayoutCopyOverrideRow>()
    for (const override of copyOverrides ? sourceOverrides : []) {
        const baseWidgetId = override.base_widget_id
        if (
            typeof baseWidgetId !== 'string' ||
            baseWidgetId.length === 0 ||
            !baseWidgetIds.has(baseWidgetId) ||
            sourceOverrideByWidgetId.has(baseWidgetId)
        ) {
            throw new MetahubDomainError({
                message: 'Layout widget override ownership is invalid',
                statusCode: 409,
                code: 'CONFLICT',
                details: { operation: 'copy-layout' }
            })
        }
        sourceOverrideByWidgetId.set(baseWidgetId, override)
    }
    const hasBindings = (widget: LayoutCopyWidgetRow, config: unknown): boolean => {
        if (typeof widget.widget_key !== 'string' || typeof widget.zone !== 'string') return false
        const definition = getLayoutWidgetDefinition(widget.widget_key, config)
        if (!definition?.bindingSlots?.length) return false
        const requiresBindings = definition.bindingSlots.some(({ cardinality }) => cardinality.min > 0)
        const envelope = decodeWidgetConfigEnvelope(config ?? {}, {
            templateKey,
            widgetKey: widget.widget_key,
            zone: widget.zone,
            requireBindings: requiresBindings
        })
        return envelope.neutral.bindings !== undefined
    }
    const assertMarketingOverrideIsSparse = (widget: LayoutCopyWidgetRow, config: unknown): void => {
        if (templateKey !== 'marketing-page' || typeof widget.widget_key !== 'string' || typeof widget.zone !== 'string') return
        const envelope = decodeWidgetConfigEnvelope(config ?? {}, {
            templateKey,
            widgetKey: widget.widget_key,
            zone: widget.zone,
            requireBindings: false
        })
        if (envelope.neutral.bindings !== undefined) {
            throw new MetahubDomainError({
                message: 'Marketing overlay widget overrides cannot contain Entity bindings',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: { operation: 'copy-layout' }
            })
        }
    }
    const boundWidgets = new Set(
        preparedWidgets.filter(({ widget, config }) => {
            return hasBindings(widget, config)
        })
    )
    const boundInheritedWidgets = new Set(
        baseWidgets
            .filter((widget) => {
                const sourceOverride = copyOverrides ? sourceOverrideByWidgetId.get(widget.id) : undefined
                if (sourceOverride?.is_deleted_override === true) return false
                try {
                    if (templateKey === 'marketing-page' && sourceOverride?.config !== null && sourceOverride?.config !== undefined) {
                        assertMarketingOverrideIsSparse(
                            { ...widget, zone: String(sourceOverride.zone ?? widget.zone) },
                            sourceOverride.config
                        )
                    }
                    const inheritedConfig = templateKey === 'marketing-page' ? widget.config : sourceOverride?.config ?? widget.config
                    return hasBindings({ ...widget, zone: widget.zone }, inheritedConfig)
                } catch (error) {
                    if (error instanceof MetahubDomainError) throw error
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

    // Reuse preserves semantic selectors inside the same metahub and owner.
    // Omit drops direct placements and tombstones bound base placements. When
    // overrides are not copied, classify against the base state that the copy
    // will actually inherit, not the source overlay's effective state.
    if (boundWidgets.size + boundInheritedWidgets.size > 0 && copyMode === undefined) {
        throw new MetahubDomainError({
            message: 'Choose how to copy Entity-bound placements',
            statusCode: 409,
            code: 'ENTITY_BINDING_COPY_MODE_REQUIRED',
            details: { operation: 'copy-layout' }
        })
    }
    if (isMarketingOverlay && copyMode === 'reuse' && boundWidgets.size > 0) {
        throw new MetahubDomainError({
            message: 'Marketing overlay copies cannot reuse Entity bindings from owned widget rows',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: { operation: 'copy-layout' }
        })
    }

    return {
        sourceOverrideByWidgetId,
        boundWidgets,
        boundInheritedWidgets,
        preparedWidgets: copyMode === 'omit' ? preparedWidgets.filter((item) => !boundWidgets.has(item)) : [...preparedWidgets]
    }
}
