import { describe, expect, it } from 'vitest'
import { decodeWidgetConfigEnvelope, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'

import {
    validateMarketingSnapshotLayouts,
    validateMarketingSnapshotTransportLayouts,
    validateSnapshotLayoutIdentities,
    validateSnapshotLayoutNeutralMetadata
} from '../marketingSnapshot'
import { findInvalidWidgetBindingRecordComponent } from '../marketingSnapshotRecordValidation'
import {
    boundWidgetConfig,
    collectionWidget,
    createSnapshot,
    entities,
    getHeroRecordData,
    heroWidget,
    ids,
    localizedVlc,
    validBoundRecordData
} from './marketingSnapshot.fixtures'

describe('validateMarketingSnapshotLayouts', () => {
    it.each(['/sample-path', '#pricing', 'HTTPS://example.test/docs', 'mailto:sales@example.test?subject=Hello', 'tel:+1 (555) 010-1234'])(
        'accepts safe bound navigation hrefs in snapshots',
        (href) => {
            const slot = getLayoutWidgetDefinition('marketing.navigation')?.bindingSlots?.[0]
            if (!slot) throw new Error('Expected a Marketing navigation binding slot')
            const data = validBoundRecordData(slot.requirements.components)
            data.Href = href

            expect(findInvalidWidgetBindingRecordComponent([{ data }], slot.requirements.components)).toBeUndefined()
        }
    )

    it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://user:pass@example.test'])(
        'rejects unsafe or malformed bound navigation hrefs in snapshots',
        (href) => {
            const slot = getLayoutWidgetDefinition('marketing.navigation')?.bindingSlots?.[0]
            if (!slot) throw new Error('Expected a Marketing navigation binding slot')
            const data = validBoundRecordData(slot.requirements.components)
            data.Href = href

            expect(findInvalidWidgetBindingRecordComponent([{ data }], slot.requirements.components)).toMatchObject({
                recordIndex: 0,
                componentCodename: 'Href'
            })
        }
    )

    it.each([
        ['missing', undefined],
        ['runtime-writable', { ...entities[ids.heroEntity].config!.recordPolicy!, runtimeMutation: 'allow' }],
        ['deletable while bound', { ...entities[ids.heroEntity].config!.recordPolicy!, denyDeleteWhenBound: false }],
        ['mutable semantic key', { ...entities[ids.heroEntity].config!.recordPolicy!, immutableSemanticKeyWhenBound: false }],
        [
            'unprotected default key',
            {
                ...entities[ids.heroEntity].config!.recordPolicy!,
                semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['other'] }
            }
        ],
        ['missing required locale', { ...entities[ids.heroEntity].config!.recordPolicy!, requiredLocales: ['en'] }],
        ['unknown validator', { ...entities[ids.heroEntity].config!.recordPolicy!, validatorKey: 'other.v1' }],
        [
            'mismatched co-required group',
            { ...entities[ids.heroEntity].config!.recordPolicy!, coRequiredGroups: [['TermsText', 'TermsLinkLabel']] }
        ]
    ])('rejects a Hero binding Entity with a %s record policy', (_label, policy) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities?.[ids.heroEntity]
        if (heroEntity) {
            const config = (heroEntity.config ?? {}) as Record<string, unknown>
            heroEntity.config = { ...config, ...(policy === undefined ? {} : { recordPolicy: policy }) }
            if (policy === undefined) delete (heroEntity.config as Record<string, unknown>).recordPolicy
        }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Entity record policy')
    })

    it('accepts valid repeatable collection widgets', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([
                    collectionWidget(ids.widget, 'logos'),
                    collectionWidget(ids.secondWidget, 'features', 'MarketingPageFeature')
                ])
            )
        ).not.toThrow()
    })

    it('rejects snapshot bindings that exceed the runtime record limit', () => {
        const snapshot = createSnapshot()
        const slot = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })?.bindingSlots?.find(
            ({ key }) => key === 'items'
        )
        if (!slot?.maxResolvedRecords) throw new Error('Expected a bounded collection item slot')
        const semanticKeyComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey)
        const sourceRows = snapshot.elements?.logos
        const firstRow = Array.isArray(sourceRows) ? sourceRows[0] : undefined
        if (!semanticKeyComponent || !firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
            throw new Error('Expected a seeded logo record fixture')
        }
        const firstData = (firstRow as Record<string, unknown>).data
        if (!firstData || typeof firstData !== 'object' || Array.isArray(firstData)) throw new Error('Expected logo record data')

        snapshot.elements!.logos = Array.from({ length: slot.maxResolvedRecords + 1 }, (_, index) => ({
            id: `0190a9b5-3cde-7abc-8def-${String(index + 1).padStart(12, '0')}`,
            data: {
                ...(firstData as Record<string, unknown>),
                [semanticKeyComponent.componentCodename]: `logo-${index + 1}`
            }
        }))

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('exceeds the registered maximum record count')
    })

    it('rejects malformed selected record values before publication', () => {
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'features', 'MarketingPageFeature')])
        const records = snapshot.elements?.features
        expect(Array.isArray(records)).toBe(true)
        const firstRecord = (records as Array<Record<string, unknown>>)[0]
        const data = firstRecord.data as Record<string, unknown>
        data.Title = { en: 42, ru: 'Функция' }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot bound record data is invalid')
    })

    it('rejects missing required Components on selected records before publication', () => {
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'features', 'MarketingPageFeature')])
        const records = snapshot.elements?.features as Array<Record<string, unknown>>
        const data = records[0]?.data as Record<string, unknown>
        delete data.Description

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot bound record data is invalid')
    })

    it('rejects selected record values that do not match their Component data types', () => {
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'features', 'MarketingPageFeature')])
        const records = snapshot.elements?.features as Array<Record<string, unknown>>
        const data = records[0]?.data as Record<string, unknown>
        data.SortOrder = '1'

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot bound record data is invalid')
    })

    it('rejects unsafe formatted media references before publication', () => {
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'logos')])
        const records = snapshot.elements?.logos as Array<Record<string, unknown>>
        const data = records[0]?.data as Record<string, unknown>
        data.ImageLight = { type: 'url', url: 'javascript:alert(1)' }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot bound record data is invalid')
    })

    it('validates data on relation-set child records before publication', () => {
        const snapshot = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: boundWidgetConfig(
                    'marketing.pricing',
                    { instanceKey: 'pricing', showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                isActive: true
            }
        ])
        const benefits = snapshot.elements?.benefits as Array<Record<string, unknown>>
        const data = benefits[0]?.data as Record<string, unknown>
        const tiers = snapshot.elements?.pricing as Array<Record<string, unknown>>
        expect(data.TierRef).toBe(tiers[0]?.id)
        data.Label = { en: 'Benefit', ru: 42 }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot bound record data is invalid')
    })

    it.each([
        ['targetEntityId', ids.heroEntity],
        ['targetEntityKind', 'set']
    ] as const)('rejects a relation REF Component with a mismatched %s before publication', (property, value) => {
        const snapshot = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: boundWidgetConfig(
                    'marketing.pricing',
                    { instanceKey: 'pricing', showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                isActive: true
            }
        ])
        const relationEntity = snapshot.entities?.benefits as Record<string, unknown>
        const fields = relationEntity.fields as Array<Record<string, unknown>>
        const relationField = fields.find(({ codename }) => codename === 'TierRef')
        if (!relationField) throw new Error('Relation REF Component fixture is missing')
        relationField[property] = value

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot relation Component targets another Entity')
    })

    it('ignores relation records whose parent is excluded by the parent visibility selector', () => {
        const snapshot = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: boundWidgetConfig(
                    'marketing.pricing',
                    { instanceKey: 'pricing', showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                isActive: true
            }
        ])
        const tiers = snapshot.elements?.pricing as Array<Record<string, unknown>>
        const benefits = snapshot.elements?.benefits as Array<Record<string, unknown>>
        const selectedTier = tiers[0]
        const selectedBenefit = benefits[0]
        if (!selectedTier || !selectedBenefit) throw new Error('Expected pricing relation fixtures')

        const hiddenTierId = '0190a9b5-3cde-7abc-8def-0123456789b1'
        tiers.push({
            id: hiddenTierId,
            data: { ...(selectedTier.data as Record<string, unknown>), TierKey: 'hidden-tier', SortOrder: 2, IsVisible: false }
        })
        benefits.push({
            id: '0190a9b5-3cde-7abc-8def-0123456789b2',
            data: { ...(selectedBenefit.data as Record<string, unknown>), BenefitKey: 'hidden-tier-benefit', TierRef: hiddenTierId }
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('accepts an empty Pricing relation-set when every parent tier is hidden', () => {
        const snapshot = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: boundWidgetConfig(
                    'marketing.pricing',
                    { instanceKey: 'pricing', showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                isActive: true
            }
        ])
        const tiers = snapshot.elements?.pricing as Array<Record<string, unknown>>
        for (const tier of tiers) {
            const data = tier.data as Record<string, unknown>
            data.IsVisible = false
        }

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('accepts an Entity-backed image widget without renderer-owned media', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: boundWidgetConfig(
                'marketing.image',
                { instanceKey: 'hero-image' },
                { content: 'MarketingPageImage' },
                { content: 'hero-image' }
            ),
            isActive: true
        }

        expect(() => validateMarketingSnapshotLayouts(createSnapshot([collectionWidget(ids.widget, 'logos'), image]))).not.toThrow()
    })

    it('accepts a bound Marketing Image record with an empty optional ResourceSource', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: boundWidgetConfig(
                'marketing.image',
                { instanceKey: 'hero-image' },
                { content: 'MarketingPageImage' },
                { content: 'hero-image' }
            ),
            isActive: true
        }
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'logos'), image])
        const imageEntity = Object.entries(snapshot.entities ?? {}).find(([, entity]) => entity.codename === 'MarketingPageImage')
        if (!imageEntity) throw new Error('Expected the Image binding Entity fixture')
        const records = snapshot.elements?.[imageEntity[0]]
        if (!Array.isArray(records) || !records[0] || typeof records[0] !== 'object') {
            throw new Error('Expected the bound Image record fixture')
        }
        const data = (records[0] as { data: Record<string, unknown> }).data
        data.Resource = null

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects nondecorative snapshot images without complete alternative text', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: boundWidgetConfig(
                'marketing.image',
                { instanceKey: 'hero-image' },
                { content: 'MarketingPageImage' },
                { content: 'hero-image' }
            ),
            isActive: true
        }
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'logos'), image])
        const imageEntity = Object.entries(snapshot.entities ?? {}).find(([, entity]) => entity.codename === 'MarketingPageImage')
        if (!imageEntity) throw new Error('Expected the Image binding Entity fixture')
        const records = snapshot.elements?.[imageEntity[0]]
        if (!Array.isArray(records) || !records[0] || typeof records[0] !== 'object') {
            throw new Error('Expected the bound Image record fixture')
        }
        const data = (records[0] as { data: Record<string, unknown> }).data
        data.Decorative = false
        delete data.AltText

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('rejects nondecorative snapshot images with English-only alternative text', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: boundWidgetConfig(
                'marketing.image',
                { instanceKey: 'hero-image' },
                { content: 'MarketingPageImage' },
                { content: 'hero-image' }
            ),
            isActive: true
        }
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'logos'), image])
        const imageEntity = Object.entries(snapshot.entities ?? {}).find(([, entity]) => entity.codename === 'MarketingPageImage')
        if (!imageEntity) throw new Error('Expected the Image binding Entity fixture')
        const records = snapshot.elements?.[imageEntity[0]]
        if (!Array.isArray(records) || !records[0] || typeof records[0] !== 'object') {
            throw new Error('Expected the bound Image record fixture')
        }
        const data = (records[0] as { data: Record<string, unknown> }).data
        data.Decorative = false
        data.AltText = localizedVlc('A descriptive image')

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('accepts decorative snapshot images with intentionally empty alternative text', () => {
        const image = {
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            sortOrder: 1,
            config: boundWidgetConfig(
                'marketing.image',
                { instanceKey: 'hero-image' },
                { content: 'MarketingPageImage' },
                { content: 'hero-image' }
            ),
            isActive: true
        }
        const snapshot = createSnapshot([collectionWidget(ids.widget, 'logos'), image])
        const imageEntity = Object.entries(snapshot.entities ?? {}).find(([, entity]) => entity.codename === 'MarketingPageImage')
        if (!imageEntity) throw new Error('Expected the Image binding Entity fixture')
        const records = snapshot.elements?.[imageEntity[0]]
        if (!Array.isArray(records) || !records[0] || typeof records[0] !== 'object') {
            throw new Error('Expected the bound Image record fixture')
        }
        const data = (records[0] as { data: Record<string, unknown> }).data
        data.Decorative = true
        data.AltText = localizedVlc('', '')

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it.each(['source', 'copySource'] as const)('rejects legacy marketing %s renderer configuration', (field) => {
        const snapshot = createSnapshot()
        const widget = snapshot.layoutZoneWidgets?.[0]
        if (!widget) throw new Error('Expected marketing collection widget')
        const decoded = decodeWidgetConfigEnvelope(widget.config, {
            templateKey: 'marketing-page',
            widgetKey: 'marketing.collection',
            zone: 'marketing-main',
            requireBindings: true
        })
        widget.config = encodeWidgetConfigEnvelope(
            {
                rendererConfig: {
                    ...decoded.rendererConfig,
                    [field]: { entityKind: 'object', entityCodename: 'MarketingPageLogo' }
                },
                neutral: decoded.neutral
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.collection', zone: 'marketing-main' }
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing snapshot widget configuration is invalid')
    })

    it('rejects an empty or inactive marketing composition', () => {
        expect(() => validateMarketingSnapshotLayouts(createSnapshot([]))).toThrow('at least one active widget')

        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.isActive = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('at least one active widget')
    })

    it('requires the referenced global layout to be explicitly default and active', () => {
        const snapshot = createSnapshot()
        snapshot.layouts![0]!.isDefault = false
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('active and marked as default')
    })

    it('accepts repeated widget keys and rejects duplicate instance keys', () => {
        expect(() =>
            validateMarketingSnapshotLayouts(createSnapshot([heroWidget(ids.widget, 'hero'), heroWidget(ids.secondWidget, 'hero-second')]))
        ).not.toThrow()
        expect(() =>
            validateMarketingSnapshotLayouts(
                createSnapshot([collectionWidget(ids.widget, 'same'), collectionWidget(ids.secondWidget, 'same')])
            )
        ).toThrow('duplicate widget instance keys')
    })

    it('requires a registered Entity binding for every Hero placement', () => {
        const missingBinding = createSnapshot([
            {
                ...heroWidget(ids.widget, 'hero'),
                config: { instanceKey: 'hero', showLeadForm: true }
            }
        ])
        expect(() => validateMarketingSnapshotLayouts(missingBinding)).toThrow('widget binding is invalid')

        const v3Binding = createSnapshot([heroWidget(ids.widget, 'hero')])
        v3Binding.versionEnvelope = { snapshotFormatVersion: 3 }
        expect(() => validateMarketingSnapshotLayouts(v3Binding)).not.toThrow()

        const missingEntity = createSnapshot([heroWidget(ids.widget, 'hero')])
        delete missingEntity.entities?.[ids.heroEntity]
        expect(() => validateMarketingSnapshotLayouts(missingEntity)).toThrow('binding entity is missing')
    })

    it('requires the bound semantic selector to resolve to exactly one snapshot record', () => {
        const missingTarget = createSnapshot([heroWidget(ids.widget, 'hero')])
        missingTarget.elements![ids.heroEntity] = []
        expect(() => validateMarketingSnapshotLayouts(missingTarget)).toThrow('binding target record is missing')

        const duplicateTarget = createSnapshot([heroWidget(ids.widget, 'hero')])
        duplicateTarget.elements![ids.heroEntity] = [{ data: { HeroKey: 'default' } }, { data: { HeroKey: 'default' } }]
        expect(() => validateMarketingSnapshotLayouts(duplicateTarget)).toThrow('binding target record is missing or ambiguous')
    })

    it.each([
        ['required Title', 'Title'],
        ['authored optional Accent', 'Accent']
    ])('rejects a bound Hero record whose %s omits a required locale', (_label, codename) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        getHeroRecordData(snapshot)[codename] = localizedVlc('English only')

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('accepts null values for optional bound Hero fields', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const data = getHeroRecordData(snapshot)
        data.Accent = null
        data.TermsText = null
        data.TermsLinkLabel = null
        data.TermsAction = null

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects malformed bound Hero actions without including their content in the error', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const invalidAction = { kind: 'external', url: 'javascript:alert("private")' }
        getHeroRecordData(snapshot).PrimaryAction = invalidAction

        let errorMessage = ''
        try {
            validateMarketingSnapshotLayouts(snapshot)
        } catch (error) {
            errorMessage = `${(error as Error).message} ${JSON.stringify((error as { details?: unknown }).details)}`
        }

        expect(errorMessage).toContain('bound record data is invalid')
        expect(errorMessage).not.toContain('javascript:alert')
    })

    it('rejects an incomplete optional Hero terms group', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        delete getHeroRecordData(snapshot).TermsAction

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('bound record data is invalid')
    })

    it('rejects bound Entities whose Components do not satisfy the registered slot contract', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => (field.codename === 'Title' ? { ...field, dataType: 'NUMBER' } : field))
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects a bound Hero Entity whose required Component is nested', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) =>
            field.codename === 'PrimaryAction' ? { ...field, parentComponentId: ids.scopeEntity } : field
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects bound optional Components that are marked required by the Entity', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => (field.codename === 'Accent' ? { ...field, isRequired: true } : field))

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it.each(['PrimaryAction', 'TermsAction'])('rejects a bound Hero %s Component without its registered validator format', (codename) => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) =>
            field.codename === codename
                ? { ...field, validationRules: { ...(field.validationRules as Record<string, unknown>), format: 'untrusted' } }
                : field
        )

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('rejects a bound Hero action Component that omits its registered validator format', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const heroEntity = snapshot.entities![ids.heroEntity] as { fields: Array<Record<string, unknown>> }
        heroEntity.fields = heroEntity.fields.map((field) => {
            if (field.codename !== 'PrimaryAction') return field
            const validationRules = { ...(field.validationRules as Record<string, unknown>) }
            delete validationRules.format
            return { ...field, validationRules }
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Component does not match its registered contract')
    })

    it('accepts binding-free Marketing renderer and placement deltas', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'hero')])
        const authConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'auth', showAuthActions: true }, neutral: { placement: 'end' } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.auth', zone: 'marketing-header' }
        )
        const authOverrideConfig = encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'auth', showAuthActions: false }, neutral: { placement: 'start' } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.auth', zone: 'marketing-header' }
        )
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 1,
            config: authConfig,
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                zone: 'marketing-main',
                config: { instanceKey: 'hero', showLeadForm: false },
                isDeletedOverride: false
            },
            {
                id: ids.secondOverride,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.secondWidget,
                zone: 'marketing-header',
                config: authOverrideConfig,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).not.toThrow()

        snapshot.layoutWidgetOverrides[0]!.config = heroWidget(ids.secondWidget, 'hero').config
        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).toThrow('cannot contain entity bindings')
    })

    it('rejects Entity-backed Marketing widgets stored directly on a scoped overlay layout', () => {
        const snapshot = createSnapshot([heroWidget(ids.widget, 'base-hero')])
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutZoneWidgets!.push({
            ...heroWidget(ids.secondWidget, 'overlay-owned-hero'),
            layoutId: ids.scopedLayout
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('Marketing overlay widgets cannot own Entity bindings')
        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).toThrow('Marketing overlay widgets cannot own Entity bindings')
    })

    it('rejects missing source entities, invalid zones, and non-v7 identifiers', () => {
        const missingSource = createSnapshot()
        delete missingSource.entities?.logos
        expect(() => validateMarketingSnapshotLayouts(missingSource)).toThrow('binding entity is missing')

        const invalidZone = createSnapshot()
        invalidZone.layoutZoneWidgets![0]!.zone = 'marketing-footer'
        expect(() => validateMarketingSnapshotLayouts(invalidZone)).toThrow('placement is invalid')

        const invalidId = createSnapshot()
        invalidId.layouts![0]!.id = '0190a9b5-3cde-4abc-8def-0123456789a1'
        invalidId.defaultLayoutId = invalidId.layouts![0]!.id
        invalidId.layoutZoneWidgets![0]!.layoutId = invalidId.layouts![0]!.id
        expect(() => validateMarketingSnapshotLayouts(invalidId)).toThrow('UUID v7')
    })

    it('rejects a non-UUID-v7 source lineage reference before sync', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = 'source-widget'

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('widget source base id')
    })

    it('rejects a UUID-v7 source lineage reference that is not a valid scoped overlay relation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.sourceBaseWidgetId = ids.secondWidget

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('source base reference is invalid')
    })

    it('validates scoped layouts and override targets against the global composition', () => {
        const missingComposition = createSnapshot()
        missingComposition.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(missingComposition)).toThrow('composition mode')

        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]
        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.layoutWidgetOverrides![0]!.baseWidgetId = ids.secondWidget
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('missing global widget')
    })

    it('accepts independent marketing composition without a base layout', () => {
        const snapshot = createSnapshot()
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: null,
                compositionMode: 'independent',
                templateKey: 'marketing-page',
                name: { en: 'Independent marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutZoneWidgets![0]!.layoutId = ids.scopedLayout

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()

        snapshot.scopedLayouts[0]!.baseLayoutId = ids.layout
        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow('null base layout id')
    })

    it('accepts dashboard and marketing layouts in one snapshot', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
        expect(() => validateSnapshotLayoutIdentities(snapshot)).not.toThrow()
    })

    it('accepts shared template widgets inside a marketing layout', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: {},
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('accepts the authentication header widget without a content source', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'marketing.auth',
            sortOrder: 1,
            config: { instanceKey: 'auth', showAuthActions: true },
            isActive: true
        })

        expect(() => validateMarketingSnapshotLayouts(snapshot)).not.toThrow()
    })

    it('rejects a scoped override whose base widget belongs to another global layout', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.layout,
                compositionMode: 'overlay',
                templateKey: 'marketing-page',
                name: { en: 'Scoped marketing page' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.secondWidget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateSnapshotLayoutIdentities(snapshot)).toThrow('wrong layout')
    })

    it('rejects a dashboard scoped override with a foreign base widget in mixed templates', () => {
        const snapshot = createSnapshot()
        snapshot.layouts!.unshift({
            id: ids.secondLayout,
            templateKey: 'dashboard',
            name: { en: 'Dashboard' },
            config: {},
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            compositionMode: 'independent',
            baseLayoutId: null
        })
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.secondLayout,
            zone: 'center',
            widgetKey: 'overviewTitle',
            sortOrder: 0,
            config: {},
            isActive: true
        })
        snapshot.scopedLayouts = [
            {
                id: ids.scopedLayout,
                scopeEntityId: ids.scopeEntity,
                baseLayoutId: ids.secondLayout,
                compositionMode: 'overlay',
                templateKey: 'dashboard',
                name: { en: 'Scoped dashboard' },
                config: {},
                isDefault: false,
                isActive: true,
                sortOrder: 0
            }
        ]
        snapshot.layoutWidgetOverrides = [
            {
                id: ids.override,
                layoutId: ids.scopedLayout,
                baseWidgetId: ids.widget,
                isDeletedOverride: false
            }
        ]

        expect(() => validateMarketingSnapshotLayouts(snapshot)).toThrow(
            'Dashboard widget override base widget belongs to the wrong layout'
        )
    })

    it('requires pricing benefits when pricing widget benefits are enabled', () => {
        const pricing = createSnapshot([
            {
                id: ids.widget,
                layoutId: ids.layout,
                zone: 'marketing-main',
                widgetKey: 'marketing.pricing',
                sortOrder: 0,
                config: boundWidgetConfig(
                    'marketing.pricing',
                    { instanceKey: 'pricing', showBenefits: true },
                    {
                        section: 'MarketingPageSection',
                        tiers: 'MarketingPagePricing',
                        benefits: 'MarketingPagePricingBenefit'
                    },
                    { section: 'pricing' }
                ),
                isActive: true
            }
        ])
        delete pricing.entities?.benefits
        expect(() => validateMarketingSnapshotLayouts(pricing)).toThrow('binding entity is missing')
    })
})

describe('validateMarketingSnapshotTransportLayouts', () => {
    it('rejects plain widgets with an unsupported template zone before render validation', () => {
        const snapshot = createSnapshot()
        snapshot.layoutZoneWidgets![0]!.zone = 'marketing-footer'

        expect(() => validateSnapshotLayoutNeutralMetadata(snapshot)).toThrow('Snapshot widget configuration is invalid')
    })

    it('validates neutral layout metadata and strips it before renderer validation', () => {
        const snapshot = createSnapshot()
        const neutralLayoutConfig = {
            __layout: {
                zoneSettings: {
                    'marketing-header': { position: 'flow' }
                }
            }
        }
        snapshot.layouts![0]!.config = neutralLayoutConfig
        snapshot.layoutConfig = neutralLayoutConfig
        snapshot.layoutZoneWidgets!.push({
            id: ids.secondWidget,
            layoutId: ids.layout,
            zone: 'marketing-header',
            widgetKey: 'languageSwitcher',
            sortOrder: 1,
            config: { __layout: { placement: 'end' } },
            isActive: true
        })

        expect(() => validateMarketingSnapshotTransportLayouts(snapshot)).not.toThrow()
    })

    it('fails closed on application-only or duplicated transport metadata', () => {
        const sourceSettings = createSnapshot()
        sourceSettings.layouts![0]!.config = {
            __layout: {
                sourceZoneSettings: {
                    'marketing-header': { position: 'fixed' }
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(sourceSettings)).toThrow('application-only source zone settings')

        const duplicatedComposition = createSnapshot()
        duplicatedComposition.layouts![0]!.config = {
            __layout: {
                composition: {
                    mode: 'independent',
                    baseLayoutId: null
                }
            }
        }
        expect(() => validateMarketingSnapshotTransportLayouts(duplicatedComposition)).toThrow(
            'must not duplicate top-level composition metadata'
        )
    })

    it('fails closed on null layout and widget config envelopes', () => {
        const nullLayoutConfig = createSnapshot()
        nullLayoutConfig.layouts![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullLayoutConfig)).toThrow('neutral metadata is invalid')

        const nullWidgetConfig = createSnapshot()
        nullWidgetConfig.layoutZoneWidgets![0]!.config = null as never
        expect(() => validateMarketingSnapshotTransportLayouts(nullWidgetConfig)).toThrow('widget configuration is invalid')
    })
})
