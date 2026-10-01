import {
    ComponentDefinitionDataType,
    entityRecordPolicySchema,
    getLayoutWidgetDefinition,
    MARKETING_SEMANTIC_KEY_PATTERN,
    type EntityRecordPolicy,
    type WidgetBindingComponentRequirement,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import {
    assertEntityMetadataSecurityUpdate,
    assertWidgetBindingComponentMutation,
    isEntityMetadataPolicyManaged,
    isWidgetBindingComponentCodename,
    isWidgetBindingEntityMetadata
} from '../../domains/shared/entityMetadataMutationPolicy'

const getSlot = (widgetKey: string, slotKey: string, variant?: string): WidgetBindingSlotDefinition => {
    const definition = getLayoutWidgetDefinition(widgetKey, variant ? { variant } : undefined)
    const slot = definition?.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new Error('Missing registered slot ' + widgetKey + '.' + slotKey)
    return slot
}

const getPolicy = (widgetKey: string, slotKey: string, variant?: string): EntityRecordPolicy => {
    const recordPolicy = getSlot(widgetKey, slotKey, variant).requirements.recordPolicy
    if (!recordPolicy) throw new Error('Missing record policy for ' + widgetKey + '.' + slotKey)
    return entityRecordPolicySchema.parse({ version: 1, ...recordPolicy })
}

const componentFromRequirement = (requirement: WidgetBindingComponentRequirement) => {
    const dataTypes = {
        string: ComponentDefinitionDataType.STRING,
        number: ComponentDefinitionDataType.NUMBER,
        boolean: ComponentDefinitionDataType.BOOLEAN,
        json: ComponentDefinitionDataType.JSON,
        ref: ComponentDefinitionDataType.REF
    } as const

    return {
        codename: requirement.componentCodename,
        dataType: dataTypes[requirement.valueType],
        isRequired: requirement.required,
        validationRules: {
            localized: requirement.localized,
            ...(requirement.maxLength !== undefined ? { maxLength: requirement.maxLength } : {}),
            ...(requirement.semanticKey ? { unique: true, pattern: MARKETING_SEMANTIC_KEY_PATTERN.source } : {}),
            ...(requirement.format ? { format: requirement.format } : {})
        },
        parentComponentId: null
    }
}

const heroPolicy = getPolicy('marketing.hero', 'content')
const heroConfig = { recordBehavior: 'reference', marketingRole: 'hero', recordPolicy: heroPolicy }

describe('Entity metadata mutation policy', () => {
    it.each([
        { codename: 'MarketingPageHero', role: 'hero', widgetKey: 'marketing.hero', slotKey: 'content' },
        { codename: 'MarketingPageImage', role: 'image', widgetKey: 'marketing.image', slotKey: 'content' },
        { codename: 'MarketingPageSection', role: 'section', widgetKey: 'marketing.collection', slotKey: 'section', variant: 'logos' },
        { codename: 'MarketingPageSiteSettings', role: 'siteSettings', widgetKey: 'marketing.brand', slotKey: 'site' }
    ])('protects registry-owned record policies for $codename', ({ codename, role, widgetKey, slotKey, variant }) => {
        const policy = getPolicy(widgetKey, slotKey, variant)
        const config = { recordBehavior: 'reference', marketingRole: role, recordPolicy: policy }

        expect(isEntityMetadataPolicyManaged(codename, config)).toBe(true)
        expect(isWidgetBindingEntityMetadata(codename, config)).toBe(true)
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename,
                config,
                configPatch: { ...config, recordPolicy: { ...policy, runtimeMutation: 'allow' } }
            })
        ).toThrow('Entity record policies are managed by the platform.')
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename,
                config,
                configPatch: { ...config, recordPolicy: policy }
            })
        ).not.toThrow()
    })

    it('rejects removing a template source role or required registry policy', () => {
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageHero',
                config: heroConfig,
                configPatch: { marketingRole: null, recordBehavior: 'reference', recordPolicy: heroPolicy }
            })
        ).toThrow('source role is managed by the template')

        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageImage',
                config: { recordBehavior: 'reference', marketingRole: 'image' }
            })
        ).toThrow('record policy is managed by the template')
    })

    it('protects the Marketing Image conditional alternative-text rule from metadata changes', () => {
        const policy = getPolicy('marketing.image', 'content')
        const config = { recordBehavior: 'reference', marketingRole: 'image', recordPolicy: policy }

        expect(policy.conditionalRequired).toEqual([
            { componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: false } }
        ])
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageImage',
                config,
                configPatch: {
                    ...config,
                    recordPolicy: {
                        ...policy,
                        conditionalRequired: [{ componentCodename: 'AltText', when: { componentCodename: 'Decorative', equals: true } }]
                    }
                }
            })
        ).toThrow('Entity record policies are managed by the platform.')
    })

    it('keeps all template source codenames stable while allowing presentation metadata updates', () => {
        const templateSource = {
            recordBehavior: 'reference',
            marketingRole: 'section',
            recordPolicy: getPolicy('marketing.collection', 'section', 'features')
        }
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageSection',
                config: templateSource,
                nextCodename: 'MarketingSections'
            })
        ).toThrow('codename is fixed')
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageSection',
                config: templateSource,
                configPatch: { description: { en: 'Updated description' } }
            })
        ).not.toThrow()
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageSection',
                config: templateSource,
                configPatch: { ...templateSource, description: { en: 'Updated description' } }
            })
        ).not.toThrow()
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'MarketingPageSection',
                config: templateSource,
                configPatch: { ...templateSource, marketingRole: 'pricing' }
            })
        ).toThrow('source role is managed by the template')
    })

    it('protects general Entity record policies without applying Marketing template identity rules', () => {
        const otherPolicy: EntityRecordPolicy = entityRecordPolicySchema.parse({
            version: 1,
            semanticKey: { componentCodename: 'ArticleKey', creationPrefix: 'article', protectedValues: ['home'] },
            denyDeleteWhenBound: true,
            immutableSemanticKeyWhenBound: true,
            runtimeMutation: 'deny'
        })

        expect(isEntityMetadataPolicyManaged('Article', { recordPolicy: otherPolicy })).toBe(true)
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'Article',
                config: { recordPolicy: otherPolicy },
                nextCodename: 'KnowledgeArticle',
                configPatch: { recordPolicy: otherPolicy }
            })
        ).not.toThrow()
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'Article',
                config: {},
                configPatch: { recordPolicy: otherPolicy }
            })
        ).toThrow('Entity record policies are managed by the platform.')
        expect(() =>
            assertEntityMetadataSecurityUpdate({
                codename: 'Article',
                config: { recordPolicy: otherPolicy },
                configPatch: { recordPolicy: { ...otherPolicy, runtimeMutation: 'allow' } }
            })
        ).toThrow('Entity record policies are managed by the platform.')
    })

    it('derives protected Component names from registered slots, including relation and record-set sources', () => {
        for (const codename of ['HeroKey', 'ImageKey', 'LogoKey', 'NavKey', 'TierRef', 'BenefitKey', 'FaqKey']) {
            expect(isWidgetBindingComponentCodename(codename)).toBe(true)
        }
        expect(isWidgetBindingComponentCodename('UnrelatedField')).toBe(false)
    })

    it.each([
        { entityCodename: 'MarketingPageHero', role: 'hero', widgetKey: 'marketing.hero', slotKey: 'content', componentCodename: 'Title' },
        {
            entityCodename: 'MarketingPageImage',
            role: 'image',
            widgetKey: 'marketing.image',
            slotKey: 'content',
            componentCodename: 'Resource',
            policy: getPolicy('marketing.image', 'content')
        },
        {
            entityCodename: 'MarketingPageLogo',
            role: 'logo',
            widgetKey: 'marketing.collection',
            slotKey: 'items',
            componentCodename: 'LogoKey',
            variant: 'logos'
        },
        {
            entityCodename: 'MarketingPagePricingBenefit',
            role: 'pricingBenefit',
            widgetKey: 'marketing.pricing',
            slotKey: 'benefits',
            componentCodename: 'TierRef'
        },
        {
            entityCodename: 'MarketingPageFaq',
            role: 'faq',
            widgetKey: 'marketing.collection',
            slotKey: 'items',
            componentCodename: 'Answer',
            variant: 'faq'
        }
    ])(
        'protects registry-declared $entityCodename binding Components',
        ({ entityCodename, role, widgetKey, slotKey, componentCodename, variant, policy }) => {
            const slot = getSlot(widgetKey, slotKey, variant)
            const requirement = slot.requirements.components.find(({ componentCodename: codename }) => codename === componentCodename)
            if (!requirement) throw new Error('Missing ' + componentCodename + ' requirement in ' + widgetKey + '.' + slotKey)
            const current = componentFromRequirement(requirement)
            const config = {
                marketingRole: role,
                ...(policy ? { recordPolicy: policy } : role === 'hero' ? { recordPolicy: heroPolicy } : {})
            }

            expect(() =>
                assertWidgetBindingComponentMutation({
                    entityCodename,
                    entityConfig: config,
                    isBound: true,
                    current,
                    next: {
                        ...current,
                        dataType:
                            current.dataType === ComponentDefinitionDataType.REF
                                ? ComponentDefinitionDataType.STRING
                                : current.dataType === ComponentDefinitionDataType.JSON
                                ? ComponentDefinitionDataType.STRING
                                : current.dataType,
                        isRequired: !current.isRequired
                    },
                    operation: 'update'
                })
            ).toThrow('registered widget binding contract')
        }
    )

    it('protects a custom source only while a live binding uses its registered Component contract', () => {
        const current = {
            codename: 'Title',
            dataType: ComponentDefinitionDataType.STRING,
            isRequired: true,
            validationRules: { localized: true, maxLength: 255 },
            parentComponentId: null
        }

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomContent',
                entityConfig: {},
                isBound: false,
                current,
                next: { ...current, validationRules: { localized: false, maxLength: 255 } },
                operation: 'update'
            })
        ).not.toThrow()
        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomContent',
                entityConfig: {},
                isBound: true,
                bindingSlots: [getSlot('marketing.hero', 'content')],
                current,
                next: { ...current, validationRules: { localized: false, maxLength: 255 } },
                operation: 'update'
            })
        ).toThrow('registered widget binding contract')
    })

    it('protects the declared REF target of a bound relation-set source', () => {
        const slot = getSlot('marketing.pricing', 'benefits')
        const requirement = slot.requirements.components.find(({ componentCodename }) => componentCodename === 'TierRef')
        if (!requirement) throw new Error('Missing Pricing benefits relation Component')
        const current = {
            ...componentFromRequirement(requirement),
            targetEntityId: '0190a9b5-3cde-7abc-8def-0123456789a1',
            targetEntityKind: 'object'
        }

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomPricingBenefits',
                entityConfig: {},
                isBound: true,
                bindingSlots: [slot],
                current,
                next: { ...current, targetEntityId: '0190a9b5-3cde-7abc-8def-0123456789a2' },
                operation: 'update'
            })
        ).toThrow('registered widget binding contract')

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomPricingBenefits',
                entityConfig: {},
                isBound: true,
                bindingSlots: [slot],
                current,
                next: { ...current },
                operation: 'update'
            })
        ).not.toThrow()
    })

    it('uses active slots ahead of ambiguous policy matches and falls back to policy slots when unbound', () => {
        const activeSlot = getSlot('marketing.brand', 'site')
        const footerSlot = getSlot('marketing.footer', 'site')
        const footerDescriptionRequirement = footerSlot.requirements.components.find(
            ({ componentCodename }) => componentCodename === 'FooterDescription'
        )
        const semanticKeyRequirement = activeSlot.requirements.components.find(({ semanticKey }) => semanticKey === true)
        const policy = activeSlot.requirements.recordPolicy
        if (!footerDescriptionRequirement || !semanticKeyRequirement || !policy) {
            throw new Error('Missing site source contract requirements')
        }

        const unusedByActiveSlot = componentFromRequirement(footerDescriptionRequirement)
        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomSiteContent',
                entityConfig: { recordPolicy: { version: 1, ...policy } },
                isBound: true,
                bindingSlots: [activeSlot],
                current: unusedByActiveSlot,
                next: { ...unusedByActiveSlot, dataType: ComponentDefinitionDataType.JSON },
                operation: 'update'
            })
        ).not.toThrow()

        const semanticKey = componentFromRequirement(semanticKeyRequirement)
        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomSiteContent',
                entityConfig: { recordPolicy: { version: 1, ...policy } },
                isBound: true,
                bindingSlots: [],
                current: semanticKey,
                operation: 'delete'
            })
        ).toThrow('registered widget binding contract')
    })

    it('applies the exact active slot contract when a shared Component codename has different requirements', () => {
        const featureSlot = getSlot('marketing.collection', 'items', 'features')
        const descriptionRequirement = featureSlot.requirements.components.find(
            ({ componentCodename }) => componentCodename === 'Description'
        )
        if (!descriptionRequirement) throw new Error('Missing feature Description binding contract')
        const current = componentFromRequirement(descriptionRequirement)

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomFeatureContent',
                entityConfig: {},
                isBound: true,
                bindingSlots: [featureSlot],
                current,
                next: current,
                operation: 'update'
            })
        ).not.toThrow()

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'CustomFeatureContent',
                entityConfig: {},
                isBound: true,
                bindingSlots: [featureSlot],
                current,
                next: {
                    ...current,
                    validationRules: { ...(current.validationRules as Record<string, unknown>), maxLength: 2000 }
                },
                operation: 'update'
            })
        ).toThrow('registered widget binding contract')
    })

    it('allows compatible presentation-only edits and rejects nested moves of bound source Components', () => {
        const requirement = getSlot('marketing.hero', 'content').requirements.components.find(
            ({ componentCodename }) => componentCodename === 'Title'
        )
        if (!requirement) throw new Error('Missing Hero title component contract')
        const title = componentFromRequirement(requirement)

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                isBound: true,
                current: title,
                next: title,
                operation: 'update'
            })
        ).not.toThrow()

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                isBound: true,
                current: title,
                next: { ...title, parentComponentId: 'nested-table-id' },
                operation: 'move'
            })
        ).toThrow('registered widget binding contract')

        const accent = {
            codename: 'Accent',
            dataType: ComponentDefinitionDataType.STRING,
            isRequired: false,
            validationRules: { localized: true, maxLength: 120 },
            parentComponentId: null
        }
        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                isBound: true,
                current: accent,
                next: { ...accent, isRequired: true },
                operation: 'set-display'
            })
        ).toThrow('registered widget binding contract')
    })

    it.each(['PrimaryAction', 'TermsAction'])('protects the registry validator format for %s', (codename) => {
        const requirement = getSlot('marketing.hero', 'content').requirements.components.find(
            (componentRequirement) => componentRequirement.componentCodename === codename
        )
        if (!requirement) throw new Error('Missing ' + codename + ' binding contract')
        const current = componentFromRequirement(requirement)

        expect(() =>
            assertWidgetBindingComponentMutation({
                entityCodename: 'MarketingPageHero',
                entityConfig: heroConfig,
                isBound: true,
                current,
                next: { ...current, validationRules: { format: 'untrusted' } },
                operation: 'update'
            })
        ).toThrow('registered widget binding contract')
    })
})
