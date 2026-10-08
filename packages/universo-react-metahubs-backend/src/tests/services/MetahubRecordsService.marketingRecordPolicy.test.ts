import {
    buildSingleTargetWidgetBinding,
    ComponentDefinitionDataType,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_SAFE_HREF_PATTERN_SOURCE,
    validateWidgetBindings
} from '@universo-react/types'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { MetahubValidationError } from '../../domains/shared/domainErrors'
import { createMockDbExecutor } from '../utils/dbMocks'
import { createService, metahubId, objectCollectionId, recordId, schemaName } from './MetahubRecordsService.testSupport'

describe('MetahubRecordsService exact component and Marketing record policies', () => {
    it('uses a parameterized exact component-value predicate when resolving records', async () => {
        const { executor, service } = createService()
        const row = {
            id: recordId,
            object_id: objectCollectionId,
            data: { HeroKey: 'hero-home' },
            sort_order: 1,
            _upl_version: 1
        }
        const calls: Array<{ sql: string; params: unknown[] }> = []
        ;(executor.query as jest.Mock).mockImplementation(async (sql: string, params: unknown[]) => {
            calls.push({ sql: String(sql), params })
            return String(sql).includes('COUNT(*)') ? [{ total: '1' }] : [row]
        })

        const result = await service.findAllAndCount(
            metahubId,
            objectCollectionId,
            { limit: 2, offset: 0, exactComponentCodename: 'HeroKey', exactValue: 'hero-home' },
            'user-1'
        )

        expect(result).toMatchObject({ total: 1, items: [{ id: recordId, data: { HeroKey: 'hero-home' } }] })
        const select = calls.find(({ sql }) => sql.startsWith('SELECT * FROM'))
        const count = calls.find(({ sql }) => sql.includes('COUNT(*)'))
        expect(select?.sql).toContain('data ->> $2::text = $3::text')
        expect(select?.params).toEqual([objectCollectionId, 'HeroKey', 'hero-home', 2])
        expect(count?.sql).toContain('data ->> $2::text = $3::text')
        expect(count?.params).toEqual([objectCollectionId, 'HeroKey', 'hero-home'])
    })

    it.each([
        {
            codename: 'Resource',
            format: 'marketingMediaReference',
            dataType: ComponentDefinitionDataType.JSON,
            value: { type: 'url', url: 'javascript:alert(1)' }
        },
        {
            codename: 'PrimaryAction',
            format: 'marketingAction',
            dataType: ComponentDefinitionDataType.JSON,
            value: { kind: 'internal', path: 'javascript:alert(1)' }
        },
        {
            codename: 'Href',
            format: 'marketingHref',
            pattern: MARKETING_SAFE_HREF_PATTERN_SOURCE,
            dataType: ComponentDefinitionDataType.STRING,
            value: 'https://user:pass@example.test'
        }
    ])('rejects invalid $format values before persistence', async ({ codename, format, dataType, pattern, value }) => {
        const { executor, service } = createService({
            components: [
                {
                    id: `${codename.toLowerCase()}-component`,
                    codename,
                    dataType,
                    isRequired: true,
                    parentComponentId: null,
                    validationRules: { format, ...(pattern === undefined ? {} : { pattern }) }
                }
            ]
        })

        await expect(service.create(metahubId, objectCollectionId, { data: { [codename]: value } }, 'user-1')).rejects.toBeInstanceOf(
            MetahubValidationError
        )
        expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })

    it('rejects a Hero record update that breaks an action target in its bound layout', async () => {
        const policy = {
            version: 1,
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
        }
        const localized = (en: string, ru: string) => ({
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: en, isActive: true },
                ru: { content: ru, isActive: true }
            }
        })
        const existingData = {
            HeroKey: 'hero-default',
            Title: localized('Welcome', 'Добро пожаловать'),
            Description: localized('Product overview', 'Обзор продукта'),
            EmailLabel: localized('Email', 'Электронная почта'),
            EmailPlaceholder: localized('you@example.com', 'you@example.com'),
            PrimaryActionLabel: localized('Explore', 'Изучить'),
            PrimaryAction: { kind: 'anchor', href: '#pricing' }
        }
        const heroComponents = [
            {
                id: 'hero-key',
                codename: 'HeroKey',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                parentComponentId: null
            },
            {
                id: 'hero-title',
                codename: 'Title',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-description',
                codename: 'Description',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-email-label',
                codename: 'EmailLabel',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-email-placeholder',
                codename: 'EmailPlaceholder',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-action-label',
                codename: 'PrimaryActionLabel',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-action',
                codename: 'PrimaryAction',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: true,
                parentComponentId: null
            },
            {
                id: 'hero-terms-text',
                codename: 'TermsText',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: false,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-terms-link-label',
                codename: 'TermsLinkLabel',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: false,
                validationRules: { localized: true },
                parentComponentId: null
            },
            {
                id: 'hero-terms-action',
                codename: 'TermsAction',
                dataType: ComponentDefinitionDataType.JSON,
                isRequired: false,
                validationRules: { format: 'marketingAction' },
                parentComponentId: null
            }
        ]
        const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
        if (!heroDefinition) throw new Error('Marketing Hero widget is not registered')
        const heroBinding = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
            entityKind: 'object',
            entityCodename: 'MarketingPageHero',
            semanticKey: 'hero-default'
        })
        const heroConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: {}, neutral: { bindings: heroBinding } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const pricingDefinition = getLayoutWidgetDefinition('marketing.pricing')
        if (!pricingDefinition) throw new Error('Marketing pricing widget is not registered')
        const pricingBindings = validateWidgetBindings(pricingDefinition, {
            version: 1,
            slots: (pricingDefinition.bindingSlots ?? []).map((slot) => {
                const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
                const selectorKind = slot.selectorKinds[0]
                const selector =
                    selectorKind === 'semantic-key'
                        ? { kind: selectorKind, field: semanticComponent?.field ?? 'key', value: 'pricing' }
                        : selectorKind === 'relation-set'
                        ? { kind: selectorKind, parentSlot: slot.relation?.parentSlot ?? 'tiers' }
                        : { kind: selectorKind }
                return {
                    slot: slot.key,
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename:
                                slot.key === 'section'
                                    ? 'MarketingPageSection'
                                    : slot.key === 'tiers'
                                    ? 'MarketingPagePricing'
                                    : 'MarketingPagePricingBenefit',
                            selector,
                            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                        }
                    ]
                }
            })
        })
        const pricingConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { showBenefits: true }, neutral: { bindings: pricingBindings } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.pricing', zone: 'marketing-main' }
        )
        const layoutId = '018f8a78-7b8f-7c1d-a111-222233334570'
        const heroWidgetId = '018f8a78-7b8f-7c1d-a111-222233334571'
        const pricingWidgetId = '018f8a78-7b8f-7c1d-a111-222233334572'
        const existing = {
            id: recordId,
            object_id: objectCollectionId,
            data: existingData,
            sort_order: 1,
            _upl_version: 3
        }
        const executor = createMockDbExecutor()
        const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
        const objectsService = {
            findById: jest.fn().mockResolvedValue({ id: objectCollectionId, config: { recordPolicy: policy } })
        }
        const componentsService = {
            findAllFlat: jest.fn().mockResolvedValue(heroComponents),
            getAllComponents: jest.fn().mockResolvedValue([])
        }
        const service = new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)
        ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('"_mhb_objects"') && sql.includes('FOR UPDATE')) {
                return [{ id: objectCollectionId, kind: 'object', codename: 'MarketingPageHero', config: { recordPolicy: policy } }]
            }
            if (sql.includes('"_mhb_elements"')) return [existing]
            if (sql.includes('"_mhb_layouts"')) return [{ id: layoutId, scope_entity_id: null, base_layout_id: null }]
            if (sql.includes('"_mhb_widgets"')) {
                return [
                    {
                        id: heroWidgetId,
                        layout_id: layoutId,
                        widget_key: 'marketing.hero',
                        zone: 'marketing-main',
                        config: heroConfig,
                        sort_order: 1,
                        is_active: true
                    },
                    {
                        id: pricingWidgetId,
                        layout_id: layoutId,
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: pricingConfig,
                        sort_order: 2,
                        is_active: true
                    }
                ]
            }
            return []
        })

        await expect(
            service.update(
                metahubId,
                objectCollectionId,
                recordId,
                { data: { PrimaryAction: { kind: 'anchor', href: '#inactive-section' } }, expectedVersion: 3 },
                'user-1'
            )
        ).rejects.toThrow('Hero action targets an inactive section in this layout')

        const calls = (executor.query as jest.Mock).mock.calls as Array<[string, unknown[]?]>
        const versionLockIndex = calls.findIndex(([sql]) => String(sql).includes('"_mhb_elements"') && String(sql).includes('FOR UPDATE'))
        const heroLayoutReadIndex = calls.findIndex(([sql]) => String(sql).includes('"_mhb_layouts"'))
        expect(versionLockIndex).toBeGreaterThanOrEqual(0)
        expect(heroLayoutReadIndex).toBeGreaterThan(versionLockIndex)
        expect(calls.some(([sql]) => String(sql).trimStart().startsWith('UPDATE'))).toBe(false)
    })
})
