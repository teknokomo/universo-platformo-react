import { createMockDbExecutor } from '../utils/dbMocks'
import { encodeLayoutWidgetConfigEnvelope, getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'

export const encodeBoundCollectionConfig = (instanceKey: string, variant: 'logos' | 'features') => {
    const widgetKey = 'marketing.collection'
    const rendererConfig = { instanceKey, variant }
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error('Expected marketing.collection widget definition')

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: variant }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'items' }
                    : { kind: 'record-set' as const }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename:
                            slot.key === 'section' ? 'MarketingPageSection' : `MarketingPage${variant === 'logos' ? 'Logo' : 'Feature'}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

    return encodeLayoutWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main' }
    )
}

export const scopedBatchLayoutIdA = '018f8a78-7b8f-7c1d-a111-2222333345a1'

export const scopedBatchLayoutIdB = '018f8a78-7b8f-7c1d-a111-2222333345a2'

export const independentLayoutConfig = { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }

export const primeLockedLayout = (
    txExecutor: ReturnType<typeof createMockDbExecutor>['txExecutor'],
    options: {
        layoutId: string
        scopeEntityId?: string | null
        templateKey: 'dashboard' | 'marketing-page'
        version?: number
        config?: Record<string, unknown>
        widgets?: Array<Record<string, unknown>>
        includeStructureLock?: boolean
    }
) => {
    const layoutId = options.layoutId
    const scopeEntityId = options.scopeEntityId ?? null
    const layoutRow = {
        id: layoutId,
        scope_entity_id: scopeEntityId,
        template_key: options.templateKey,
        name: { en: 'Test layout' },
        description: null,
        config: options.config ?? independentLayoutConfig,
        is_active: true,
        is_default: true,
        sort_order: 0,
        source_kind: 'application',
        source_layout_id: null,
        source_snapshot_hash: null,
        source_content_hash: null,
        local_content_hash: 'hash-local',
        sync_state: 'clean',
        is_source_excluded: false,
        source_deleted_at: null,
        source_deleted_by: null,
        version: options.version ?? 1
    }

    if (options.includeStructureLock !== false) txExecutor.query.mockResolvedValueOnce([])
    txExecutor.query
        .mockResolvedValueOnce([{ scope_entity_id: scopeEntityId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([layoutRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce((options.widgets ?? []).map((widget) => ({ is_customized: false, ...widget })))

    return layoutRow
}
