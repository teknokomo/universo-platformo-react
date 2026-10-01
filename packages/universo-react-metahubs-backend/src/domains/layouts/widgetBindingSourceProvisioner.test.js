jest.mock('../metahubs/services/MetahubObjectsService', () => ({
    MetahubObjectsService: jest.fn()
}))
jest.mock('../metahubs/services/MetahubComponentsService', () => ({
    MetahubComponentsService: jest.fn()
}))

const { ComponentDefinitionDataType, getLayoutWidgetDefinition } = require('@universo-react/types')
const { uuidV7Schema } = require('@universo-react/utils')
const { MetahubComponentsService } = require('../metahubs/services/MetahubComponentsService')
const { MetahubObjectsService } = require('../metahubs/services/MetahubObjectsService')
const { createWidgetBindingSourceProvisioner } = require('./widgetBindingSourceProvisioner')

const objectId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const hubId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const parentObject = { id: '0190a9b5-3cde-7abc-8def-0123456789a2', kind: 'object' }
const localized = (en, ru) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: { content: en, isActive: true },
        ru: { content: ru, isActive: true }
    }
})

const createSourceComponents = (slot) =>
    slot.requirements.components.map((requirement, sortOrder) => ({
        id: `source-component-${sortOrder}`,
        codename: requirement.componentCodename,
        dataType: requirement.valueType.toUpperCase(),
        isRequired: requirement.required,
        isDisplayComponent: sortOrder === 0,
        name: localized(requirement.componentCodename, requirement.componentCodename),
        validationRules: {
            ...(requirement.localized ? { localized: true } : {}),
            ...(requirement.maxLength !== undefined ? { maxLength: requirement.maxLength } : {}),
            ...(requirement.semanticKey ? { unique: true } : {}),
            ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
            ...(requirement.format ? { format: requirement.format } : {})
        },
        uiConfig: requirement.localized && requirement.maxLength >= 500 ? { rows: 6 } : {}
    }))

describe('generic widget binding source provisioner', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('creates a new Object model with only the registered Hero fields and no copied records', async () => {
        const slot = getLayoutWidgetDefinition('marketing.hero')?.bindingSlots?.[0]
        if (!slot) throw new Error('Expected the Hero content slot')
        const sourceComponents = createSourceComponents(slot)
        const createObject = jest.fn(async (_metahubId, _kind, input) => ({ id: input.id }))
        const createComponent = jest.fn(async () => ({ id: 'new-component' }))
        const findAllFlat = jest.fn(async () => sourceComponents)
        const findByCodenameAndKind = jest.fn(async () => ({ id: hubId }))
        MetahubObjectsService.mockImplementation(() => ({ createObject, findByCodenameAndKind }))
        MetahubComponentsService.mockImplementation(() => ({ findAllFlat, create: createComponent }))
        const db = { query: jest.fn() }

        const provision = createWidgetBindingSourceProvisioner({}, {})
        const result = await provision({
            db,
            metahubId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            userId: 'user-1',
            schemaName: 'mhb_test',
            templateSource: { id: objectId },
            slot,
            name: 'Alternative Hero',
            locale: 'en'
        })

        expect(uuidV7Schema.safeParse(createObject.mock.calls[0][2].id).success).toBe(true)
        expect(createObject).toHaveBeenCalledWith(
            '0190a9b5-3cde-7abc-8def-0123456789a3',
            'object',
            expect.objectContaining({
                id: expect.any(String),
                name: expect.objectContaining({
                    _primary: 'en',
                    locales: { en: expect.objectContaining({ content: 'Alternative Hero' }) }
                }),
                config: expect.objectContaining({
                    hubs: [hubId],
                    recordPolicy: expect.objectContaining({
                        version: 1,
                        coRequiredGroups: [['TermsText', 'TermsLinkLabel', 'TermsAction']]
                    })
                }),
                createdBy: 'user-1'
            }),
            'user-1',
            db
        )
        expect(findByCodenameAndKind).toHaveBeenCalledWith('0190a9b5-3cde-7abc-8def-0123456789a3', 'MarketingPage', 'hub', 'user-1', {}, db)
        expect(findAllFlat).toHaveBeenCalledWith('0190a9b5-3cde-7abc-8def-0123456789a3', objectId, 'user-1', 'business', db)
        expect(createComponent).toHaveBeenCalledTimes(slot.requirements.components.length)
        expect(createComponent).toHaveBeenCalledWith(
            '0190a9b5-3cde-7abc-8def-0123456789a3',
            expect.objectContaining({
                objectCollectionId: expect.any(String),
                codename: 'HeroKey',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                validationRules: expect.objectContaining({
                    unique: true,
                    pattern: slot.requirements.components.find(({ semanticKey }) => semanticKey)?.pattern
                }),
                uiConfig: {}
            }),
            'user-1',
            db
        )
        const multilineRequirement = slot.requirements.components.find(
            ({ localized: isLocalized, maxLength }) => isLocalized && maxLength >= 500
        )
        expect(multilineRequirement).toBeDefined()
        const multilineComponent = createComponent.mock.calls.find(([, input]) => input.codename === multilineRequirement.componentCodename)
        expect(multilineComponent[1].uiConfig).toEqual({ rows: 6 })
        expect(result).toMatchObject({ label: 'Alternative Hero', recordsCount: 0 })
        expect(result.sourceKey).toMatch(/^MarketingWidgetSource_[0-9a-f]{32}$/u)
    })

    it('retargets a cloned relation Component to the selected parent Object', async () => {
        const slot = getLayoutWidgetDefinition('marketing.pricing')?.bindingSlots?.find(({ key }) => key === 'benefits')
        if (!slot) throw new Error('Expected the Pricing benefits slot')
        const createComponent = jest.fn(async () => ({ id: 'new-component' }))
        MetahubObjectsService.mockImplementation(() => ({
            findByCodenameAndKind: jest.fn(async () => ({ id: hubId })),
            createObject: jest.fn(async (_metahubId, _kind, input) => ({ id: input.id }))
        }))
        MetahubComponentsService.mockImplementation(() => ({
            findAllFlat: jest.fn(async () => createSourceComponents(slot)),
            create: createComponent
        }))
        const provision = createWidgetBindingSourceProvisioner({}, {})

        await provision({
            db: { query: jest.fn() },
            metahubId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            schemaName: 'mhb_test',
            templateSource: { id: objectId },
            slot,
            name: 'Alternative benefits',
            locale: 'ru',
            parentObject
        })

        expect(createComponent).toHaveBeenCalledWith(
            '0190a9b5-3cde-7abc-8def-0123456789a3',
            expect.objectContaining({
                codename: 'TierRef',
                dataType: ComponentDefinitionDataType.REF,
                targetEntityId: parentObject.id,
                targetEntityKind: 'object'
            }),
            undefined,
            expect.anything()
        )
    })

    it('fails before Object creation when a required relation parent is missing', async () => {
        const slot = getLayoutWidgetDefinition('marketing.pricing')?.bindingSlots?.find(({ key }) => key === 'benefits')
        if (!slot) throw new Error('Expected the Pricing benefits slot')
        const createObject = jest.fn()
        MetahubObjectsService.mockImplementation(() => ({
            findByCodenameAndKind: jest.fn(async () => ({ id: hubId })),
            createObject
        }))
        MetahubComponentsService.mockImplementation(() => ({
            findAllFlat: jest.fn(async () => createSourceComponents(slot)),
            create: jest.fn()
        }))
        const provision = createWidgetBindingSourceProvisioner({}, {})

        await expect(
            provision({
                db: { query: jest.fn() },
                metahubId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                schemaName: 'mhb_test',
                templateSource: { id: objectId },
                slot,
                name: 'Alternative benefits',
                locale: 'en'
            })
        ).rejects.toThrow('MARKETING_WIDGET_SOURCE_RELATION_PARENT_REQUIRED')
        expect(createObject).not.toHaveBeenCalled()
    })

    it('fails closed when the Marketing Page Hub is missing', async () => {
        const slot = getLayoutWidgetDefinition('marketing.collection', { variant: 'features' })?.bindingSlots?.find(
            ({ key }) => key === 'items'
        )
        if (!slot) throw new Error('Expected the Collection items slot')
        const createObject = jest.fn()
        MetahubObjectsService.mockImplementation(() => ({
            findByCodenameAndKind: jest.fn(async () => null),
            createObject
        }))
        MetahubComponentsService.mockImplementation(() => ({ findAllFlat: jest.fn(), create: jest.fn() }))
        const provision = createWidgetBindingSourceProvisioner({}, {})

        await expect(
            provision({
                db: { query: jest.fn() },
                metahubId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                schemaName: 'mhb_test',
                templateSource: { id: objectId },
                slot,
                name: 'Alternative collection',
                locale: 'en'
            })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(createObject).not.toHaveBeenCalled()
    })
})
