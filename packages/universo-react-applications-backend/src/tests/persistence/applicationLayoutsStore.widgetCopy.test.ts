import { copyApplicationLayout, deleteApplicationLayoutWidget } from '../../persistence/applicationLayoutsStore'
import {
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    parseApplicationLayoutWidgetConfig,
    validateWidgetBindings
} from '@universo-react/types'
import { createMockDbExecutor } from '../utils/dbMocks'
import { independentLayoutConfig, primeLockedLayout } from './applicationLayoutsStore.test-utils'

const registryBindings = (definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>) =>
    validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot, index) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: `fixture-${index}` }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'content' }
                    : selectorKind === 'learner-enrollment-set'
                    ? { kind: selectorKind, targetKind: 'course' as const }
                    : { kind: 'record-set' as const }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object' as const,
                        entityCodename: `FixtureEntity${index}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })

describe('applicationLayoutsStore layout copy and overlay behavior', () => {
    it('copies a source layout with a structural widget and a fresh UUID v7 instance key', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutRow = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            scope_entity_id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
            template_key: 'dashboard',
            name: { en: 'Dashboard' },
            description: null,
            config: {
                __layout: {
                    composition: { mode: 'overlay', baseLayoutId: '018f8a78-7b8f-7c1d-a111-2222333344a3' }
                }
            },
            is_active: true,
            is_default: true,
            sort_order: 0,
            source_kind: 'metahub',
            source_layout_id: '018f8a78-7b8f-7c1d-a111-2222333344a3',
            source_snapshot_hash: 'a'.repeat(64),
            source_content_hash: null,
            local_content_hash: 'hash-local',
            sync_state: 'clean',
            is_source_excluded: false,
            source_deleted_at: null,
            source_deleted_by: null,
            version: 1
        }
        const widgetRow = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a4',
            layout_id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            zone: 'top',
            widget_key: 'divider',
            instance_key: 'divider',
            parent_widget_id: null,
            slot_key: null,
            sort_order: 0,
            config: encodeLayoutWidgetConfigEnvelope(
                { rendererConfig: { orientation: 'vertical' } },
                { templateKey: 'dashboard', widgetKey: 'divider', zone: 'top' }
            ),
            source_config: null,
            source_widget_id: '018f8a78-7b8f-7c1d-a111-2222333344a5',
            source_base_widget_id: '018f8a78-7b8f-7c1d-a111-2222333344a5',
            is_customized: false,
            is_active: true,
            version: 1
        }
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: layoutRow.scope_entity_id }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([layoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([widgetRow])
            .mockResolvedValueOnce([{ kind: 'page', codename: 'MarketingLanding' }])
            .mockResolvedValueOnce([
                {
                    template_key: 'dashboard',
                    scope_entity_id: null,
                    local_content_hash: 'b'.repeat(64),
                    source_content_hash: null
                }
            ])
            .mockResolvedValueOnce([{ ...layoutRow, id: '0190a9b5-3cde-7abc-8def-2123456789de', is_default: false, version: 1 }])
            .mockResolvedValueOnce([{ id: '0190a9b5-3cde-7abc-8def-2123456789de' }])
            .mockResolvedValueOnce([{ id: '0190a9b5-3cde-7abc-8def-2123456789df' }])

        const copied = await copyApplicationLayout(
            executor,
            'app_018f8a787b8f7c1da111222233334444',
            '018f8a78-7b8f-7c1d-a111-2222333344a1',
            { expectedVersion: 1 },
            'user-1'
        )

        expect(copied).toEqual(
            expect.objectContaining({
                id: '0190a9b5-3cde-7abc-8def-2123456789de',
                isDefault: false,
                compositionMode: 'independent',
                baseLayoutId: null
            })
        )
        const copiedConfigUpdate = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('SET config = $2::jsonb') && String(sql).includes('_app_layouts')
        )
        expect(JSON.parse(String(copiedConfigUpdate?.[1]?.[1]))).toMatchObject({
            __layout: { composition: { mode: 'independent', baseLayoutId: null } }
        })
        const insertWidgetCall = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_app_widgets')
        )
        const lockedLayoutIndex = txExecutor.query.mock.calls.findIndex(
            ([sql]) => String(sql).includes('_app_layouts') && String(sql).includes('FOR UPDATE')
        )
        const lockedWidgetsIndex = txExecutor.query.mock.calls.findIndex(
            ([sql]) => String(sql).includes('_app_widgets') && String(sql).includes('FOR UPDATE')
        )
        const copiedLayoutIndex = txExecutor.query.mock.calls.findIndex(
            ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_app_layouts')
        )
        expect(lockedLayoutIndex).toBeGreaterThanOrEqual(0)
        expect(lockedWidgetsIndex).toBeGreaterThan(lockedLayoutIndex)
        expect(copiedLayoutIndex).toBeGreaterThan(lockedWidgetsIndex)
        expect(insertWidgetCall?.[1]?.[3]).toEqual(
            expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        )
        const insertedConfig = decodeLayoutWidgetConfigEnvelope(JSON.parse(String(insertWidgetCall?.[1]?.[5])), {
            templateKey: 'dashboard',
            widgetKey: 'divider',
            zone: 'top'
        })
        expect(insertedConfig.rendererConfig.orientation).toBe('vertical')
        expect(insertedConfig.rendererConfig).not.toHaveProperty('instanceKey')
        expect(insertedConfig.neutral.bindings).toBeUndefined()
    })

    it('preserves an explicit overlay after deleting its last inherited widget', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344b1'
        const baseLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344b2'
        const inheritedWidgetId = '018f8a78-7b8f-7c1d-a111-2222333344b3'
        const layoutRow = primeLockedLayout(txExecutor, {
            layoutId,
            scopeEntityId: '018f8a78-7b8f-7c1d-a111-2222333344b4',
            templateKey: 'dashboard',
            config: { __layout: { composition: { mode: 'overlay', baseLayoutId } } },
            widgets: [
                {
                    id: inheritedWidgetId,
                    layout_id: layoutId,
                    zone: 'top',
                    widget_key: 'languageSwitcher',
                    sort_order: 1,
                    config: {},
                    source_config: {},
                    source_widget_id: baseLayoutId,
                    source_base_widget_id: baseLayoutId,
                    is_customized: false,
                    is_active: true,
                    version: 1
                }
            ]
        })
        const updatedLayoutRow = { ...layoutRow, version: 2 }
        txExecutor.query
            .mockResolvedValueOnce([{ id: inheritedWidgetId, layout_id: layoutId }])
            .mockResolvedValueOnce([updatedLayoutRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ kind: 'page', codename: 'ScopedDashboard' }])
            .mockResolvedValueOnce([
                {
                    template_key: 'dashboard',
                    scope_entity_id: null,
                    local_content_hash: 'a'.repeat(64),
                    source_content_hash: null
                }
            ])
            .mockResolvedValueOnce([{ id: layoutId }])

        await expect(
            deleteApplicationLayoutWidget(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, inheritedWidgetId, 'user-1', 1)
        ).resolves.toBe(true)

        const refreshedConfigCall = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes('SET config = $2::jsonb') && String(sql).includes('_app_layouts')
        )
        expect(JSON.parse(String(refreshedConfigCall?.[1]?.[1]))).toMatchObject({
            __layout: { composition: { mode: 'overlay', baseLayoutId } }
        })
    })

    it('rejects copying every source-owned Marketing widget variant before writing rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d8'
        let entityBackedWidgetsCount = 0
        const entityBackedWidgets = LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => {
            if (!definition.supportedTemplates.includes('marketing-page')) return []

            const zone = definition.allowedZonesByTemplate['marketing-page']?.[0]
            if (!zone) return []

            const variants = definition.bindingVariants ? Object.keys(definition.bindingVariants) : [undefined]
            return variants.flatMap((variant) => {
                const widgetKey = definition.key
                const rendererConfig = parseApplicationLayoutWidgetConfig(widgetKey, {
                    ...(variant ? { variant } : {})
                })
                const resolvedDefinition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
                const isEntityBackedSourceWidget =
                    resolvedDefinition?.authoring?.application.presentationOnly === true &&
                    (resolvedDefinition.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)
                if (!isEntityBackedSourceWidget) return []

                const widgetId = `0190a9b5-3cde-7abc-8def-${(0x2123456789e0 + entityBackedWidgetsCount).toString(16)}`
                entityBackedWidgetsCount += 1
                const storedConfig = encodeLayoutWidgetConfigEnvelope(
                    { rendererConfig, neutral: { bindings: registryBindings(resolvedDefinition) } },
                    { templateKey: 'marketing-page', widgetKey, zone, requireBindings: false }
                )
                return [
                    {
                        id: widgetId,
                        layout_id: layoutId,
                        zone,
                        widget_key: widgetKey,
                        instance_key: `copy-${widgetKey}-${variant ?? 'default'}`,
                        parent_widget_id: null,
                        slot_key: null,
                        sort_order: entityBackedWidgetsCount,
                        config: storedConfig,
                        source_config: storedConfig,
                        source_widget_id: widgetId,
                        source_base_widget_id: null,
                        is_customized: false,
                        is_active: true,
                        version: 1
                    }
                ]
            })
        })
        expect(entityBackedWidgets).toHaveLength(11)
        primeLockedLayout(txExecutor, {
            layoutId,
            templateKey: 'marketing-page',
            widgets: entityBackedWidgets,
            includeStructureLock: false
        })

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, { expectedVersion: 1 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(String(sql)))).toBe(false)
    })

    it('rejects copying a source-managed layout containing only a host widget before writing rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const layoutId = '0190a9b5-3cde-7abc-8def-2123456789d7'
        const widgetId = '0190a9b5-3cde-7abc-8def-2123456789d6'
        const hostWidgetConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: {} },
            { templateKey: 'dashboard', widgetKey: 'workspaceSwitcher', zone: 'left' }
        )
        primeLockedLayout(txExecutor, {
            layoutId,
            templateKey: 'dashboard',
            sourceKind: 'metahub',
            includeStructureLock: false,
            widgets: [
                {
                    id: widgetId,
                    layout_id: layoutId,
                    zone: 'left',
                    widget_key: 'workspaceSwitcher',
                    instance_key: 'workspace-switcher',
                    sort_order: 0,
                    config: hostWidgetConfig,
                    source_config: hostWidgetConfig,
                    source_widget_id: widgetId,
                    source_base_widget_id: widgetId,
                    is_active: true,
                    version: 1
                }
            ]
        })

        await expect(
            copyApplicationLayout(executor, 'app_018f8a787b8f7c1da111222233334444', layoutId, { expectedVersion: 1 }, 'user-1')
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')
        expect(txExecutor.query.mock.calls.some(([sql]) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(String(sql)))).toBe(false)
    })

    it('rejects a stale marketing layout copy before creating any rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ scope_entity_id: null }]) // safe scope lookup
            .mockResolvedValueOnce([]) // global mutation lock
            .mockResolvedValueOnce([]) // scope advisory lock
            .mockResolvedValueOnce([]) // layout advisory lock
            .mockResolvedValueOnce([
                {
                    id: '0190a9b5-3cde-7abc-8def-2123456789d8',
                    scope_entity_id: null,
                    template_key: 'marketing-page',
                    name: { en: 'Marketing' },
                    description: null,
                    config: independentLayoutConfig,
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
                    version: 9
                }
            ])
            .mockResolvedValueOnce([]) // widgets advisory lock
            .mockResolvedValueOnce([]) // locked widgets

        await expect(
            copyApplicationLayout(
                executor,
                'app_018f8a787b8f7c1da111222233334444',
                '0190a9b5-3cde-7abc-8def-2123456789d8',
                { expectedVersion: 8 },
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_VERSION_CONFLICT')
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })
})
