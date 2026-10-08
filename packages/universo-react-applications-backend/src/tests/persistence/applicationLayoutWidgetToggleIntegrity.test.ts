import {
    buildSingleTargetWidgetBinding,
    encodeLayoutConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings
} from '@universo-react/types'
import { toggleApplicationLayoutWidget } from '../../persistence/applicationLayoutsStore'
import { mapWidget } from '../../persistence/applicationLayoutStoreSupport'
import { APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT } from '../../persistence/applicationLayoutMarketingActionIntegrity'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334444'
const layoutId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
const widgetId = '018f8a78-7b8f-7c1d-a111-2222333344a2'
const pricingDuplicateId = '018f8a78-7b8f-7c1d-a111-2222333344a3'
const primaryHeroId = '018f8a78-7b8f-7c1d-a111-2222333344a4'
const inheritedHeroId = '018f8a78-7b8f-7c1d-a111-2222333344a5'
const inheritedHeroBaseId = '018f8a78-7b8f-7c1d-a111-2222333344a6'

const boundMarketingWidgetConfig = (
    widgetKey: 'marketing.collection' | 'marketing.pricing',
    rendererConfig: Record<string, unknown>,
    entityCodenames: Record<string, string>,
    semanticKeys: Record<string, string>
) => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error(`Expected ${widgetKey} widget definition`)

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: (definition.bindingSlots ?? []).map((slot) => {
            const selectorKind = slot.selectorKinds[0]
            const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
            const selector =
                selectorKind === 'semantic-key'
                    ? {
                          kind: selectorKind,
                          field: semanticComponent?.field ?? 'key',
                          value: semanticKeys[slot.key] ?? 'default'
                      }
                    : selectorKind === 'relation-set'
                    ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'tiers' }
                    : selectorKind === 'learner-enrollment-set'
                    ? { kind: selectorKind, targetKind: 'course' as const }
                    : { kind: 'record-set' as const }
            const entityCodename = entityCodenames[slot.key]
            if (!entityCodename) throw new Error(`Expected ${widgetKey}/${slot.key} binding entity`)

            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename,
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

const sourceStateFor = (widgetKey: string, config: unknown, sortOrder: number, instanceKey: string) =>
    createApplicationLayoutWidgetSourceState('marketing-page', widgetKey, {
        zone: 'marketing-main',
        sortOrder,
        isActive: true,
        config,
        instanceKey,
        parentWidgetId: null,
        slotKey: null
    })

const layoutRow = {
    id: layoutId,
    scope_entity_id: null,
    template_key: 'marketing-page',
    name: { en: 'Marketing' },
    description: null,
    config: encodeLayoutConfigEnvelope(
        { rendererConfig: {}, neutral: { composition: { mode: 'independent', baseLayoutId: null } } },
        {
            templateKey: 'marketing-page'
        }
    ),
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
    version: 4
}

const pricingWidget = (id: string, instanceKey = 'pricing') => {
    const sourceConfig = boundMarketingWidgetConfig(
        'marketing.pricing',
        {},
        {
            section: 'MarketingPageSection',
            tiers: 'MarketingPagePricing',
            benefits: 'MarketingPagePricingBenefit'
        },
        { section: 'pricing' }
    )
    return {
        id,
        layout_id: layoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.pricing',
        instance_key: instanceKey,
        parent_widget_id: null,
        slot_key: null,
        sort_order: 1,
        config: sourceConfig,
        source_config: sourceConfig,
        source_state: sourceStateFor('marketing.pricing', sourceConfig, 1, instanceKey),
        source_widget_id: null,
        source_base_widget_id: null,
        is_customized: false,
        is_active: true,
        version: 1
    }
}

const featuresWidgetId = '018f8a78-7b8f-7c1d-a111-2222333344a7'
const featuresWidget = (() => {
    const sourceConfig = boundMarketingWidgetConfig(
        'marketing.collection',
        { variant: 'features' },
        { section: 'MarketingPageSection', items: 'MarketingPageFeature' },
        { section: 'features' }
    )
    return {
        id: featuresWidgetId,
        layout_id: layoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.collection',
        instance_key: 'features',
        parent_widget_id: null,
        slot_key: null,
        sort_order: 2,
        config: sourceConfig,
        source_config: sourceConfig,
        source_state: sourceStateFor('marketing.collection', sourceConfig, 2, 'features'),
        source_widget_id: null,
        source_base_widget_id: null,
        is_customized: false,
        is_active: true,
        version: 1
    }
})()

const customFeaturesWidget = (id: string, instanceKey: string, sortOrder: number) => {
    const sourceConfig = boundMarketingWidgetConfig(
        'marketing.collection',
        { variant: 'features' },
        { section: 'MarketingPageSection', items: 'MarketingPageFeature' },
        { section: 'features' }
    )
    return {
        ...featuresWidget,
        id,
        instance_key: instanceKey,
        sort_order: sortOrder,
        config: sourceConfig,
        source_config: sourceConfig,
        source_state: sourceStateFor('marketing.collection', sourceConfig, sortOrder, instanceKey),
        source_widget_id: null
    }
}

const heroWidget = (id: string, semanticKey: string, inherited = false) => {
    const definition = getLayoutWidgetDefinition('marketing.hero')
    if (!definition) throw new Error('Expected marketing.hero widget definition')
    const instanceKey = semanticKey
    const rendererConfig = { showLeadForm: true }
    const sourceConfig = encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig,
            neutral: {
                bindings: buildSingleTargetWidgetBinding(definition, 'content', {
                    entityKind: 'object',
                    entityCodename: 'MarketingPageHero',
                    semanticKey
                })
            }
        },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )
    const baselineConfig =
        inherited === true
            ? encodeLayoutWidgetConfigEnvelope(
                  { rendererConfig },
                  { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
              )
            : sourceConfig
    return {
        id,
        layout_id: layoutId,
        zone: 'marketing-main',
        widget_key: 'marketing.hero',
        instance_key: instanceKey,
        parent_widget_id: null,
        slot_key: null,
        sort_order: inherited ? 4 : 3,
        config: baselineConfig,
        source_config: baselineConfig,
        source_state: sourceStateFor('marketing.hero', baselineConfig, inherited ? 4 : 3, instanceKey),
        source_widget_id: inherited ? inheritedHeroBaseId : null,
        source_base_widget_id: inherited ? inheritedHeroBaseId : null,
        is_customized: false,
        is_active: true,
        version: 1
    }
}

const createScenario = (initialWidgets: Array<Record<string, unknown>>, heroRows: Array<Record<string, unknown>>) => {
    const { executor, txExecutor } = createMockDbExecutor()
    let currentWidgets = initialWidgets
    const heroObjectId = '018f8a78-7b8f-7c1d-a111-2222333344a8'
    txExecutor.query.mockImplementation(async (query: unknown, parameters: unknown[] = []) => {
        const sql = String(query)
        if (sql.includes('SELECT scope_entity_id') && sql.includes('_app_layouts')) {
            return [{ scope_entity_id: null }]
        }
        if (sql.includes('_app_layouts') && sql.includes('FOR UPDATE')) return [layoutRow]
        if (sql.includes('_app_widgets') && sql.includes('FOR UPDATE')) return currentWidgets
        if (sql.includes('_app_objects')) {
            return [
                {
                    id: heroObjectId,
                    codename: 'MarketingPageHero',
                    kind: 'object',
                    tableName: 'marketing_page_hero',
                    config: {
                        recordPolicy: {
                            version: 1,
                            runtimeMutation: 'deny',
                            denyDeleteWhenBound: true,
                            immutableSemanticKeyWhenBound: true,
                            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                            requiredLocales: ['en', 'ru'],
                            coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                        }
                    }
                }
            ]
        }
        if (sql.includes('_app_components')) {
            return getLayoutWidgetDefinition('marketing.hero')!.bindingSlots![0]!.requirements.components.map((component) => ({
                codename: component.componentCodename,
                columnName:
                    ({ HeroKey: 'hero_key', PrimaryAction: 'primary_action', TermsAction: 'terms_action' } as Record<string, string>)[
                        component.componentCodename
                    ] ?? `unused_${component.componentCodename}`,
                dataType: component.valueType === 'json' ? 'jsonb' : 'text',
                is_required: component.required,
                validation_rules: {
                    ...(component.localized ? { localized: true } : {}),
                    ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                    ...(component.semanticKey ? { unique: true } : {}),
                    ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
                    ...(component.format ? { format: component.format } : {})
                }
            }))
        }
        if (sql.includes('marketing_page_hero')) {
            const selectedKeys = Array.isArray(parameters[0]) ? parameters[0] : []
            return heroRows.filter((row) => selectedKeys.includes(row.hero_key))
        }
        if (sql.includes('_app_widgets') && sql.includes('SET is_active = $2')) {
            const updated = currentWidgets.find((row) => row.id === parameters[0])
            if (!updated) return []
            currentWidgets = currentWidgets.map((row) =>
                row.id === parameters[0] ? { ...row, is_active: parameters[1], version: Number(row.version) + 1 } : row
            )
            return [{ ...updated, is_active: parameters[1], version: Number(updated.version) + 1 }]
        }
        if (sql.includes('_app_layouts') && sql.includes('SET config = $2::jsonb')) return [{ id: layoutId }]
        if (sql.includes('_app_layouts')) return [layoutRow]
        if (sql.includes('_app_widgets')) return currentWidgets
        return []
    })
    return { executor, txExecutor }
}

describe('application-bound Marketing widget test fixtures', () => {
    it('maps direct and sparse inherited source baselines with their trusted binding ownership', () => {
        const rows = [
            pricingWidget(widgetId),
            featuresWidget,
            heroWidget(primaryHeroId, 'hero-primary'),
            heroWidget(inheritedHeroId, 'hero-inherited', true)
        ]

        for (const row of rows) {
            expect(() => mapWidget(row as never, 'marketing-page')).not.toThrow()
        }
    })
})

const activeHeroRecord = (id: string, heroKey: string, primaryAction: unknown, termsAction: unknown = null) => ({
    id,
    hero_key: heroKey,
    primary_action: primaryAction,
    terms_action: termsAction
})

describe('application layout marketing Hero action integrity on widget toggle', () => {
    it('blocks reactivating a bound Hero while one of its anchor targets remains hidden', async () => {
        const scenario = createScenario(
            [
                { ...featuresWidget, is_active: false },
                { ...heroWidget(primaryHeroId, 'hero-primary'), is_active: false }
            ],
            [activeHeroRecord('018f8a78-7b8f-7c1d-a111-2222333344b5', 'hero-primary', { kind: 'anchor', href: '#features' })]
        )

        await expect(
            toggleApplicationLayoutWidget(
                scenario.executor,
                schemaName,
                layoutId,
                primaryHeroId,
                { expectedVersion: 4, isActive: true },
                'user-1'
            )
        ).rejects.toThrow(APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT)

        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('SET is_active = $2'))).toBe(false)
    })

    it('blocks hiding a section targeted by any active Hero placement', async () => {
        const heroRows = [
            activeHeroRecord('018f8a78-7b8f-7c1d-a111-2222333344b1', 'hero-primary', { kind: 'anchor', href: '#features' }),
            activeHeroRecord(
                '018f8a78-7b8f-7c1d-a111-2222333344b2',
                'hero-inherited',
                { kind: 'internal', path: '/start' },
                { kind: 'anchor', href: '#pricing' }
            )
        ]
        const scenario = createScenario(
            [
                pricingWidget(widgetId),
                featuresWidget,
                heroWidget(primaryHeroId, 'hero-primary'),
                heroWidget(inheritedHeroId, 'hero-inherited')
            ],
            heroRows
        )

        await expect(
            toggleApplicationLayoutWidget(
                scenario.executor,
                schemaName,
                layoutId,
                widgetId,
                { expectedVersion: 4, isActive: false },
                'user-1'
            )
        ).rejects.toThrow(APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT)

        const heroReads = scenario.txExecutor.query.mock.calls.filter(([query]) => String(query).includes('marketing_page_hero'))
        expect(heroReads).toHaveLength(2)
        for (const [query] of heroReads) {
            expect(String(query)).toContain('= ANY($1::text[])')
            expect(String(query)).toContain('LIMIT $2')
            expect(String(query)).toContain('FOR SHARE')
        }
        expect(heroReads.map(([, params]) => params)).toEqual([
            [['hero-primary'], 1001],
            [['hero-inherited'], 1001]
        ])
        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('SET is_active = $2'))).toBe(false)
    })

    it('allows hiding a section when every bound Hero action still resolves in the effective layout', async () => {
        const scenario = createScenario(
            [pricingWidget(widgetId), featuresWidget, heroWidget(primaryHeroId, 'hero-primary')],
            [activeHeroRecord('018f8a78-7b8f-7c1d-a111-2222333344b3', 'hero-primary', { kind: 'anchor', href: '#features' })]
        )

        await expect(
            toggleApplicationLayoutWidget(
                scenario.executor,
                schemaName,
                layoutId,
                widgetId,
                { expectedVersion: 4, isActive: false },
                'user-1'
            )
        ).resolves.toMatchObject({ id: widgetId, isActive: false })

        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('c.is_required, c.validation_rules'))).toBe(
            true
        )
        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('SET is_active = $2'))).toBe(true)
    })

    it('allows hiding one of duplicate section targets while another active placement keeps the same anchor', async () => {
        const scenario = createScenario(
            [pricingWidget(widgetId), pricingWidget(pricingDuplicateId, 'pricing-secondary'), heroWidget(primaryHeroId, 'hero-primary')],
            []
        )

        await expect(
            toggleApplicationLayoutWidget(
                scenario.executor,
                schemaName,
                layoutId,
                widgetId,
                { expectedVersion: 4, isActive: false },
                'user-1'
            )
        ).resolves.toMatchObject({ id: widgetId, isActive: false })

        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('_app_objects'))).toBe(false)
        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('SET is_active = $2'))).toBe(true)
    })

    it('keeps semantic anchor aliases valid when another matching section placement remains', async () => {
        const scenario = createScenario(
            [
                customFeaturesWidget(widgetId, 'features-enterprise', 1),
                customFeaturesWidget(pricingDuplicateId, 'features-campus', 2),
                heroWidget(primaryHeroId, 'hero-primary')
            ],
            [activeHeroRecord('018f8a78-7b8f-7c1d-a111-2222333344b4', 'hero-primary', { kind: 'anchor', href: '#features' })]
        )

        await expect(
            toggleApplicationLayoutWidget(
                scenario.executor,
                schemaName,
                layoutId,
                widgetId,
                { expectedVersion: 4, isActive: false },
                'user-1'
            )
        ).resolves.toMatchObject({ id: widgetId, isActive: false })

        expect(scenario.txExecutor.query.mock.calls.some(([query]) => String(query).includes('SET is_active = $2'))).toBe(true)
    })
})
