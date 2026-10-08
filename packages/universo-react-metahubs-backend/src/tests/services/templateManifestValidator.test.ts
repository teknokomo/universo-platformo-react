import { basicTemplate } from '../../domains/templates/data/basic.template'
import { basicDemoTemplate } from '../../domains/templates/data/basic-demo.template'
import { emptyTemplate } from '../../domains/templates/data/empty.template'
import { objectEntityPreset } from '../../domains/templates/data/object.entity-preset'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { interpretationNetworkTemplate } from '../../domains/templates/data/interpretation-network.template'
import { marketingPageTemplate } from '../../domains/templates/data/marketing-page.template'
import { oneCCompatibleTemplate } from '../../domains/templates/data/one-c-compatible.template'
import { playcanvasTemplate } from '../../domains/templates/data/playcanvas.template'
import {
    oneCCompatibleAllPresets,
    oneCCompatibleCorePresets,
    oneCCompatiblePreviewPresets
} from '../../domains/templates/data/one-c-compatible.entity-presets'
import { enumerationEntityPreset } from '../../domains/templates/data/option-list.entity-preset'
import { pageEntityPreset } from '../../domains/templates/data/page.entity-preset'
import { ledgerEntityPreset } from '../../domains/templates/data/ledger.entity-preset'
import { hubEntityPreset } from '../../domains/templates/data/tree-entity.entity-preset'
import { setEntityPreset } from '../../domains/templates/data/value-group.entity-preset'
import {
    entityRecordPolicySchema,
    getLayoutWidgetDefinition,
    matchesWidgetBindingComponentValidationRules,
    parseApplicationLayoutWidgetConfig,
    workflowActionSchema
} from '@universo-react/types'
import {
    validateEntityTypePresetManifest,
    validateTemplateManifest,
    validateTemplateSeedEntityBehaviorReferences
} from '../../domains/templates/services/TemplateManifestValidator'

const cloneTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const readVlcContent = (value: unknown, locale: 'en' | 'ru'): string | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const locales = (value as { locales?: unknown }).locales
    if (!locales || typeof locales !== 'object' || Array.isArray(locales)) return undefined
    const entry = (locales as Record<string, unknown>)[locale]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
    const content = (entry as { content?: unknown }).content
    return typeof content === 'string' ? content : undefined
}

describe('TemplateManifestValidator', () => {
    it('accepts the built-in basic template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(basicTemplate))).not.toThrow()
    })

    it('accepts the built-in empty template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(emptyTemplate))).not.toThrow()
    })

    it('accepts the built-in lms template', () => {
        expect(() => validateTemplateManifest(cloneTemplate(lmsTemplate))).not.toThrow()
    })

    it('validates every built-in Dashboard template against the strict registry contracts', () => {
        const templates = [
            basicTemplate,
            basicDemoTemplate,
            emptyTemplate,
            oneCCompatibleTemplate,
            lmsTemplate,
            interpretationNetworkTemplate,
            playcanvasTemplate
        ]
        const retiredWidgetKeys = new Set(['brandSelector', 'productTree', 'usersByCountryChart'])

        for (const template of templates) {
            expect(() => validateTemplateManifest(cloneTemplate(template))).not.toThrow()
            const placements = Object.values(template.seed.layoutZoneWidgets).flat()
            const menuPlacements = placements.filter((placement) => placement.widgetKey === 'menuWidget')
            expect(menuPlacements).not.toHaveLength(0)

            for (const placement of placements) {
                expect(retiredWidgetKeys.has(placement.widgetKey)).toBe(false)
                expect('rendererConfig' in placement).toBe(true)
                expect('config' in placement).toBe(false)
                if (!('rendererConfig' in placement)) continue

                expect(placement.rendererConfig).not.toHaveProperty('datasource')
                expect(placement.rendererConfig).not.toHaveProperty('widgets')
                if (placement.widgetKey === 'menuWidget') {
                    expect(placement.rendererConfig).toEqual({
                        variant: expect.stringMatching(/^(generated|manual)$/u)
                    })
                    if (placement.rendererConfig.variant === 'generated') {
                        expect(placement.bindings).toBeUndefined()
                    } else {
                        expect(placement.bindings?.slots).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'items' })]))
                    }
                    for (const target of placement.bindings?.slots.flatMap(({ targets }) => targets) ?? []) {
                        expect(target).not.toHaveProperty('id')
                        expect(target).toHaveProperty('entityCodename')
                    }
                }
                if (placement.widgetKey === 'appNavbar' || placement.widgetKey === 'header') {
                    expect(placement.rendererConfig).toEqual({})
                }
                if (placement.widgetKey === 'infoCard') {
                    expect(Object.keys(placement.rendererConfig).every((key) => key === 'severity')).toBe(true)
                    expect(placement.bindings?.slots).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 'content' })]))
                }
            }
        }
    })

    it('binds Basic Demo information, headings, metrics, charts, and table rows to Object records', () => {
        const manifest = cloneTemplate(basicDemoTemplate)
        const widgets = manifest.seed.layoutZoneWidgets.main ?? []
        const metricEntity = manifest.seed.entities.find((entity) => entity.codename === 'DashboardDemoMetrics')
        const seriesEntity = manifest.seed.entities.find((entity) => entity.codename === 'DashboardDemoSeries')
        const tableEntity = manifest.seed.entities.find((entity) => entity.codename === 'DashboardDemoRecords')
        const contentEntity = manifest.seed.entities.find((entity) => entity.codename === 'DashboardDemoContent')
        const metricWidget = widgets.find((widget) => widget.widgetKey === 'overviewCards')
        const seriesWidget = widgets.find((widget) => widget.widgetKey === 'sessionsChart')
        const container = widgets.find((widget) => widget.widgetKey === 'columnsContainer')
        const table = widgets.find((widget) => widget.widgetKey === 'detailsTable')
        const infoCard = widgets.find((widget) => widget.widgetKey === 'infoCard')
        const headings = widgets.filter((widget) => widget.widgetKey === 'overviewTitle' || widget.widgetKey === 'detailsTitle')

        expect(metricEntity?.kind).toBe('object')
        expect(seriesEntity?.kind).toBe('object')
        expect(tableEntity?.kind).toBe('object')
        expect(contentEntity?.kind).toBe('object')
        expect(contentEntity?.hubs).toEqual(['Main'])
        expect(contentEntity?.config).toMatchObject({
            recordBehavior: 'reference',
            recordPolicy: {
                version: 1,
                semanticKey: {
                    componentCodename: 'Key',
                    creationPrefix: 'dashboard-content',
                    protectedValues: ['welcome', 'overview-heading', 'records-heading']
                },
                denyDeleteWhenBound: true,
                immutableSemanticKeyWhenBound: true,
                runtimeMutation: 'deny'
            }
        })
        expect(() => entityRecordPolicySchema.parse(contentEntity?.config?.recordPolicy)).not.toThrow()
        expect(manifest.seed.elements?.DashboardDemoMetrics).toHaveLength(4)
        expect(manifest.seed.elements?.DashboardDemoSeries).toHaveLength(7)
        expect(manifest.seed.elements?.DashboardDemoRecords).toHaveLength(3)
        expect(manifest.seed.elements?.DashboardDemoContent).toHaveLength(3)
        expect(infoCard?.bindings?.slots[0]?.targets[0]).toMatchObject({
            entityKind: 'object',
            entityCodename: 'DashboardDemoContent',
            selector: { kind: 'semantic-key', value: 'welcome' }
        })
        expect(headings).toHaveLength(2)
        expect(headings.every((widget) => widget.bindings?.slots[0]?.targets[0]?.entityCodename === 'DashboardDemoContent')).toBe(true)
        expect(infoCard?.bindings?.slots[0]?.targets[0]?.selector).toEqual({ kind: 'semantic-key', field: 'key', value: 'welcome' })
        expect(manifest.seed.elements?.DashboardDemoContent?.[0]?.data).toHaveProperty('Key', 'welcome')
        expect(manifest.seed.elements?.DashboardDemoContent?.[0]?.data).not.toHaveProperty('key')
        expect(metricWidget?.bindings?.slots[0]?.targets[0]).toMatchObject({
            entityKind: 'object',
            entityCodename: 'DashboardDemoMetrics',
            selector: { kind: 'record-set' }
        })
        expect(seriesWidget?.bindings?.slots[0]?.targets[0]).toMatchObject({
            entityKind: 'object',
            entityCodename: 'DashboardDemoSeries',
            selector: { kind: 'record-set' }
        })
        expect(container?.instanceKey).toBe('demo-records-container')
        expect(table).toMatchObject({ parentInstanceKey: 'demo-records-container', slotKey: 'column:records' })
        expect(container?.rendererConfig).not.toHaveProperty('instanceKey')
        expect(table?.rendererConfig).not.toHaveProperty('instanceKey')
        expect(widgets.some((widget) => widget.widgetKey === 'infoCard')).toBe(true)
    })

    it('rejects a Dashboard semantic-key binding that does not resolve through its registered Component', () => {
        const manifest = cloneTemplate(basicDemoTemplate)
        const content = manifest.seed.elements?.DashboardDemoContent?.find((element) => element.codename === 'welcome')
        if (!content) throw new Error('Basic Demo must seed the welcome content record')
        content.data.Key = 'changed-key'

        expect(() => validateTemplateManifest(manifest)).toThrow(
            'Dashboard semantic-key source must resolve to exactly one seeded record; found 0.'
        )
    })

    it('accepts registered Marketing formats and hexColor metadata and rejects unknown semantic formats', () => {
        expect(() => validateTemplateManifest(cloneTemplate(interpretationNetworkTemplate))).not.toThrow()
        expect(() => validateTemplateManifest(cloneTemplate(marketingPageTemplate))).not.toThrow()

        const invalidFormat = cloneTemplate(interpretationNetworkTemplate)
        const matrix = invalidFormat.seed.entities
            ?.find((entity) => entity.codename === 'Interpretation')
            ?.components?.find((component) => component.codename === 'InterpretationMatrix')
        const fillColor = matrix?.childComponents?.find((component) => component.codename === 'CellFillColor')
        expect(fillColor).toBeDefined()
        if (fillColor) {
            fillColor.validationRules = { ...fillColor.validationRules, format: 'cssExpression' }
        }

        expect(() => validateTemplateManifest(invalidFormat)).toThrow()
    })

    it('accepts the user-facing marketing page template without a version bump', () => {
        expect(marketingPageTemplate.version).toBe('0.1.0')
        expect(marketingPageTemplate.minStructureVersion).toBe('0.1.0')
        expect(readVlcContent(marketingPageTemplate.description, 'en')).toBe(
            'A ready-made marketing page for presenting a product, its benefits, plans, testimonials, and FAQs.'
        )
        expect(readVlcContent(marketingPageTemplate.description, 'ru')).toBe(
            'Готовая маркетинговая страница для презентации продукта, преимуществ, тарифов, отзывов и ответов на частые вопросы.'
        )
        expect(marketingPageTemplate.meta?.tags).toEqual(['marketing', 'landing-page'])
        expect(marketingPageTemplate.seed.layouts[0]?.templateKey).toBe('marketing-page')
        expect(marketingPageTemplate.seed.elements?.MarketingPageSection?.map((element) => element.data.SectionKey)).toEqual([
            'logos',
            'features',
            'testimonials',
            'highlights',
            'pricing',
            'faq'
        ])
        expect(marketingPageTemplate.seed.elements?.MarketingPageLogo).toHaveLength(6)
        expect(marketingPageTemplate.seed.elements?.MarketingPageFeature).toHaveLength(3)
        expect(marketingPageTemplate.seed.elements?.MarketingPageTestimonial).toHaveLength(6)
        expect(marketingPageTemplate.seed.elements?.MarketingPageHighlight).toHaveLength(6)
        expect(marketingPageTemplate.seed.elements?.MarketingPagePricing).toHaveLength(3)
        expect(marketingPageTemplate.seed.elements?.MarketingPagePricingBenefit).toHaveLength(14)
        expect(marketingPageTemplate.seed.elements?.MarketingPageFaq).toHaveLength(4)

        const marketingSemanticKeyComponents = marketingPageTemplate.seed.entities
            ?.flatMap((entity) => entity.components ?? [])
            .filter((component) => component.validationRules?.unique === true)
        expect(marketingSemanticKeyComponents).not.toHaveLength(0)
        expect(marketingSemanticKeyComponents?.every((component) => component.isRequired === true)).toBe(true)

        const pricingEntity = marketingPageTemplate.seed.entities?.find((entity) => entity.codename === 'MarketingPagePricing')
        expect(pricingEntity?.components?.some((component) => component.dataType === 'JSON')).toBe(false)
        const benefitEntity = marketingPageTemplate.seed.entities?.find((entity) => entity.codename === 'MarketingPagePricingBenefit')
        expect(benefitEntity?.components?.find((component) => component.codename === 'TierRef')).toMatchObject({
            dataType: 'REF',
            targetEntityCodename: 'MarketingPagePricing',
            targetEntityKind: 'object'
        })
        expect(
            marketingPageTemplate.seed.entities
                ?.filter((entity) => entity.codename.startsWith('MarketingPage'))
                .every((entity) => entity.localizeCodenameFromName === false)
        ).toBe(true)
        expect(() => validateTemplateManifest(cloneTemplate(marketingPageTemplate))).not.toThrow()
    })

    it('keeps every seeded marketing binding Entity aligned with its registered Component contract', () => {
        const entitiesByCodename = new Map((marketingPageTemplate.seed.entities ?? []).map((entity) => [entity.codename, entity]))
        const dataTypeByBindingType: Record<string, string> = {
            STRING: 'string',
            NUMBER: 'number',
            BOOLEAN: 'boolean',
            JSON: 'json',
            REF: 'ref'
        }
        const failures: string[] = []

        for (const widgets of Object.values(marketingPageTemplate.seed.layoutZoneWidgets)) {
            for (const widget of widgets) {
                const definition = getLayoutWidgetDefinition(widget.widgetKey, widget.rendererConfig)
                if (!definition?.bindingSlots?.length) continue

                for (const binding of widget.bindings?.slots ?? []) {
                    const slot = definition.bindingSlots.find(({ key }) => key === binding.slot)
                    const entityCodename = binding.targets[0]?.entityCodename
                    const entity = entityCodename ? entitiesByCodename.get(entityCodename) : undefined
                    if (!slot || !entity) {
                        failures.push(`${widget.widgetKey}/${binding.slot}: seeded binding Entity or slot is missing`)
                        continue
                    }

                    for (const requirement of slot.requirements.components) {
                        const component = entity.components?.find(({ codename }) => codename === requirement.componentCodename)
                        const dataType = component ? dataTypeByBindingType[component.dataType.toUpperCase()] : undefined
                        const componentLabel = `${entity.codename}.${requirement.componentCodename}`
                        if (!component) {
                            failures.push(`${widget.widgetKey}/${binding.slot}: ${componentLabel} is missing`)
                            continue
                        }
                        if (
                            dataType !== requirement.valueType ||
                            (component.isRequired ?? false) !== requirement.required ||
                            !matchesWidgetBindingComponentValidationRules(requirement, component.validationRules)
                        ) {
                            failures.push(
                                `${widget.widgetKey}/${binding.slot}: ${componentLabel} does not satisfy its registered binding metadata`
                            )
                        }
                    }
                }
            }
        }

        expect(failures).toEqual([])
    })

    it('rejects Marketing bindings whose semantic selectors do not resolve to exactly one seeded record', () => {
        const manifest = cloneTemplate(marketingPageTemplate)
        const hero = manifest.seed.elements?.MarketingPageHero?.[0]
        expect(hero).toBeDefined()
        if (!hero) return
        hero.data.HeroKey = 'missing-hero'

        expect(() => validateTemplateManifest(manifest)).toThrow(/semantic selector.*resolves to 0 seeded records/u)
    })

    it('rejects a Pricing benefit whose TierRef does not resolve to a seeded Pricing tier', () => {
        const manifest = cloneTemplate(marketingPageTemplate)
        const benefit = manifest.seed.elements?.MarketingPagePricingBenefit?.[0]
        expect(benefit).toBeDefined()
        if (!benefit) return
        benefit.data.TierRef = 'missing-tier'

        expect(() => validateTemplateManifest(manifest)).toThrow(/seeded records resolve to the bound relation parent/u)
    })

    it('rejects a required Marketing record-set binding without seeded content records', () => {
        const manifest = cloneTemplate(marketingPageTemplate)
        manifest.seed.elements!.MarketingPageLogo = []

        expect(() => validateTemplateManifest(manifest)).toThrow(/record-set Entity MarketingPageLogo has no seeded records/u)
    })

    it('rejects malformed Hero binding envelopes in marketing template seeds', () => {
        const manifest = cloneTemplate(marketingPageTemplate)
        const heroWidget = manifest.seed.layoutZoneWidgets['marketing-main']?.find((widget) => widget.widgetKey === 'marketing.hero')
        expect(heroWidget).toBeDefined()
        if (!heroWidget) return

        heroWidget.bindings = {
            version: 1,
            slots: [{ slot: 'content', targets: [] }]
        }

        expect(() => validateTemplateManifest(manifest)).toThrow()
    })

    it('rejects Hero binding projections that do not match the widget registry', () => {
        const manifest = cloneTemplate(marketingPageTemplate)
        const heroWidget = manifest.seed.layoutZoneWidgets['marketing-main']?.find((widget) => widget.widgetKey === 'marketing.hero')
        expect(heroWidget).toBeDefined()
        if (!heroWidget) return

        const bindings = JSON.parse(JSON.stringify(heroWidget.bindings)) as NonNullable<typeof heroWidget.bindings>
        const titleProjection = bindings.slots[0]?.targets[0]?.projection.find((projection) => projection.field === 'title')
        expect(titleProjection).toBeDefined()
        if (!titleProjection) return
        titleProjection.componentCodename = 'UnregisteredHeroTitle'

        heroWidget.bindings = bindings

        expect(() => validateTemplateManifest(manifest)).toThrow()
    })

    it('continues rejecting trusted seed envelopes on untrusted renderer-config inputs', () => {
        const heroWidget = marketingPageTemplate.seed.layoutZoneWidgets['marketing-main']?.find(
            (widget) => widget.widgetKey === 'marketing.hero'
        )
        expect(heroWidget).toBeDefined()
        if (!heroWidget) return

        expect(() =>
            parseApplicationLayoutWidgetConfig('marketing.hero', {
                ...heroWidget.rendererConfig,
                bindings: heroWidget.bindings
            })
        ).toThrow()
    })

    it('seeds marketing content entities and record policies required by bound Hero and Image content', () => {
        expect(marketingPageTemplate.seed.elements?.MarketingPageSection?.map((element) => element.data.SectionKey)).toEqual([
            'logos',
            'features',
            'testimonials',
            'highlights',
            'pricing',
            'faq'
        ])

        const siteSettings = marketingPageTemplate.seed.entities?.find((entity) => entity.codename === 'MarketingPageSiteSettings')
        expect(siteSettings?.components?.some((component) => component.codename.startsWith('Hero'))).toBe(false)
        expect(siteSettings?.components?.some((component) => component.codename === 'SiteKey')).toBe(true)
        expect(marketingPageTemplate.seed.elements?.MarketingPageSiteSettings?.[0]?.data.SiteKey).toBe('site-settings')
        expect(
            Object.keys(marketingPageTemplate.seed.elements?.MarketingPageSiteSettings?.[0]?.data ?? {}).some((key) =>
                key.startsWith('Hero')
            )
        ).toBe(false)

        const heroEntity = marketingPageTemplate.seed.entities?.find((entity) => entity.codename === 'MarketingPageHero')
        expect(heroEntity).toMatchObject({
            kind: 'object',
            config: { recordBehavior: 'reference', marketingRole: 'hero' }
        })
        expect(
            marketingPageTemplate.seed.entities
                ?.filter((entity) => Object.hasOwn(entity.config ?? {}, 'recordPolicy'))
                .map((entity) => entity.codename)
                .sort()
        ).toEqual(['MarketingPageHero', 'MarketingPageImage', 'MarketingPageSection', 'MarketingPageSiteSettings'].sort())
        expect(entityRecordPolicySchema.parse(heroEntity?.config?.recordPolicy)).toEqual({
            version: 1,
            semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
        })

        const imageEntity = marketingPageTemplate.seed.entities?.find((entity) => entity.codename === 'MarketingPageImage')
        expect(imageEntity).toMatchObject({ kind: 'object', config: { recordBehavior: 'reference', marketingRole: 'image' } })
        expect(entityRecordPolicySchema.parse(imageEntity?.config?.recordPolicy)).toEqual({
            version: 1,
            semanticKey: { componentCodename: 'ImageKey', creationPrefix: 'image', protectedValues: ['default'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny',
            requiredLocales: ['en', 'ru'],
            conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }]
        })
        expect(marketingPageTemplate.seed.elements?.MarketingPageImage).toHaveLength(1)
        expect(marketingPageTemplate.seed.elements?.MarketingPageImage?.[0]?.data).toMatchObject({
            ImageKey: 'default',
            Resource: { type: 'url', launchMode: 'inline' },
            AltText: expect.any(Object),
            Decorative: false,
            Width: 1600,
            Height: 900
        })

        const heroComponents = new Map(heroEntity?.components?.map((component) => [component.codename, component]))
        const imageComponents = new Map(imageEntity?.components?.map((component) => [component.codename, component]))
        expect(imageComponents.get('Resource')).toMatchObject({
            dataType: 'JSON',
            isRequired: false,
            validationRules: { format: 'marketingMediaReference' },
            uiConfig: { widget: 'resourceSource', gridHidden: true }
        })
        expect(heroComponents.get('HeroKey')).toMatchObject({
            isRequired: true,
            validationRules: { unique: true },
            uiConfig: { hidden: true, gridHidden: true }
        })
        expect(heroComponents.get('Title')).toMatchObject({ isRequired: true, isDisplayComponent: true, uiConfig: { isDisplay: true } })
        expect(heroComponents.get('Description')).toMatchObject({ isRequired: true, uiConfig: { widget: 'textarea', rows: 4 } })
        expect(heroComponents.get('PrimaryAction')).toMatchObject({
            dataType: 'JSON',
            isRequired: true,
            validationRules: { format: 'marketingAction' },
            uiConfig: { gridHidden: true }
        })
        expect(heroComponents.get('TermsAction')).toMatchObject({
            dataType: 'JSON',
            validationRules: { format: 'marketingAction' },
            uiConfig: { gridHidden: true }
        })

        const heroRecords = marketingPageTemplate.seed.elements?.MarketingPageHero ?? []
        expect(heroRecords).toHaveLength(1)
        expect(heroRecords[0]).toMatchObject({
            codename: 'default',
            data: {
                HeroKey: 'default',
                PrimaryAction: { kind: 'internal', path: '/auth', target: 'same-tab' },
                TermsAction: { kind: 'internal', path: '/terms', target: 'same-tab' }
            }
        })

        const heroWidget = marketingPageTemplate.seed.layoutZoneWidgets['marketing-main']?.find(
            (widget) => widget.widgetKey === 'marketing.hero'
        )
        expect(heroWidget?.instanceKey).toBe('hero')
        expect(heroWidget?.rendererConfig).toEqual({ showLeadForm: true })
        expect(heroWidget?.rendererConfig).not.toHaveProperty('source')
        expect(heroWidget?.rendererConfig).not.toHaveProperty('copySource')
        expect(getLayoutWidgetDefinition('marketing.hero')?.multiInstance).toBe(true)
        expect({
            rendererConfig: heroWidget?.rendererConfig,
            neutral: { bindings: heroWidget?.bindings }
        }).toEqual({
            rendererConfig: { showLeadForm: true },
            neutral: {
                bindings: {
                    version: 1,
                    slots: [
                        {
                            slot: 'content',
                            targets: [
                                {
                                    entityKind: 'object',
                                    entityCodename: 'MarketingPageHero',
                                    selector: { kind: 'semantic-key', field: 'key', value: 'default' },
                                    projection: [
                                        { field: 'accent', componentCodename: 'Accent' },
                                        { field: 'description', componentCodename: 'Description' },
                                        { field: 'emailLabel', componentCodename: 'EmailLabel' },
                                        { field: 'emailPlaceholder', componentCodename: 'EmailPlaceholder' },
                                        { field: 'key', componentCodename: 'HeroKey' },
                                        { field: 'primaryAction', componentCodename: 'PrimaryAction' },
                                        { field: 'primaryActionLabel', componentCodename: 'PrimaryActionLabel' },
                                        { field: 'termsAction', componentCodename: 'TermsAction' },
                                        { field: 'termsLinkLabel', componentCodename: 'TermsLinkLabel' },
                                        { field: 'termsText', componentCodename: 'TermsText' },
                                        { field: 'title', componentCodename: 'Title' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        })
    })

    it('rejects application-only source zone settings in metahub seed layouts', () => {
        const manifest = cloneTemplate(basicTemplate)
        const layout = manifest.seed.layouts[0]
        expect(layout).toBeDefined()
        if (layout) {
            layout.config = {
                ...(layout.config ?? {}),
                __layout: {
                    sourceZoneSettings: {
                        'marketing-header': { position: 'flow' }
                    }
                }
            }
        }

        expect(() => validateTemplateManifest(manifest)).toThrow(/sourceZoneSettings/i)
    })

    it('accepts the built-in 1C-Compatible template without changing the default starter template presets', () => {
        expect(() => validateTemplateManifest(cloneTemplate(oneCCompatibleTemplate))).not.toThrow()
        expect(oneCCompatibleTemplate.codename).toBe('1c-compatible')
        expect(oneCCompatibleTemplate.presets?.map((preset) => preset.presetCodename)).toEqual([
            'one-c-constant',
            'enumeration',
            'one-c-catalog',
            'one-c-document',
            'one-c-document-journal',
            'one-c-information-register',
            'one-c-accumulation-register',
            'one-c-chart-of-accounts',
            'one-c-chart-of-characteristic-types',
            'one-c-accounting-register',
            'one-c-chart-of-calculation-types',
            'one-c-calculation-register'
        ])
        expect(basicTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
    })

    it('accepts the built-in object entity preset', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(objectEntityPreset))).not.toThrow()
    })

    it('preserves record behavior component flags in the built-in object entity preset', () => {
        const validated = validateEntityTypePresetManifest(cloneTemplate(objectEntityPreset))
        const mainObject = validated.defaultInstances?.find(({ codename }) => codename === 'Main')
        const titleComponent = mainObject?.components?.find(({ codename }) => codename === 'Title')

        expect(validated.entityType.ui.tabs).toContain('behavior')
        expect(validated.entityType.capabilities.identityFields).toEqual({
            enabled: true,
            allowNumber: true,
            allowEffectiveDate: true
        })
        expect(validated.entityType.capabilities.recordLifecycle).toEqual({
            enabled: true,
            allowCustomStates: true
        })
        expect(validated.entityType.capabilities.posting).toEqual({
            enabled: true,
            allowManualPosting: true,
            allowAutomaticPosting: true
        })
        expect(titleComponent).toMatchObject({
            isRequired: true,
            isDisplayComponent: true,
            validationRules: { maxLength: 255, localized: true }
        })
    })

    it('accepts the built-in hub, set, and enumeration entity presets', () => {
        expect(() => validateEntityTypePresetManifest(cloneTemplate(hubEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(pageEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(setEntityPreset))).not.toThrow()
        expect(() => validateEntityTypePresetManifest(cloneTemplate(enumerationEntityPreset))).not.toThrow()
    })

    it('accepts 1C-Compatible preset manifests with typed reusable behavior configs', () => {
        const presets = oneCCompatibleCorePresets.map((preset) => validateEntityTypePresetManifest(cloneTemplate(preset)))

        expect(presets.map((preset) => preset.entityType.kindKey)).toEqual([
            'constant',
            'catalog',
            'document',
            'document-journal',
            'information-register',
            'accumulation-register'
        ])
        expect(presets.map((preset) => preset.entityType.kindKey)).not.toContain('object')
        expect(presets.find((preset) => preset.codename === 'one-c-constant')?.entityType.config?.singleValue).toMatchObject({
            kind: 'singleValue',
            dataType: 'STRING'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-document')?.entityType.config?.documentBehavior).toMatchObject({
            kind: 'document'
        })
        expect(
            presets.find((preset) => preset.codename === 'one-c-accumulation-register')?.entityType.config?.registerBehavior
        ).toMatchObject({
            kind: 'register',
            mode: 'balance'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-catalog')?.entityType.ui.resourceSurfaces?.[0]).toMatchObject({
            key: 'requisites',
            routeSegment: 'requisites',
            fallbackTitle: 'Requisites',
            fallbackSharedTitle: 'Requisites'
        })
        expect(presets.find((preset) => preset.codename === 'one-c-catalog')?.entityType.capabilities.treeAssignment).toBe(false)
        expect(presets.find((preset) => preset.codename === 'one-c-document')?.entityType.capabilities.treeAssignment).toBe(false)
        expect(presets.find((preset) => preset.codename === 'one-c-information-register')?.entityType.capabilities.treeAssignment).toBe(
            false
        )
        expect(presets.find((preset) => preset.codename === 'one-c-accumulation-register')?.entityType.capabilities.treeAssignment).toBe(
            false
        )
        expect(new Set(presets.map((preset) => preset.entityType.ui.iconName)).size).toBe(presets.length)
        expect(presets.map((preset) => preset.entityType.presentation?.readiness)).toEqual(
            Array.from({ length: oneCCompatibleCorePresets.length }, () => 'preview')
        )
    })

    it('registers and materializes every 1C-Compatible target preset in the template', () => {
        const allPresets = oneCCompatibleAllPresets.map((preset) => validateEntityTypePresetManifest(cloneTemplate(preset)))
        const previewPresetCodenames = oneCCompatiblePreviewPresets.map((preset) => preset.codename)

        expect(allPresets.map((preset) => preset.codename)).toEqual(
            expect.arrayContaining([
                'one-c-constant',
                'one-c-catalog',
                'one-c-document',
                'one-c-document-journal',
                'one-c-information-register',
                'one-c-accumulation-register',
                'one-c-chart-of-accounts',
                'one-c-chart-of-characteristic-types',
                'one-c-accounting-register',
                'one-c-chart-of-calculation-types',
                'one-c-calculation-register'
            ])
        )
        expect(new Set(allPresets.map((preset) => preset.entityType.ui.iconName)).size).toBe(allPresets.length)
        expect(previewPresetCodenames).not.toContain('one-c-document')
        expect(oneCCompatibleTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(
            expect.arrayContaining(previewPresetCodenames)
        )
    })

    it('rejects invalid typed behavior config embedded in a preset manifest', () => {
        const manifest = cloneTemplate(oneCCompatibleCorePresets[1])
        manifest.entityType.config = {
            catalogBehavior: {
                kind: 'catalog',
                unexpected: true
            }
        }

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/Invalid typed behavior config: catalogBehavior/)
    })

    it('rejects invalid typed behavior config embedded in preset default instances', () => {
        const manifest = cloneTemplate(oneCCompatibleCorePresets[2])
        if (!manifest.defaultInstances?.[0]) {
            throw new Error('Document preset must keep a default instance fixture')
        }
        manifest.defaultInstances[0].config = {
            documentBehavior: {
                kind: 'register',
                mode: 'facts'
            }
        }

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/documentBehavior.*register/)
    })

    it('rejects dangling behavior references in merged template seed entities', () => {
        expect(() =>
            validateTemplateSeedEntityBehaviorReferences({
                layouts: [],
                layoutZoneWidgets: {},
                entities: [
                    {
                        codename: 'GoodsReceipt',
                        kind: 'document',
                        name: {} as never,
                        components: [
                            {
                                codename: 'Goods',
                                dataType: 'TABLE',
                                name: {} as never,
                                childComponents: [{ codename: 'Product', dataType: 'STRING', name: {} as never }]
                            }
                        ],
                        config: {
                            documentPosting: {
                                kind: 'documentPosting',
                                moduleCodename: 'MissingPostingModule',
                                movements: [
                                    {
                                        targetRegisterCodename: 'StockBalance',
                                        sourceTableCodename: 'MissingTable',
                                        dimensionMappings: { Product: 'MissingProduct' },
                                        resourceMappings: {}
                                    }
                                ],
                                repostPolicy: 'replace-existing-batch'
                            }
                        }
                    }
                ]
            })
        ).toThrow(/MODULE_NOT_FOUND|TARGET_REGISTER_NOT_FOUND|SOURCE_TABLE_NOT_FOUND|FIELD_MAPPING_NOT_FOUND/)
    })

    it('keeps standard metadata menu order and excludes optional ledgers from default starter templates', () => {
        const orderedKinds = [
            hubEntityPreset,
            pageEntityPreset,
            objectEntityPreset,
            setEntityPreset,
            enumerationEntityPreset,
            ledgerEntityPreset
        ]
            .map((preset) => ({
                kindKey: preset.entityType.kindKey,
                sidebarOrder: preset.entityType.ui.sidebarOrder
            }))
            .sort((left, right) => Number(left.sidebarOrder ?? 0) - Number(right.sidebarOrder ?? 0))
            .map((item) => item.kindKey)

        expect(orderedKinds).toEqual(['hub', 'page', 'object', 'set', 'enumeration', 'ledger'])
        expect(basicTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
        expect(basicDemoTemplate.presets?.map((preset) => preset.presetCodename)).toEqual(['hub', 'page', 'object', 'set', 'enumeration'])
    })

    it('keeps standard resource surface definitions aligned with component capabilities', () => {
        const objectManifest = cloneTemplate(objectEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        expect(objectManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Components'
            })
        ])
        expect(setManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'fixedValues',
                capability: 'fixedValues',
                routeSegment: 'fixed-values',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Constants'
            })
        ])
        expect(enumerationManifest.entityType.ui.resourceSurfaces).toEqual([
            expect.objectContaining({
                key: 'optionValues',
                capability: 'optionValues',
                routeSegment: 'values',
                title: expect.objectContaining({ _primary: 'en' }),
                fallbackTitle: 'Values'
            })
        ])
    })

    it('keeps standard hub assignment labels data-driven for hub-scoped entity types', () => {
        const objectManifest = cloneTemplate(objectEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        for (const manifest of [objectManifest, setManifest, enumerationManifest]) {
            expect(manifest.entityType.ui.treeAssignmentLabels?.title?.locales.en.content).toBe('Hubs')
            expect(manifest.entityType.ui.treeAssignmentLabels?.title?.locales.ru.content).toBe('Хабы')
            expect(manifest.entityType.ui.treeAssignmentLabels?.requiredLabel?.locales.en.content).toBe('Hub required')
            expect(manifest.entityType.ui.treeAssignmentLabels?.requiredLabel?.locales.ru.content).toBe('Хаб обязателен')
            expect(manifest.entityType.ui.treeAssignmentLabels?.singleLabel?.locales.en.content).toBe('Single hub only')
            expect(manifest.entityType.ui.treeAssignmentLabels?.singleLabel?.locales.ru.content).toBe('Только один хаб')
        }
    })

    it('keeps the standard preset automation uplift enabled for hub, set, and enumeration entity presets', () => {
        const hubManifest = cloneTemplate(hubEntityPreset)
        const setManifest = cloneTemplate(setEntityPreset)
        const enumerationManifest = cloneTemplate(enumerationEntityPreset)

        expect(hubManifest.entityType.capabilities.modules).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(hubManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(setManifest.entityType.capabilities.modules).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(setManifest.entityType.capabilities.events).toEqual({ enabled: true })

        expect(enumerationManifest.entityType.capabilities.modules).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.capabilities.actions).toEqual({ enabled: true })
        expect(enumerationManifest.entityType.capabilities.events).toEqual({ enabled: true })
    })

    it('keeps the Basic default to a valid shell without unbound content widgets', () => {
        const manifest = cloneTemplate(basicTemplate)
        const widgets = manifest.seed.layoutZoneWidgets.main ?? []

        expect(widgets.map((widget) => widget.widgetKey)).toEqual([
            'workspaceSwitcher',
            'menuWidget',
            'appNavbar',
            'header',
            'languageSwitcher',
            'colorModeSwitcher',
            'optionsMenu'
        ])
        expect(widgets.find((widget) => widget.widgetKey === 'menuWidget')?.rendererConfig).toEqual({ variant: 'generated' })
        expect(widgets.some((widget) => widget.widgetKey === 'columnsContainer')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'productTree')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'detailsTitle' || widget.widgetKey === 'detailsTable')).toBe(false)
    })

    it('keeps the lms template aligned with curated navigation and canonical entities', () => {
        const manifest = cloneTemplate(lmsTemplate)
        const widgets = manifest.seed.layoutZoneWidgets.main ?? []
        const homeWidgets = manifest.seed.layoutZoneWidgets.learnerHome ?? []
        const learningContentWidgets = manifest.seed.layoutZoneWidgets.learningContent ?? []
        const courseBuilderWidgets = manifest.seed.layoutZoneWidgets.courseBuilder ?? []
        const trackBuilderWidgets = manifest.seed.layoutZoneWidgets.trackBuilder ?? []
        const entityCodenames = manifest.seed.entities.map((entity) => entity.codename)
        const entityByCodename = new Map(manifest.seed.entities.map((entity) => [entity.codename, entity]))
        const trashEntity = entityByCodename.get('TrashEntries')
        const menuWidget = widgets.find((widget) => widget.widgetKey === 'menuWidget')
        const courseBuilderTabs = courseBuilderWidgets.find((widget) => widget.widgetKey === 'detailsTabs')
        const trackBuilderTabs = trackBuilderWidgets.find((widget) => widget.widgetKey === 'detailsTabs')

        expect(widgets.some((widget) => widget.widgetKey === 'moduleViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'statsViewerWidget')).toBe(false)
        expect(widgets.some((widget) => widget.widgetKey === 'qrCodeWidget')).toBe(false)
        expect(manifest.seed.scopedLayouts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'learnerHome',
                    scopeEntityCodename: 'LearnerHome',
                    scopeEntityKind: 'page',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'learningContent',
                    scopeEntityCodename: 'ContentProjects',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'learningContentTrash',
                    scopeEntityCodename: 'TrashEntries',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'courseBuilder',
                    scopeEntityCodename: 'Courses',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                }),
                expect.objectContaining({
                    codename: 'trackBuilder',
                    scopeEntityCodename: 'LearningTracks',
                    scopeEntityKind: 'object',
                    baseLayoutCodename: 'main'
                })
            ])
        )
        const dashboardPlacements = Object.values(manifest.seed.layoutZoneWidgets).flat()
        expect(dashboardPlacements.map((placement) => placement.widgetKey)).not.toEqual(
            expect.arrayContaining(['brandSelector', 'productTree', 'usersByCountryChart'])
        )
        for (const placement of dashboardPlacements) {
            expect('config' in placement).toBe(false)
            if (!('rendererConfig' in placement)) continue
            expect(placement.rendererConfig).not.toHaveProperty('datasource')
            expect(placement.rendererConfig).not.toHaveProperty('widgets')
            for (const collectionKey of ['columns', 'tabs']) {
                const children = placement.rendererConfig[collectionKey]
                if (Array.isArray(children)) {
                    expect(children.every((child) => !Object.hasOwn(child as object, 'widgets'))).toBe(true)
                }
            }
        }
        expect(widgets.map((widget) => widget.widgetKey)).toEqual([
            'workspaceSwitcher',
            'menuWidget',
            'appNavbar',
            'header',
            'languageSwitcher',
            'colorModeSwitcher',
            'optionsMenu'
        ])
        const learnerHomeTabGroups = homeWidgets.filter((widget) => widget.widgetKey === 'detailsTabs')
        expect(learnerHomeTabGroups.map((widget) => widget.instanceKey)).toEqual([
            'learner-home-assignment-tabs',
            'learner-home-content-tabs'
        ])
        const learnerHomeAssignmentTabs = learnerHomeTabGroups.find((widget) => widget.instanceKey === 'learner-home-assignment-tabs')
        expect(learnerHomeAssignmentTabs?.rendererConfig.tabs).toEqual([
            expect.objectContaining({ slotKey: 'tab:my-courses', label: { en: 'My Courses', ru: 'Мои курсы' }, isDefault: true }),
            expect.objectContaining({ slotKey: 'tab:my-tracks', label: { en: 'My Tracks', ru: 'Мои треки' } })
        ])
        const learnerHomeContentTabs = learnerHomeTabGroups.find((widget) => widget.instanceKey === 'learner-home-content-tabs')
        expect(learnerHomeContentTabs?.rendererConfig.tabs).toEqual([
            expect.objectContaining({ slotKey: 'tab:recent', isDefault: true }),
            expect.objectContaining({ slotKey: 'tab:starred' }),
            expect.objectContaining({ slotKey: 'tab:shared' })
        ])
        const learnerHomeTables = homeWidgets.filter((widget) => widget.widgetKey === 'detailsTable')
        expect(learnerHomeTables).toHaveLength(5)
        const learnerHomeEnrollmentTables = learnerHomeTables.filter((widget) => widget.rendererConfig.variant === 'learner-enrollments')
        expect(learnerHomeEnrollmentTables).toHaveLength(2)
        expect(
            learnerHomeEnrollmentTables.map((widget) => ({
                instanceKey: widget.instanceKey,
                parentInstanceKey: widget.parentInstanceKey,
                slotKey: widget.slotKey,
                targetSelector: widget.bindings?.slots[0]?.targets[0]?.selector,
                targets: widget.bindings?.slots[0]?.targets.map((target) => target.entityCodename)
            }))
        ).toEqual([
            {
                instanceKey: 'learner-home-my-courses',
                parentInstanceKey: 'learner-home-assignment-tabs',
                slotKey: 'tab:my-courses',
                targetSelector: { kind: 'learner-enrollment-set', targetKind: 'course' },
                targets: ['Enrollments']
            },
            {
                instanceKey: 'learner-home-my-tracks',
                parentInstanceKey: 'learner-home-assignment-tabs',
                slotKey: 'tab:my-tracks',
                targetSelector: { kind: 'learner-enrollment-set', targetKind: 'track' },
                targets: ['Enrollments']
            }
        ])
        const learnerHomeLibraryTables = learnerHomeTables.filter((widget) => widget.rendererConfig.variant === 'library')
        expect(learnerHomeLibraryTables).toHaveLength(3)
        expect(
            learnerHomeLibraryTables.map((widget) => ({
                instanceKey: widget.instanceKey,
                parentInstanceKey: widget.parentInstanceKey,
                slotKey: widget.slotKey,
                variant: widget.rendererConfig.variant,
                libraryView: widget.rendererConfig.libraryView,
                targets: widget.bindings?.slots[0]?.targets.map((target) => target.entityCodename).sort()
            }))
        ).toEqual([
            {
                instanceKey: 'learner-home-recent',
                parentInstanceKey: 'learner-home-content-tabs',
                slotKey: 'tab:recent',
                variant: 'library',
                libraryView: 'recent',
                targets: ['Courses', 'LearningResources', 'LearningTracks']
            },
            {
                instanceKey: 'learner-home-starred',
                parentInstanceKey: 'learner-home-content-tabs',
                slotKey: 'tab:starred',
                variant: 'library',
                libraryView: 'starred',
                targets: ['Courses', 'LearningResources', 'LearningTracks']
            },
            {
                instanceKey: 'learner-home-shared',
                parentInstanceKey: 'learner-home-content-tabs',
                slotKey: 'tab:shared',
                variant: 'library',
                libraryView: 'shared',
                targets: ['Courses', 'LearningResources', 'LearningTracks']
            }
        ])
        expect(menuWidget?.rendererConfig).toMatchObject({ variant: 'generated' })
        expect(trashEntity).toMatchObject({
            name: {
                locales: {
                    en: { content: 'Trash' },
                    ru: { content: 'Корзина' }
                }
            },
            hubs: ['Learning'],
            config: {
                runtime: {
                    menuVisibility: 'primary',
                    icon: 'trash',
                    requiresPermission: 'editContent'
                }
            }
        })
        for (const codename of ['TargetObjectCodename', 'TargetRecordId', 'DeletedBy', 'RestoreState']) {
            expect(trashEntity?.components.find((component) => component.codename === codename)?.uiConfig).toMatchObject({ hidden: true })
        }
        expect(learningContentWidgets).toHaveLength(1)
        const learningContentTables = learningContentWidgets.filter((widget) => widget.widgetKey === 'detailsTable')
        expect(learningContentTables).toHaveLength(1)
        const learningResourceTable = learningContentTables[0]
        expect(learningResourceTable).toBeDefined()
        expect(learningResourceTable?.parentInstanceKey).toBeNull()
        expect(learningResourceTable?.slotKey).toBeNull()
        expect(learningResourceTable?.rendererConfig).toMatchObject({
            variant: 'library',
            libraryView: 'all',
            lifecycleState: 'active',
            showSearch: true,
            showViewToggle: true
        })
        expect(learningResourceTable?.bindings?.slots).toEqual([
            expect.objectContaining({
                slot: 'rows',
                targets: expect.arrayContaining([
                    expect.objectContaining({ entityCodename: 'LearningResources' }),
                    expect.objectContaining({ entityCodename: 'Courses' }),
                    expect.objectContaining({ entityCodename: 'LearningTracks' })
                ])
            })
        ])
        const learningContentTableConfig = learningResourceTable?.rendererConfig ?? {}
        const createTargets = learningContentTableConfig.createTargets as Array<{
            id: string
            disabled?: boolean
            disabledReason?: unknown
        }>
        expect(createTargets).toHaveLength(8)
        expect(createTargets.map((target) => target.id)).toEqual([
            'learning-content-create-project',
            'learning-content-create-page',
            'learning-content-create-link',
            'learning-content-create-course',
            'learning-content-create-track',
            'learning-content-create-quiz-lite',
            'learning-content-create-assignment-lite',
            'learning-content-create-package'
        ])
        expect(createTargets.filter((target) => target.disabled).map((target) => target.id)).toEqual([
            'learning-content-create-quiz-lite',
            'learning-content-create-assignment-lite',
            'learning-content-create-package'
        ])
        const createTargetById = new Map(createTargets.map((target) => [target.id, target]))
        expect(createTargetById.get('learning-content-create-quiz-lite')?.disabledReason).toEqual({
            en: 'Quiz authoring is planned for a later Learning Content phase.',
            ru: 'Создание тестов запланировано на следующий этап учебного контента.'
        })
        expect(createTargetById.get('learning-content-create-assignment-lite')?.disabledReason).toEqual({
            en: 'Assignment authoring is planned for a later Learning Content phase.',
            ru: 'Создание заданий запланировано на следующий этап учебного контента.'
        })
        expect(createTargetById.get('learning-content-create-package')?.disabledReason).toEqual({
            en: 'File import support is planned for a later phase.',
            ru: 'Импорт файлов запланирован на следующий этап.'
        })
        expect(courseBuilderTabs).toBeDefined()
        expect(trackBuilderTabs).toBeDefined()
        expect((courseBuilderTabs?.rendererConfig.tabs as Array<{ slotKey: string }> | undefined)?.map((tab) => tab.slotKey)).toEqual([
            'tab:sections',
            'tab:items',
            'tab:player',
            'tab:reports'
        ])
        expect((trackBuilderTabs?.rendererConfig.tabs as Array<{ slotKey: string }> | undefined)?.map((tab) => tab.slotKey)).toEqual([
            'tab:stages',
            'tab:steps',
            'tab:player',
            'tab:reports'
        ])
        expect(courseBuilderWidgets).toContainEqual(
            expect.objectContaining({
                instanceKey: 'course-builder-player',
                widgetKey: 'learnerPlayer',
                parentInstanceKey: 'course-builder-tabs',
                slotKey: 'tab:player',
                rendererConfig: { variant: 'course', displayMode: 'player', sequenceMode: 'strict' },
                bindings: expect.objectContaining({
                    slots: expect.arrayContaining([
                        expect.objectContaining({ slot: 'parent', targets: [expect.objectContaining({ entityCodename: 'Courses' })] }),
                        expect.objectContaining({ slot: 'items', targets: [expect.objectContaining({ entityCodename: 'CourseItems' })] })
                    ])
                })
            })
        )
        expect(trackBuilderWidgets).toContainEqual(
            expect.objectContaining({
                instanceKey: 'track-builder-player',
                widgetKey: 'learnerPlayer',
                parentInstanceKey: 'track-builder-tabs',
                slotKey: 'tab:player',
                rendererConfig: { variant: 'track', displayMode: 'player', sequenceMode: 'strict' },
                bindings: expect.objectContaining({
                    slots: expect.arrayContaining([
                        expect.objectContaining({
                            slot: 'parent',
                            targets: [expect.objectContaining({ entityCodename: 'LearningTracks' })]
                        }),
                        expect.objectContaining({ slot: 'items', targets: [expect.objectContaining({ entityCodename: 'TrackSteps' })] })
                    ])
                })
            })
        )
        expect(courseBuilderWidgets.filter((widget) => widget.widgetKey === 'relationBuilder')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    instanceKey: 'course-builder-sections',
                    parentInstanceKey: 'course-builder-tabs',
                    slotKey: 'tab:sections',
                    rendererConfig: expect.objectContaining({
                        panels: expect.arrayContaining([
                            expect.objectContaining({ parentFieldCodename: 'CourseId', enableRowReordering: true })
                        ])
                    }),
                    bindings: expect.objectContaining({
                        slots: expect.arrayContaining([
                            expect.objectContaining({
                                slot: 'panel:sections',
                                targets: expect.arrayContaining([
                                    expect.objectContaining({
                                        entityCodename: 'CourseSections',
                                        selector: { kind: 'relation-set', parentSlot: 'parent' }
                                    })
                                ])
                            })
                        ])
                    })
                }),
                expect.objectContaining({
                    instanceKey: 'course-builder-items',
                    parentInstanceKey: 'course-builder-tabs',
                    slotKey: 'tab:items',
                    rendererConfig: expect.objectContaining({
                        panels: expect.arrayContaining([
                            expect.objectContaining({ parentFieldCodename: 'CourseId', enableRowReordering: true })
                        ])
                    }),
                    bindings: expect.objectContaining({
                        slots: expect.arrayContaining([
                            expect.objectContaining({
                                slot: 'panel:items',
                                targets: expect.arrayContaining([
                                    expect.objectContaining({
                                        entityCodename: 'CourseItems',
                                        selector: { kind: 'relation-set', parentSlot: 'parent' }
                                    })
                                ])
                            })
                        ])
                    })
                })
            ])
        )
        expect(trackBuilderWidgets.filter((widget) => widget.widgetKey === 'relationBuilder')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    instanceKey: 'track-builder-stages',
                    parentInstanceKey: 'track-builder-tabs',
                    slotKey: 'tab:stages',
                    rendererConfig: expect.objectContaining({
                        panels: expect.arrayContaining([
                            expect.objectContaining({ parentFieldCodename: 'TrackId', enableRowReordering: true })
                        ])
                    }),
                    bindings: expect.objectContaining({
                        slots: expect.arrayContaining([
                            expect.objectContaining({
                                slot: 'panel:stages',
                                targets: expect.arrayContaining([
                                    expect.objectContaining({
                                        entityCodename: 'TrackStages',
                                        selector: { kind: 'relation-set', parentSlot: 'parent' }
                                    })
                                ])
                            })
                        ])
                    })
                }),
                expect.objectContaining({
                    instanceKey: 'track-builder-steps',
                    parentInstanceKey: 'track-builder-tabs',
                    slotKey: 'tab:steps',
                    rendererConfig: expect.objectContaining({
                        panels: expect.arrayContaining([
                            expect.objectContaining({ parentFieldCodename: 'TrackId', enableRowReordering: true })
                        ])
                    }),
                    bindings: expect.objectContaining({
                        slots: expect.arrayContaining([
                            expect.objectContaining({
                                slot: 'panel:steps',
                                targets: expect.arrayContaining([
                                    expect.objectContaining({
                                        entityCodename: 'TrackSteps',
                                        selector: { kind: 'relation-set', parentSlot: 'parent' }
                                    })
                                ])
                            })
                        ])
                    })
                })
            ])
        )
        for (const [placementKey, entityCodename, fieldCodename] of [
            ['courseSectionsOrdering', 'CourseSections', 'CourseId'],
            ['courseItemsOrdering', 'CourseItems', 'CourseId'],
            ['trackStagesOrdering', 'TrackStages', 'TrackId'],
            ['trackStepsOrdering', 'TrackSteps', 'TrackId']
        ] as const) {
            const relationWidget = manifest.seed.layoutZoneWidgets[placementKey]?.[0]
            expect(relationWidget).toMatchObject({
                widgetKey: 'relationBuilder',
                rendererConfig: { panels: [expect.objectContaining({ parentFieldCodename: fieldCodename, enableRowReordering: true })] },
                bindings: {
                    slots: expect.arrayContaining([
                        expect.objectContaining({
                            targets: expect.arrayContaining([expect.objectContaining({ entityCodename })])
                        })
                    ])
                }
            })
        }
        expect(entityCodenames).toEqual(
            expect.arrayContaining([
                'Learning',
                'LmsConfiguration',
                'LearnerHome',
                'CourseOverview',
                'KnowledgeHome',
                'KnowledgeArticle',
                'KnowledgeArticles',
                'DevelopmentHome',
                'AssignmentInstructions',
                'CertificatePolicy',
                'Classes',
                'Students',
                'ContentProjects',
                'ContentAccessEntries',
                'ContentStars',
                'RecentContentViews',
                'ContentProgress',
                'TrashEntries',
                'LearningResources',
                'Courses',
                'CourseSections',
                'CourseItems',
                'LearningTracks',
                'TrackStages',
                'TrackSteps',
                'Quizzes',
                'QuizResponses',
                'QuizAttempts',
                'LearningActivityLedger',
                'ProgressLedger',
                'ScoreLedger',
                'EnrollmentLedger',
                'AttendanceLedger',
                'CertificateLedger',
                'PointsLedger',
                'NotificationLedger',
                'AccessLinks',
                'AssignmentSubmissions',
                'TrainingAttendance',
                'CertificateIssues',
                'GamificationSettings',
                'PointAwardRules',
                'PointTransactions',
                'BadgeDefinitions',
                'BadgeIssues',
                'LeaderboardSnapshots',
                'LearningResourceStatus',
                'PublicationStatus',
                'QuestionType',
                'ContentType',
                'PointSourceType'
            ])
        )
        expect(manifest.presets).toEqual([
            { presetCodename: 'hub', includedByDefault: true },
            { presetCodename: 'page', includedByDefault: false },
            { presetCodename: 'object', includedByDefault: true },
            { presetCodename: 'set', includedByDefault: true },
            { presetCodename: 'enumeration', includedByDefault: true }
        ])
        expect(manifest.seed.modules?.map((module) => module.codename)).not.toContain('AutoEnrollmentRuleModule')
        for (const codename of [
            'QuizResponses',
            'QuizAttempts',
            'ContentProgress',
            'Assignments',
            'AssignmentSubmissions',
            'TrainingEvents',
            'TrainingAttendance',
            'Certificates',
            'CertificateIssues',
            'DevelopmentPlanTasks',
            'NotificationOutbox',
            'PointTransactions',
            'BadgeIssues',
            'Enrollments'
        ]) {
            expect(entityByCodename.get(codename)?.config?.recordBehavior).toEqual(
                expect.objectContaining({
                    mode: 'transactional',
                    numbering: expect.objectContaining({ enabled: true }),
                    posting: expect.objectContaining({ mode: 'manual' })
                })
            )
        }
        const workflowExpectations = [
            {
                entityCodename: 'AssignmentSubmissions',
                actions: [
                    {
                        codename: 'StartSubmissionReview',
                        from: ['Submitted'],
                        to: 'PendingReview',
                        requiredCapabilities: ['assignment.review']
                    },
                    {
                        codename: 'AcceptSubmission',
                        from: ['PendingReview'],
                        to: 'Accepted',
                        requiredCapabilities: ['assignment.review'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'DeclineSubmission',
                        from: ['PendingReview'],
                        to: 'Declined',
                        requiredCapabilities: ['assignment.review']
                    }
                ]
            },
            {
                entityCodename: 'TrainingAttendance',
                actions: [
                    {
                        codename: 'MarkAttendanceAttended',
                        from: ['Registered'],
                        to: 'Attended',
                        requiredCapabilities: ['attendance.mark'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'MarkAttendanceNoShow',
                        from: ['Registered'],
                        to: 'NoShow',
                        requiredCapabilities: ['attendance.mark'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'CancelAttendance',
                        from: ['Registered', 'Attended', 'NoShow'],
                        to: 'Cancelled',
                        requiredCapabilities: ['attendance.manage'],
                        postingCommand: 'void'
                    }
                ]
            },
            {
                entityCodename: 'CertificateIssues',
                actions: [
                    {
                        codename: 'IssueCertificate',
                        from: ['Eligible'],
                        to: 'Issued',
                        requiredCapabilities: ['certificate.issue'],
                        postingCommand: 'post',
                        moduleCodename: 'CertificateIssuePostingModule'
                    },
                    {
                        codename: 'RevokeCertificate',
                        from: ['Issued'],
                        to: 'Revoked',
                        requiredCapabilities: ['certificate.revoke'],
                        postingCommand: 'post',
                        moduleCodename: 'CertificateIssuePostingModule'
                    }
                ]
            },
            {
                entityCodename: 'DevelopmentPlanTasks',
                actions: [
                    {
                        codename: 'StartDevelopmentTask',
                        from: ['NotStarted'],
                        to: 'InProgress',
                        requiredCapabilities: ['development.task.update']
                    },
                    {
                        codename: 'CompleteDevelopmentTask',
                        from: ['InProgress'],
                        to: 'Completed',
                        requiredCapabilities: ['development.task.update']
                    },
                    {
                        codename: 'ReopenDevelopmentTask',
                        from: ['Completed'],
                        to: 'InProgress',
                        requiredCapabilities: ['development.task.update']
                    }
                ]
            },
            {
                entityCodename: 'NotificationOutbox',
                actions: [
                    {
                        codename: 'MarkNotificationSent',
                        from: ['Queued', 'Failed'],
                        to: 'Sent',
                        requiredCapabilities: ['notification.deliver'],
                        postingCommand: 'post'
                    },
                    {
                        codename: 'MarkNotificationFailed',
                        from: ['Queued'],
                        to: 'Failed',
                        requiredCapabilities: ['notification.deliver']
                    },
                    {
                        codename: 'CancelNotification',
                        from: ['Queued', 'Failed'],
                        to: 'Cancelled',
                        requiredCapabilities: ['notification.manage'],
                        postingCommand: 'void'
                    }
                ]
            },
            {
                entityCodename: 'PointTransactions',
                actions: [
                    {
                        codename: 'ApprovePointAdjustment',
                        from: ['Pending'],
                        to: 'Approved',
                        requiredCapabilities: ['gamification.points.adjust'],
                        postingCommand: 'post',
                        moduleCodename: 'PointTransactionPostingModule'
                    },
                    {
                        codename: 'ReversePointAdjustment',
                        from: ['Approved'],
                        to: 'Reversed',
                        requiredCapabilities: ['gamification.points.adjust'],
                        postingCommand: 'void',
                        moduleCodename: 'PointTransactionPostingModule'
                    }
                ]
            },
            {
                entityCodename: 'BadgeIssues',
                actions: [
                    {
                        codename: 'IssueBadge',
                        from: ['Eligible'],
                        to: 'Issued',
                        requiredCapabilities: ['badge.issue']
                    },
                    {
                        codename: 'RevokeBadge',
                        from: ['Issued'],
                        to: 'Revoked',
                        requiredCapabilities: ['badge.revoke']
                    }
                ]
            }
        ]
        for (const { entityCodename, actions } of workflowExpectations) {
            const workflowActions = entityByCodename.get(entityCodename)?.config?.workflowActions
            expect(Array.isArray(workflowActions)).toBe(true)
            for (const expectedAction of actions) {
                expect(workflowActions).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            codename: expectedAction.codename,
                            from: expectedAction.from,
                            to: expectedAction.to,
                            statusFieldCodename: 'Status',
                            requiredCapabilities: expectedAction.requiredCapabilities,
                            ...(expectedAction.postingCommand ? { postingCommand: expectedAction.postingCommand } : {}),
                            ...(expectedAction.moduleCodename ? { moduleCodename: expectedAction.moduleCodename } : {})
                        })
                    ])
                )
            }
            for (const action of workflowActions ?? []) {
                expect(() => workflowActionSchema.parse(action)).not.toThrow()
            }
        }
        expect(manifest.seed.modules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    codename: 'EnrollmentPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'Enrollments',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'QuizAttemptPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'QuizAttempts',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'ContentCompletionPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'ContentProgress',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'CertificateIssuePostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'CertificateIssues',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                }),
                expect.objectContaining({
                    codename: 'PointTransactionPostingModule',
                    attachedToKind: 'object',
                    attachedToEntityCodename: 'PointTransactions',
                    moduleRole: 'lifecycle',
                    capabilities: expect.arrayContaining(['lifecycle', 'posting', 'ledger.write'])
                })
            ])
        )
        expect(manifest.seed.entities.find((entity) => entity.codename === 'LearnerHome')).toEqual(
            expect.objectContaining({
                kind: 'page',
                name: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({ content: 'Welcome' }),
                        ru: expect.objectContaining({ content: 'Добро пожаловать' })
                    })
                })
            })
        )
        for (const codename of [
            'CourseOverview',
            'KnowledgeHome',
            'KnowledgeArticle',
            'DevelopmentHome',
            'AssignmentInstructions',
            'CertificatePolicy'
        ]) {
            const pageEntity = entityByCodename.get(codename)
            expect(pageEntity).toEqual(
                expect.objectContaining({
                    kind: 'page'
                })
            )
            expect(pageEntity?.config).toMatchObject({
                blockContent: expect.objectContaining({
                    format: 'editorjs',
                    blocks: expect.arrayContaining([
                        expect.objectContaining({ type: 'header' }),
                        expect.objectContaining({ type: 'paragraph' })
                    ])
                }),
                runtime: expect.objectContaining({
                    menuVisibility: 'secondary'
                })
            })
        }
        expect(manifest.seed.entities.find((entity) => entity.codename === 'LmsConfiguration')).toEqual(
            expect.objectContaining({
                kind: 'set',
                fixedValues: expect.arrayContaining([
                    expect.objectContaining({ codename: 'DefaultPassingScore', value: 80 }),
                    expect.objectContaining({ codename: 'CertificateValidityDays', value: 365 }),
                    expect.objectContaining({ codename: 'SupportEmail', value: '' }),
                    expect.objectContaining({ codename: 'GamificationEnabled', value: true }),
                    expect.objectContaining({ codename: 'DefaultPointAward', value: 10 })
                ])
            })
        )
    })

    it('rejects layoutZoneWidgets references to unknown layouts', () => {
        const manifest = cloneTemplate(basicTemplate)
        const firstWidgets = Object.values(manifest.seed.layoutZoneWidgets)[0] ?? []

        manifest.seed.layoutZoneWidgets.unknown_layout = firstWidgets

        expect(() => validateTemplateManifest(manifest)).toThrow(/unknown layout codename/i)
    })

    it('rejects non-embedded seed module source kinds while template seeding is inline-only', () => {
        const manifest = cloneTemplate(lmsTemplate)
        const firstModule = manifest.seed.modules?.[0]
        expect(firstModule).toBeDefined()
        if (firstModule) {
            firstModule.sourceKind = 'external' as never
        }

        expect(() => validateTemplateManifest(manifest)).toThrow()
    })

    it('rejects ambiguous elements references when entity codename is duplicated across kinds', () => {
        const manifest = cloneTemplate(basicTemplate)
        manifest.seed.entities = [
            {
                codename: 'tags',
                kind: 'object',
                name: cloneTemplate(basicTemplate.name)
            }
        ]
        manifest.seed.elements = {
            tags: [{ codename: 'one', data: { label: 'One' }, sortOrder: 0 }]
        }
        const existingEntity = manifest.seed.entities[0]

        manifest.seed.entities.push({
            ...existingEntity,
            kind: existingEntity.kind === 'object' ? 'hub' : 'object'
        })

        expect(() => validateTemplateManifest(manifest)).toThrow(/ambiguous/i)
    })

    it('rejects entity presets with invalid component dependency combinations', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.events = { enabled: true }
        manifest.entityType.capabilities.actions = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/actions/i)
    })

    it('accepts custom resource surface keys when the capability contract stays valid', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'components',
                fallbackTitle: 'Components'
            }
        ]

        expect(() => validateEntityTypePresetManifest(manifest)).not.toThrow()
    })

    it('rejects resource surfaces that target disabled capabilities', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.dataSchema = false

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/requires the matching entity component/i)
    })

    it('rejects duplicate resource surface route segments in entity presets', () => {
        const manifest = cloneTemplate(objectEntityPreset)
        manifest.entityType.capabilities.optionValues = { enabled: true }
        manifest.entityType.ui.resourceSurfaces = [
            {
                key: 'components',
                capability: 'dataSchema',
                routeSegment: 'shared-tab',
                fallbackTitle: 'Components'
            },
            {
                key: 'values',
                capability: 'optionValues',
                routeSegment: 'shared-tab',
                fallbackTitle: 'Values'
            }
        ]

        expect(() => validateEntityTypePresetManifest(manifest)).toThrow(/Duplicate resource surface routeSegment/i)
    })
})
