import { describe, expect, it } from 'vitest'

import {
    isCompatibleWidgetBindingEntity,
    type WidgetBindingEntityMetadata,
    type WidgetBindingSlotDefinition
} from '../common/widgetBindings'
import { getLayoutWidgetDefinition } from '../common/layoutWidgetDefinitions'

const createEntity = (
    slot: WidgetBindingSlotDefinition,
    codename: string,
    uiConfigByCodename: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {}
): WidgetBindingEntityMetadata => ({
    kind: 'object',
    codename,
    config: {},
    components: slot.requirements.components.map((requirement) => ({
        codename: requirement.componentCodename,
        dataType: requirement.valueType.toUpperCase(),
        isRequired: requirement.required,
        validationRules: {
            ...(requirement.localized ? { localized: true } : {}),
            ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
            ...(requirement.semanticKey ? { unique: true } : {}),
            ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
            ...(requirement.format === undefined ? {} : { format: requirement.format })
        },
        ...(uiConfigByCodename[requirement.componentCodename] ? { uiConfig: uiConfigByCodename[requirement.componentCodename] } : {})
    }))
})

const getRelationBuilderSlots = (parentFieldCodename: string, sortOrderFieldCodename = 'SortOrder') => {
    const definition = getLayoutWidgetDefinition('relationBuilder', {
        parentTitleFieldCodename: 'Title',
        panels: [
            {
                slotKey: 'panel:items',
                title: 'Course items',
                parentFieldCodename,
                sortOrderFieldCodename,
                displayFields: [{ fieldCodename: 'InternalNote', valueType: 'string', localized: false, required: false }]
            }
        ]
    })
    const parentSlot = definition?.bindingSlots?.find(({ key }) => key === 'parent')
    const panelSlot = definition?.bindingSlots?.find(({ key }) => key === 'panel:items')
    if (!parentSlot || !panelSlot) throw new Error('Configured relationBuilder binding slots are missing')
    return { parentSlot, panelSlot }
}

describe('server-owned widget binding policy', () => {
    it('allows only the registered LMS relation and order fields and always rejects private or sensitive fields', () => {
        const variants = [
            { key: 'course', entityCodename: 'CourseItems', allowed: ['CourseId', 'SortOrder'] },
            { key: 'track', entityCodename: 'TrackSteps', allowed: ['TrackId', 'SortOrder'] }
        ] as const

        for (const { key, entityCodename, allowed } of variants) {
            const slot = getLayoutWidgetDefinition('learnerPlayer', { variant: key })?.bindingSlots?.find(({ key }) => key === 'items')
            if (!slot) throw new Error(`${key} learnerPlayer item slot is missing`)
            expect(
                slot.requirements.components
                    .filter(({ allowServerOwnedRead }) => allowServerOwnedRead)
                    .map(({ componentCodename }) => componentCodename)
            ).toEqual(allowed)

            const uiConfigByCodename = Object.fromEntries(allowed.map((componentCodename) => [componentCodename, { serverOwned: true }]))
            const entity = createEntity(slot, entityCodename, uiConfigByCodename)
            expect(isCompatibleWidgetBindingEntity(slot, entity)).toBe(true)

            for (const uiConfig of [
                { serverOwned: true, private: true },
                { serverOwned: true, sensitive: true }
            ]) {
                expect(
                    isCompatibleWidgetBindingEntity(slot, {
                        ...entity,
                        components: entity.components.map((component) =>
                            uiConfigByCodename[component.codename] ? { ...component, uiConfig } : component
                        )
                    })
                ).toBe(false)
            }
        }
    })

    it('rejects server-owned relationBuilder fields outside the trusted structural allowlist', () => {
        const { parentSlot, panelSlot: allowedSlot } = getRelationBuilderSlots('CourseId')
        const allowedParentEntity = createEntity(parentSlot, 'Courses', {
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(parentSlot, allowedParentEntity)).toBe(true)

        const untrustedParentEntity = createEntity(parentSlot, 'CustomCourses', {
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(parentSlot, untrustedParentEntity)).toBe(false)

        const allowedEntity = createEntity(allowedSlot, 'CourseItems', {
            CourseId: { serverOwned: true },
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(allowedSlot, allowedEntity)).toBe(true)

        const untrustedEntity = createEntity(allowedSlot, 'CustomCourseItems', {
            CourseId: { serverOwned: true },
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(allowedSlot, untrustedEntity)).toBe(false)

        const untrustedParentSlot = getRelationBuilderSlots('InternalReference').panelSlot
        const untrustedParent = createEntity(untrustedParentSlot, 'CourseItems', {
            InternalReference: { serverOwned: true },
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(untrustedParentSlot, untrustedParent)).toBe(false)

        const untrustedOrderSlot = getRelationBuilderSlots('CourseId', 'InternalRank').panelSlot
        const untrustedOrder = createEntity(untrustedOrderSlot, 'CourseItems', {
            CourseId: { serverOwned: true },
            InternalRank: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(untrustedOrderSlot, untrustedOrder)).toBe(false)

        for (const uiConfig of [
            { serverOwned: true, private: true },
            { serverOwned: true, sensitive: true }
        ]) {
            expect(
                isCompatibleWidgetBindingEntity(
                    allowedSlot,
                    createEntity(allowedSlot, 'CourseItems', {
                        CourseId: uiConfig,
                        SortOrder: { serverOwned: true }
                    })
                )
            ).toBe(false)
        }
    })

    it('allows server-owned relation fields for every LMS snapshot child entity', () => {
        const variants = [
            { entityCodename: 'CourseItems', parentField: 'CourseId' },
            { entityCodename: 'CourseSections', parentField: 'CourseId' },
            { entityCodename: 'TrackStages', parentField: 'TrackId' },
            { entityCodename: 'TrackSteps', parentField: 'TrackId' }
        ] as const

        for (const { entityCodename, parentField } of variants) {
            const { panelSlot } = getRelationBuilderSlots(parentField)
            const entity = createEntity(panelSlot, entityCodename, {
                [parentField]: { serverOwned: true },
                SortOrder: { serverOwned: true }
            })

            expect(isCompatibleWidgetBindingEntity(panelSlot, entity), `${entityCodename} relation fields should be readable`).toBe(true)
            expect(
                isCompatibleWidgetBindingEntity(panelSlot, {
                    ...entity,
                    codename: `Untrusted${entityCodename}`
                }),
                `${entityCodename} must not trust the same fields on another entity`
            ).toBe(false)
        }
    })
})
