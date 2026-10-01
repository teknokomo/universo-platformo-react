import {
    getLayoutWidgetDefinition,
    validateWidgetBindings,
    type LayoutWidgetDefinition,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import type { PublicMarketingBindingRecordLoader } from '../../persistence/publicApplicationRuntimeStore'
import { attachApplicationLayoutWidgetSourceBindingState } from '../../persistence/applicationLayoutStoreSupport'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
let nextFixtureId = 3000
const recordIdsBySlot = new Map<string, string>()

const nextUuidV7 = (): string => {
    nextFixtureId += 1
    return `019ccefc-2f7b-7b36-82f4-85cdb131${String(nextFixtureId).padStart(4, '0')}`
}

const recordIdFor = (widgetKey: string, slot: string): string => {
    const identity = `${widgetKey}:${slot}`
    const existing = recordIdsBySlot.get(identity)
    if (existing) return existing
    const value = nextUuidV7()
    recordIdsBySlot.set(identity, value)
    return value
}

const localized = (value: string) => ({ en: value, ru: `RU ${value}` })

const definitionFor = (widgetKey: string, rendererConfig: Record<string, unknown>): LayoutWidgetDefinition => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!definition) throw new Error(`Missing marketing widget definition: ${widgetKey}`)
    return definition
}

const semanticKeyFor = (widgetKey: string, slotKey: string): string => {
    const keys: Record<string, string> = {
        'marketing.brand:site': 'site-default',
        'marketing.navigation:items': 'home',
        'marketing.hero:content': 'hero-main',
        'marketing.image:content': 'hero-image',
        'marketing.collection:section': 'features',
        'marketing.collection:items': 'feature-one',
        'marketing.pricing:section': 'pricing',
        'marketing.pricing:tiers': 'pro-plan',
        'marketing.pricing:benefits': 'priority-support',
        'marketing.footer:site': 'site-default',
        'marketing.footer:section': 'footer',
        'marketing.footer:links': 'privacy'
    }
    return keys[`${widgetKey}:${slotKey}`] ?? 'fixture-record'
}

const targetSelector = (slot: WidgetBindingSlotDefinition, semanticKey: string) => {
    if (slot.selectorKinds.includes('semantic-key')) {
        const key = slot.requirements.components.find(({ semanticKey: isKey }) => isKey)
        if (!key) throw new Error(`Missing semantic key in ${slot.key}`)
        return { kind: 'semantic-key' as const, field: key.field, value: semanticKey }
    }
    if (slot.selectorKinds.includes('relation-set')) {
        if (!slot.relation) throw new Error(`Missing relation in ${slot.key}`)
        return { kind: 'relation-set' as const, parentSlot: slot.relation.parentSlot }
    }
    return { kind: 'record-set' as const }
}

export const createPublicMarketingWidget = (
    widgetKey: string,
    zone: string,
    index: number,
    suppliedConfig: Record<string, unknown> = {}
) => {
    const config = { instanceKey: `${widgetKey.replace('marketing.', '')}-${index}`, ...suppliedConfig }
    const definition = definitionFor(widgetKey, config)
    const widget = {
        id: nextUuidV7(),
        zone,
        semanticRegion: zone === 'marketing-header' ? 'header' : zone === 'marketing-footer' ? 'footer' : 'main',
        widgetKey,
        sortOrder: index,
        config,
        isActive: true,
        version: 1
    }
    if (!definition.bindingSlots?.length) return widget

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => {
            const semanticKey = semanticKeyFor(widgetKey, slot.key)
            return {
                slot: slot.key,
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: `Custom${widgetKey.split('.').at(-1)}${slot.key[0]?.toUpperCase()}${slot.key.slice(1)}`,
                        selector: targetSelector(slot, semanticKey),
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        })
    })
    return attachApplicationLayoutWidgetSourceBindingState(widget, { persistedApplicationRow: true, bindings })
}

const baseFieldValue = (
    widgetKey: string,
    slot: WidgetBindingSlotDefinition,
    field: string,
    valueType: string,
    localizedField: boolean
): unknown => {
    if (field === 'key') return semanticKeyFor(widgetKey, slot.key)
    if (field === 'tier' && widgetKey === 'marketing.pricing') return recordIdFor(widgetKey, 'tiers')
    if (valueType === 'number') return 1
    if (valueType === 'boolean') return true
    if (valueType === 'ref') return recordIdFor(widgetKey, 'tiers')
    if (valueType === 'json') {
        if (field === 'brandLogo') {
            return { resource: { type: 'url', url: 'https://cdn.example.test/brand.svg', launchMode: 'inline' } }
        }
        if (field.toLowerCase().includes('image') || field === 'resource' || field === 'avatar' || field.startsWith('logo')) {
            return { type: 'url', url: 'https://cdn.example.test/marketing.webp', launchMode: 'inline' }
        }
        return { kind: 'internal', path: '/start' }
    }
    return localizedField ? localized(field) : field
}

const createSlotData = (widgetKey: string, slotKey: string): Record<string, unknown> => {
    const rendererConfig = widgetKey === 'marketing.collection' ? { variant: 'features' } : {}
    const slot = definitionFor(widgetKey, rendererConfig).bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new Error(`Missing fixture slot ${widgetKey}:${slotKey}`)
    const data: Record<string, unknown> = {}
    for (const requirement of slot.requirements.components) {
        data[requirement.field] = baseFieldValue(widgetKey, slot, requirement.field, requirement.valueType, requirement.localized)
    }

    if (widgetKey === 'marketing.brand' || (widgetKey === 'marketing.footer' && slotKey === 'site')) {
        data.brandName = localized('Universo')
    }
    if (widgetKey === 'marketing.navigation') {
        Object.assign(data, { label: localized('Home'), href: '/home', sectionKey: 'hero', order: 1, visible: true })
    }
    if (widgetKey === 'marketing.hero') {
        Object.assign(data, {
            title: localized('Entity owned title'),
            accent: localized('Accent'),
            description: localized('Entity owned description'),
            emailLabel: localized('Email'),
            emailPlaceholder: localized('you@example.test'),
            primaryActionLabel: localized('Get started'),
            primaryAction: { kind: 'internal', path: '/start' }
        })
    }
    if (widgetKey === 'marketing.image') {
        Object.assign(data, {
            resource: { type: 'url', url: 'https://cdn.example.test/hero.webp', launchMode: 'inline' },
            altText: localized('Hero illustration'),
            decorative: false,
            width: 640,
            height: 360
        })
    }
    if (widgetKey === 'marketing.collection') {
        if (slotKey === 'section') Object.assign(data, { title: localized('Features'), description: localized('Product features') })
        else {
            Object.assign(data, {
                iconKey: 'sparkles',
                title: localized('Fast setup'),
                description: localized('Start quickly'),
                imageLight: { type: 'url', url: 'https://cdn.example.test/feature-light.webp' },
                imageDark: { type: 'url', url: 'https://cdn.example.test/feature-dark.webp' },
                altText: localized('Partner logo'),
                order: 1,
                visible: true
            })
        }
    }
    if (widgetKey === 'marketing.pricing') {
        if (slotKey === 'section') Object.assign(data, { title: localized('Pricing'), description: localized('Choose a plan') })
        if (slotKey === 'tiers') {
            Object.assign(data, {
                title: localized('Pro'),
                subheader: localized('For teams'),
                price: 19,
                period: localized('per month'),
                actionLabel: localized('Contact us'),
                actionHref: '/contact',
                featured: true,
                order: 1,
                visible: true
            })
        }
        if (slotKey === 'benefits')
            Object.assign(data, { tier: recordIdFor(widgetKey, 'tiers'), label: localized('Priority support'), order: 1, visible: true })
    }
    if (widgetKey === 'marketing.footer') {
        if (slotKey === 'site') {
            Object.assign(data, {
                footerDescription: localized('Footer description'),
                copyrightText: localized('© Universo'),
                copyrightLabel: localized('Privacy'),
                copyrightHref: '/privacy',
                newsletterTitle: localized('Newsletter'),
                newsletterDescription: localized('Get updates'),
                newsletterLabel: localized('Email'),
                newsletterPlaceholder: localized('you@example.test'),
                newsletterActionLabel: localized('Subscribe'),
                newsletterActionHref: '/subscribe',
                newsletterSuccessMessage: localized('Thanks'),
                newsletterErrorMessage: localized('Try again'),
                newsletterEnabled: true
            })
        } else if (slotKey === 'section') {
            Object.assign(data, { title: localized('Company'), description: localized('Company links') })
        } else {
            Object.assign(data, {
                groupKey: 'company',
                groupTitle: localized('Company'),
                label: localized('Privacy'),
                bottomLabel: localized('Privacy policy'),
                href: '/privacy',
                iconKey: 'policy',
                order: 1,
                visible: true
            })
        }
    }
    data.privateColumn = 'must never cross the resolver projection'
    return data
}

export const createPublicMarketingRecordLoader = () => {
    const loadRecords: PublicMarketingBindingRecordLoader = async ({ widgetKey, query }) => [
        {
            recordId: recordIdFor(widgetKey, query.slot),
            data: createSlotData(widgetKey, query.slot)
        }
    ]
    return loadRecords
}

export const createPublicMarketingEffectiveLayout = (
    widgets: readonly object[],
    scope: 'global' | 'entity' = 'global',
    headerPosition?: 'fixed' | 'flow'
) =>
    ({
        layout: {
            templateKey: 'marketing-page',
            config: { themeMode: 'system', allowEmailActions: true, allowTelephoneActions: true, externalLinkTarget: 'new-tab' },
            ...(headerPosition ? { zoneSettings: { 'marketing-header': { position: headerPosition } } } : {})
        },
        scope,
        widgets
    } as never)

export const publicApplicationRoute = {
    applicationId,
    matchedBy: 'uuid' as const,
    matchedAlias: null,
    routingMode: 'direct' as const,
    primaryAlias: null,
    canonicalAlias: null
}

export const publicApplicationIdForTests = applicationId
