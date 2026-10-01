import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    validateWidgetBindings
} from '@universo-react/types'

import type { MarketingSnapshotLike } from '../marketingSnapshot'

const ids = {
    layout: '0190a9b5-3cde-7abc-8def-0123456789a1',
    secondLayout: '0190a9b5-3cde-7abc-8def-0123456789a2',
    widget: '0190a9b5-3cde-7abc-8def-0123456789a3',
    secondWidget: '0190a9b5-3cde-7abc-8def-0123456789a4',
    scopedLayout: '0190a9b5-3cde-7abc-8def-0123456789a5',
    override: '0190a9b5-3cde-7abc-8def-0123456789a6',
    scopeEntity: '0190a9b5-3cde-7abc-8def-0123456789a7',
    heroEntity: '0190a9b5-3cde-7abc-8def-0123456789a8',
    secondOverride: '0190a9b5-3cde-7abc-8def-0123456789a9'
} as const

const heroDefinition = getLayoutWidgetDefinition('marketing.hero')
if (!heroDefinition?.bindingSlots?.[0]) throw new Error('Expected Hero binding slot definition')
const heroComponents = heroDefinition.bindingSlots[0].requirements.components.map((component) => ({
    codename: component.componentCodename,
    dataType: component.valueType.toUpperCase(),
    isRequired: component.required,
    validationRules: {
        ...(component.localized ? { localized: true } : {}),
        ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
        ...(component.semanticKey ? { unique: true } : {}),
        ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
        ...(component.format !== undefined ? { format: component.format } : {})
    }
}))

const localizedVlc = (en: string, ru?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ...(ru === undefined ? {} : { ru: { content: ru, version: 1, isActive: true } })
    }
})

const validBoundComponentValue = (
    component: { valueType: string; localized: boolean; semanticKey?: boolean; format?: string },
    semanticKey?: string,
    relationId?: string
): unknown => {
    if (component.semanticKey) return semanticKey ?? 'sample-record'
    if (component.localized) return localizedVlc('Sample content', 'Тестовое содержимое')
    if (component.format === 'marketingHref') return '/sample-path'
    if (component.format === 'marketingAction') return { kind: 'internal', path: '/pricing', target: 'same-tab' }
    if (component.format === 'marketingMediaReference') {
        return { type: 'url', url: 'https://example.test/marketing-media.svg', launchMode: 'inline' }
    }
    if (component.valueType === 'number') return 1
    if (component.valueType === 'boolean') return true
    if (component.valueType === 'ref') return relationId ?? ids.widget
    if (component.valueType === 'json') return {}
    return 'Sample content'
}

const validBoundRecordData = (
    components: readonly { componentCodename: string; valueType: string; localized: boolean; semanticKey?: boolean; format?: string }[],
    semanticKey?: string,
    relationId?: string
): Record<string, unknown> =>
    Object.fromEntries(
        components.map((component) => [component.componentCodename, validBoundComponentValue(component, semanticKey, relationId)])
    )

const heroRecordData = () => ({
    HeroKey: 'default',
    Title: localizedVlc('Build with confidence', 'Создавайте с уверенностью'),
    Accent: localizedVlc('A better way', 'Лучший подход'),
    Description: localizedVlc('A complete platform for your team.', 'Полная платформа для вашей команды.'),
    EmailLabel: localizedVlc('Email', 'Электронная почта'),
    EmailPlaceholder: localizedVlc('you@example.com', 'you@example.com'),
    PrimaryActionLabel: localizedVlc('Get started', 'Начать'),
    PrimaryAction: { kind: 'internal', path: '/sign-up', target: 'same-tab' },
    TermsText: localizedVlc('By continuing, you agree to our', 'Продолжая, вы соглашаетесь с'),
    TermsLinkLabel: localizedVlc('Terms of Service', 'Условиями использования'),
    TermsAction: { kind: 'anchor', href: '#terms' }
})

const getHeroRecordData = (snapshot: MarketingSnapshotLike): Record<string, unknown> => {
    const records = snapshot.elements?.[ids.heroEntity]
    const record = Array.isArray(records) ? records[0] : undefined
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Expected a Hero snapshot record')
    const data = (record as Record<string, unknown>).data
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected Hero snapshot record data')
    return data as Record<string, unknown>
}

const entities = {
    [ids.scopeEntity]: { kind: 'object', codename: 'MarketingPageSiteSettings' },
    logos: { kind: 'object', codename: 'MarketingPageLogo' },
    features: { kind: 'object', codename: 'MarketingPageFeature' },
    pricing: { kind: 'object', codename: 'MarketingPagePricing' },
    benefits: { kind: 'object', codename: 'MarketingPagePricingBenefit' },
    [ids.heroEntity]: {
        kind: 'object',
        codename: 'MarketingPageHero',
        config: {
            capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
            recordPolicy: {
                version: 1,
                denyDeleteWhenBound: true,
                immutableSemanticKeyWhenBound: true,
                runtimeMutation: 'deny',
                semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                requiredLocales: ['en', 'ru'],
                coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
            }
        },
        fields: heroComponents
    }
}

const boundWidgetConfig = (
    widgetKey: 'marketing.collection' | 'marketing.image' | 'marketing.pricing',
    rendererConfig: Record<string, unknown>,
    sourceCodenames: Record<string, string>,
    semanticKeys: Record<string, string>
): Record<string, unknown> => {
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
                    : { kind: selectorKind }
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: sourceCodenames[slot.key] ?? `MarketingPage${slot.key}`,
                        selector,
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })
    return encodeWidgetConfigEnvelope(
        { rendererConfig, neutral: { bindings } },
        { templateKey: 'marketing-page', widgetKey, zone: 'marketing-main' }
    )
}

const collectionWidget = (id: string, instanceKey: string, sourceCodename = 'MarketingPageLogo') => {
    const variant = sourceCodename === 'MarketingPageFeature' ? 'features' : 'logos'
    return {
        id,
        layoutId: ids.layout,
        zone: 'marketing-main',
        widgetKey: 'marketing.collection',
        sortOrder: 0,
        config: boundWidgetConfig(
            'marketing.collection',
            { instanceKey, variant },
            { section: 'MarketingPageSection', items: sourceCodename },
            { section: variant }
        ),
        isActive: true
    }
}

const heroWidget = (id: string, instanceKey: string) => {
    const definition = getLayoutWidgetDefinition('marketing.hero')
    if (!definition) throw new Error('Expected marketing.hero widget definition')

    return {
        id,
        layoutId: ids.layout,
        zone: 'marketing-main',
        widgetKey: 'marketing.hero',
        sortOrder: 0,
        config: encodeWidgetConfigEnvelope(
            {
                rendererConfig: { instanceKey, showLeadForm: true },
                neutral: {
                    bindings: buildSingleTargetWidgetBinding(definition, 'content', {
                        entityKind: 'object',
                        entityCodename: 'MarketingPageHero',
                        semanticKey: 'default'
                    })
                }
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        ),
        isActive: true
    }
}

const sourceEntityId = (codename: string): string => {
    const knownIds: Record<string, string> = {
        MarketingPageHero: ids.heroEntity,
        MarketingPageLogo: 'logos',
        MarketingPageFeature: 'features',
        MarketingPagePricing: 'pricing',
        MarketingPagePricingBenefit: 'benefits',
        MarketingPageSection: 'sections'
    }
    return knownIds[codename] ?? `entity:${codename}`
}

const createBindingSourceFixtures = (widgets: unknown[]) => {
    const sourceEntities: NonNullable<MarketingSnapshotLike['entities']> = {}
    const sourceElements: NonNullable<MarketingSnapshotLike['elements']> = {}
    let recordSequence = 1
    const nextRecordId = () => `0190a9b5-3cde-7abc-8def-${String(recordSequence++).padStart(12, '0')}`

    for (const value of widgets) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue
        const widget = value as Record<string, unknown>
        if (typeof widget.widgetKey !== 'string' || typeof widget.zone !== 'string') continue
        let decoded: ReturnType<typeof decodeWidgetConfigEnvelope>
        try {
            decoded = decodeWidgetConfigEnvelope(widget.config, {
                templateKey: 'marketing-page',
                widgetKey: widget.widgetKey,
                zone: widget.zone,
                requireBindings: true
            })
        } catch {
            continue
        }
        const definition = getLayoutWidgetDefinition(widget.widgetKey, decoded.rendererConfig)
        if (!definition || !decoded.neutral.bindings) continue

        const orderedBindings = [...decoded.neutral.bindings.slots].sort((left, right) => {
            const slotOrder = (slotKey: string) => definition.bindingSlots?.findIndex(({ key }) => key === slotKey) ?? -1
            return slotOrder(left.slot) - slotOrder(right.slot)
        })
        for (const binding of orderedBindings) {
            const slot = definition.bindingSlots?.find(({ key }) => key === binding.slot)
            if (!slot) continue
            const relationParentBinding = slot.relation
                ? decoded.neutral.bindings.slots.find(({ slot: parentSlot }) => parentSlot === slot.relation?.parentSlot)
                : undefined
            const relationParentTarget = relationParentBinding?.targets[0]
            const relationParentEntityId = relationParentTarget ? sourceEntityId(relationParentTarget.entityCodename) : undefined
            for (const target of binding.targets) {
                const entityId = sourceEntityId(target.entityCodename)
                if (target.entityCodename === 'MarketingPageHero') continue
                if (!sourceEntities[entityId]) {
                    sourceEntities[entityId] = {
                        kind: target.entityKind,
                        codename: target.entityCodename,
                        config: {
                            capabilities: Object.fromEntries(
                                slot.requirements.entityCapabilities.map((capability) => [capability, { enabled: true }])
                            ),
                            ...(slot.requirements.recordPolicy ? { recordPolicy: { version: 1, ...slot.requirements.recordPolicy } } : {})
                        },
                        fields: slot.requirements.components.map((component) => ({
                            codename: component.componentCodename,
                            dataType: component.valueType.toUpperCase(),
                            isRequired: component.required,
                            ...(slot.relation?.field === component.field && relationParentTarget && relationParentEntityId
                                ? {
                                      targetEntityId: relationParentEntityId,
                                      targetEntityKind: relationParentTarget.entityKind
                                  }
                                : {}),
                            validationRules: {
                                ...(component.localized ? { localized: true } : {}),
                                ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                                ...(component.semanticKey ? { unique: true } : {}),
                                ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
                                ...(component.format !== undefined ? { format: component.format } : {})
                            }
                        }))
                    }
                }

                const records = (sourceElements[entityId] as Array<Record<string, unknown>> | undefined) ?? []
                let relationId: string | undefined
                if (slot.relation) {
                    const parentRecords = relationParentEntityId
                        ? (sourceElements[relationParentEntityId] as Array<Record<string, unknown>> | undefined)
                        : undefined
                    const parentRecord = parentRecords?.[0]
                    relationId = typeof parentRecord?.id === 'string' ? parentRecord.id : undefined
                }
                if (target.selector.kind === 'semantic-key') {
                    const semanticComponent = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
                    const componentCodename = semanticComponent?.componentCodename
                    if (
                        componentCodename &&
                        !records.some(
                            (record) => (record.data as Record<string, unknown> | undefined)?.[componentCodename] === target.selector.value
                        )
                    ) {
                        records.push({
                            id: nextRecordId(),
                            data: validBoundRecordData(slot.requirements.components, target.selector.value, relationId)
                        })
                    }
                } else if (target.selector.kind === 'record-set' && records.length === 0) {
                    records.push({ id: nextRecordId(), data: validBoundRecordData(slot.requirements.components, undefined, relationId) })
                } else if (target.selector.kind === 'relation-set' && records.length === 0) {
                    records.push({ id: nextRecordId(), data: validBoundRecordData(slot.requirements.components, undefined, relationId) })
                }
                sourceElements[entityId] = records
            }
        }
    }

    return { sourceEntities, sourceElements }
}

const createSnapshot = (widgets: unknown[] = [collectionWidget(ids.widget, 'logos')]): MarketingSnapshotLike => {
    const sourceFixtures = createBindingSourceFixtures(widgets)
    return {
        entities: {
            ...entities,
            ...sourceFixtures.sourceEntities,
            [ids.heroEntity]: {
                ...entities[ids.heroEntity],
                config: {
                    capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                    recordPolicy: {
                        version: 1,
                        denyDeleteWhenBound: true,
                        immutableSemanticKeyWhenBound: true,
                        runtimeMutation: 'deny',
                        semanticKey: { componentCodename: 'HeroKey', creationPrefix: 'hero', protectedValues: ['default'] },
                        requiredLocales: ['en', 'ru'],
                        coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                    }
                },
                fields: heroComponents.map((field) => ({ ...field, validationRules: { ...field.validationRules } }))
            }
        },
        layouts: [
            {
                id: ids.layout,
                templateKey: 'marketing-page',
                name: { en: 'Marketing page' },
                config: {},
                isDefault: true,
                isActive: true,
                sortOrder: 0,
                compositionMode: 'independent',
                baseLayoutId: null
            }
        ],
        defaultLayoutId: ids.layout,
        layoutConfig: {},
        elements: {
            ...sourceFixtures.sourceElements,
            [ids.heroEntity]: [{ data: heroRecordData() }]
        },
        layoutZoneWidgets: widgets
    }
}

export {
    boundWidgetConfig,
    collectionWidget,
    createSnapshot,
    entities,
    getHeroRecordData,
    heroWidget,
    ids,
    localizedVlc,
    validBoundRecordData
}
