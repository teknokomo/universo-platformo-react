import { describe, expect, it } from 'vitest'

import {
    isCompatibleWidgetBindingEntity,
    widgetBindingSlotDefinitionSchema,
    type WidgetBindingEntityMetadata,
    type WidgetBindingSlotDefinition
} from '../common/widgetBindings'
import { getLayoutWidgetDefinition } from '../common/layoutWidgetDefinitions'

const createEntity = (
    slot: WidgetBindingSlotDefinition,
    codename: string,
    uiConfigByCodename: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
    targetByCodename: Readonly<Record<string, { id: string; kind: string; codename: string }>> = {}
): WidgetBindingEntityMetadata => ({
    kind: 'object',
    codename,
    config: {},
    components: slot.requirements.components.map((requirement) => ({
        codename: requirement.componentCodename,
        dataType: requirement.valueType.toUpperCase(),
        isRequired: requirement.required,
        ...(targetByCodename[requirement.componentCodename]
            ? {
                  targetObjectId: targetByCodename[requirement.componentCodename].id,
                  targetObjectKind: targetByCodename[requirement.componentCodename].kind,
                  targetObjectCodename: targetByCodename[requirement.componentCodename].codename
              }
            : {}),
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

const setComponentRequiredness = (entity: WidgetBindingEntityMetadata, codename: string, isRequired: boolean) => ({
    ...entity,
    components: entity.components.map((component) => (component.codename === codename ? { ...component, isRequired } : component))
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
            const relationParent = {
                id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                kind: 'object',
                codename: key === 'course' ? 'Courses' : 'LearningTracks'
            }
            const parentFieldCodename = key === 'course' ? 'CourseId' : 'TrackId'
            expect(
                slot.requirements.components
                    .filter(({ allowServerOwnedRead }) => allowServerOwnedRead)
                    .map(({ componentCodename }) => componentCodename)
            ).toEqual(allowed)

            const uiConfigByCodename = Object.fromEntries(allowed.map((componentCodename) => [componentCodename, { serverOwned: true }]))
            const entity = createEntity(slot, entityCodename, uiConfigByCodename, { [parentFieldCodename]: relationParent })
            expect(isCompatibleWidgetBindingEntity(slot, entity, { relationParent })).toBe(true)

            for (const uiConfig of [
                { serverOwned: true, private: true },
                { serverOwned: true, sensitive: true }
            ]) {
                expect(
                    isCompatibleWidgetBindingEntity(
                        slot,
                        {
                            ...entity,
                            components: entity.components.map((component) =>
                                uiConfigByCodename[component.codename] ? { ...component, uiConfig } : component
                            )
                        },
                        { relationParent }
                    )
                ).toBe(false)
            }
        }
    })

    it('rejects incompatible custom entities and unsafe server-owned fields', () => {
        const { panelSlot } = getRelationBuilderSlots('CourseId')
        const customEntity = createEntity(panelSlot, 'CustomCourseItems', {
            CourseId: { serverOwned: true },
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(panelSlot, customEntity)).toBe(false)

        const unownedParent = createEntity(panelSlot, 'CustomCourseItems', {
            CourseId: {},
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(panelSlot, unownedParent)).toBe(false)

        const courseTarget = { id: '0190a9b5-3cde-7abc-8def-0123456789c4', kind: 'object', codename: 'Courses' }
        const unownedOrder = createEntity(
            panelSlot,
            'CourseItems',
            {
                CourseId: { serverOwned: true },
                SortOrder: {}
            },
            { CourseId: courseTarget }
        )
        expect(isCompatibleWidgetBindingEntity(panelSlot, unownedOrder, { relationParent: courseTarget })).toBe(true)

        const customParentFieldSlot = getRelationBuilderSlots('InternalReference').panelSlot
        const customParentField = createEntity(customParentFieldSlot, 'CourseItems', {
            InternalReference: { serverOwned: true },
            SortOrder: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(customParentFieldSlot, customParentField)).toBe(false)

        const customOrderFieldSlot = getRelationBuilderSlots('CourseId', 'InternalRank').panelSlot
        const customOrderField = createEntity(customOrderFieldSlot, 'CourseItems', {
            CourseId: { serverOwned: true },
            InternalRank: { serverOwned: true }
        })
        expect(isCompatibleWidgetBindingEntity(customOrderFieldSlot, customOrderField)).toBe(false)

        for (const uiConfig of [
            { serverOwned: true, private: true },
            { serverOwned: true, sensitive: true }
        ]) {
            expect(
                isCompatibleWidgetBindingEntity(
                    panelSlot,
                    createEntity(panelSlot, 'CustomCourseItems', {
                        CourseId: uiConfig,
                        SortOrder: { serverOwned: true }
                    })
                )
            ).toBe(false)
        }
    })

    it('allows a server-owned dynamic relation parent only for its selected target Object', () => {
        const relationParent = { id: '0190a9b5-3cde-7abc-8def-0123456789c2', kind: 'object', codename: 'ParentRecords' }
        const wrongRelationParent = { ...relationParent, id: '0190a9b5-3cde-7abc-8def-0123456789c3' }
        const { panelSlot } = getRelationBuilderSlots('InternalReference')
        const componentUiConfig = { InternalReference: { serverOwned: true } }
        const targetByCodename = { InternalReference: relationParent }
        const customEntity = createEntity(panelSlot, 'CustomCourseItems', componentUiConfig, targetByCodename)

        expect(isCompatibleWidgetBindingEntity(panelSlot, customEntity)).toBe(false)
        expect(isCompatibleWidgetBindingEntity(panelSlot, customEntity, { relationParent: wrongRelationParent })).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(panelSlot, customEntity, { relationParent: { ...relationParent, kind: 'enumeration' } })
        ).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(panelSlot, customEntity, { relationParent: { ...relationParent, codename: 'OtherParent' } })
        ).toBe(false)
        expect(isCompatibleWidgetBindingEntity(panelSlot, customEntity, { relationParent })).toBe(true)
        const detachedSlot: WidgetBindingSlotDefinition = {
            ...panelSlot,
            selectorKinds: panelSlot.selectorKinds.filter((kind) => kind !== 'relation-set'),
            relation: undefined
        }
        expect(isCompatibleWidgetBindingEntity(detachedSlot, customEntity, { relationParent })).toBe(false)

        for (const uiConfig of [
            { serverOwned: true, private: true },
            { serverOwned: true, sensitive: true }
        ]) {
            expect(
                isCompatibleWidgetBindingEntity(
                    panelSlot,
                    createEntity(panelSlot, 'CustomCourseItems', { InternalReference: uiConfig }, targetByCodename),
                    { relationParent }
                )
            ).toBe(false)
        }
    })

    it('requires exact parent Object metadata for ordinary REF relation slots too', () => {
        const slot = getLayoutWidgetDefinition('learnerPlayer', { variant: 'course' })?.bindingSlots?.find(({ key }) => key === 'items')
        if (!slot) throw new Error('Course learnerPlayer relation slot is missing')
        const relationParent = { id: '0190a9b5-3cde-7abc-8def-0123456789c6', kind: 'object', codename: 'Courses' }
        const ordinaryRelation = createEntity(slot, 'CourseItems', {}, { CourseId: relationParent })

        expect(isCompatibleWidgetBindingEntity(slot, ordinaryRelation)).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(slot, ordinaryRelation, {
                relationParent: { ...relationParent, id: '0190a9b5-3cde-7abc-8def-0123456789c7' }
            })
        ).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(
                slot,
                createEntity(slot, 'CourseItems', {}, { CourseId: { ...relationParent, codename: 'Tracks' } }),
                {
                    relationParent
                }
            )
        ).toBe(false)
        expect(isCompatibleWidgetBindingEntity(slot, createEntity(slot, 'CourseItems', {}, {}), { relationParent })).toBe(false)
        expect(isCompatibleWidgetBindingEntity(slot, ordinaryRelation, { relationParent })).toBe(true)
    })

    it('requires the AccessLinks parent and allows safe order fields with either ownership mode', () => {
        const definition = getLayoutWidgetDefinition('relationBuilder', {
            panels: [
                {
                    slotKey: 'panel:guest-links',
                    title: 'Guest access links',
                    parentFieldCodename: 'TargetId',
                    parentFieldRequired: false,
                    titleFieldCodename: 'LinkTitle',
                    sortOrderFieldCodename: 'SortOrder'
                }
            ]
        })
        const panelSlot = definition?.bindingSlots?.find(({ key }) => key === 'panel:guest-links')
        if (!panelSlot) throw new Error('LMS AccessLinks relation slot is missing')

        const quizTarget = { id: '0190a9b5-3cde-7abc-8def-0123456789c2', kind: 'object', codename: 'Quizzes' }
        const accessLinks = createEntity(
            panelSlot,
            'AccessLinks',
            { TargetId: { serverOwned: true }, SortOrder: {} },
            { TargetId: quizTarget }
        )
        expect(isCompatibleWidgetBindingEntity(panelSlot, accessLinks)).toBe(false)
        expect(isCompatibleWidgetBindingEntity(panelSlot, accessLinks, { relationParent: quizTarget })).toBe(true)
        expect(isCompatibleWidgetBindingEntity(panelSlot, setComponentRequiredness(accessLinks, 'TargetId', true))).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(panelSlot, setComponentRequiredness(accessLinks, 'TargetId', true), {
                relationParent: quizTarget
            })
        ).toBe(true)
        const unregisteredParentSlot: WidgetBindingSlotDefinition = {
            ...panelSlot,
            requirements: {
                ...panelSlot.requirements,
                components: panelSlot.requirements.components.map((component) => {
                    if (component.field !== 'parent') return component
                    const { requireServerOwned: _requireServerOwned, ...unregisteredRequirement } = component
                    return { ...unregisteredRequirement, componentCodename: 'WorkspaceId' }
                })
            }
        }
        expect(
            isCompatibleWidgetBindingEntity(
                unregisteredParentSlot,
                createEntity(
                    unregisteredParentSlot,
                    'AccessLinks',
                    { WorkspaceId: { serverOwned: true }, SortOrder: {} },
                    { WorkspaceId: quizTarget }
                ),
                { relationParent: quizTarget }
            )
        ).toBe(false)
        const unownedRequiredTarget = createEntity(panelSlot, 'AccessLinks', { SortOrder: {} })
        expect(isCompatibleWidgetBindingEntity(panelSlot, setComponentRequiredness(unownedRequiredTarget, 'TargetId', true))).toBe(false)
        const accessLinksWithServerOwnedOrder = createEntity(
            panelSlot,
            'AccessLinks',
            {
                TargetId: { serverOwned: true },
                SortOrder: { serverOwned: true }
            },
            { TargetId: quizTarget }
        )
        expect(isCompatibleWidgetBindingEntity(panelSlot, accessLinksWithServerOwnedOrder, { relationParent: quizTarget })).toBe(true)
        const accessLinksWithTarget = createEntity(panelSlot, 'AccessLinks', { TargetId: { serverOwned: true } }, { TargetId: quizTarget })
        expect(isCompatibleWidgetBindingEntity(panelSlot, accessLinksWithTarget, { relationParent: quizTarget })).toBe(true)
        expect(
            isCompatibleWidgetBindingEntity(panelSlot, accessLinksWithTarget, {
                relationParent: { ...quizTarget, id: '0190a9b5-3cde-7abc-8def-0123456789c3' }
            })
        ).toBe(false)
        const optionalOrderSlot: WidgetBindingSlotDefinition = {
            ...panelSlot,
            requirements: {
                ...panelSlot.requirements,
                components: panelSlot.requirements.components.map((component) =>
                    component.field === 'order' ? { ...component, required: false } : component
                )
            }
        }
        const optionalOrderEntity = createEntity(
            optionalOrderSlot,
            'AccessLinks',
            {
                TargetId: { serverOwned: true },
                SortOrder: { serverOwned: true }
            },
            { TargetId: quizTarget }
        )
        expect(isCompatibleWidgetBindingEntity(optionalOrderSlot, optionalOrderEntity, { relationParent: quizTarget })).toBe(true)
        expect(
            isCompatibleWidgetBindingEntity(optionalOrderSlot, setComponentRequiredness(optionalOrderEntity, 'SortOrder', true), {
                relationParent: quizTarget
            })
        ).toBe(false)
        const missingSortOrder = {
            ...accessLinks,
            components: accessLinks.components.filter((component) => component.codename !== 'SortOrder')
        }
        expect(isCompatibleWidgetBindingEntity(panelSlot, missingSortOrder)).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(
                panelSlot,
                createEntity(
                    panelSlot,
                    'AccessLinks',
                    {
                        TargetId: { serverOwned: true, private: true }
                    },
                    { TargetId: quizTarget }
                ),
                { relationParent: quizTarget }
            )
        ).toBe(false)
        expect(
            isCompatibleWidgetBindingEntity(
                panelSlot,
                createEntity(
                    panelSlot,
                    'OtherAccessLinks',
                    {
                        TargetId: { serverOwned: true },
                        SortOrder: { serverOwned: true }
                    },
                    { TargetId: quizTarget }
                ),
                { relationParent: quizTarget }
            )
        ).toBe(false)
    })

    it('accepts registered server-owned Quizzes ordering while retaining the required order contract', () => {
        const definition = getLayoutWidgetDefinition('relationBuilder', {
            panels: [
                {
                    slotKey: 'panel:guest-links',
                    title: 'Guest access links',
                    parentFieldCodename: 'TargetId',
                    parentFieldRequired: false,
                    titleFieldCodename: 'LinkTitle',
                    sortOrderFieldCodename: 'SortOrder'
                }
            ]
        })
        const parentSlot = definition?.bindingSlots?.find(({ key }) => key === 'parent')
        if (!parentSlot) throw new Error('LMS Quizzes parent binding slot is missing')

        expect(parentSlot.requirements.components.find(({ field }) => field === 'order')?.required).toBe(true)
        const quizzes = createEntity(parentSlot, 'Quizzes', { SortOrder: { serverOwned: true } })
        expect(isCompatibleWidgetBindingEntity(parentSlot, quizzes)).toBe(true)
        expect(isCompatibleWidgetBindingEntity(parentSlot, setComponentRequiredness(quizzes, 'Title', false))).toBe(false)
    })

    it('keeps requiredness exact for optional fields outside trusted server-owned structure', () => {
        const { panelSlot } = getRelationBuilderSlots('CourseId')
        const courseTarget = { id: '0190a9b5-3cde-7abc-8def-0123456789c4', kind: 'object', codename: 'Courses' }
        const slotWithOptionalAccent: WidgetBindingSlotDefinition = {
            ...panelSlot,
            requirements: {
                ...panelSlot.requirements,
                components: [
                    ...panelSlot.requirements.components,
                    {
                        field: 'accent',
                        componentCodename: 'Accent',
                        valueType: 'string',
                        localized: false,
                        required: false
                    }
                ]
            }
        }
        const entity = createEntity(
            slotWithOptionalAccent,
            'CourseItems',
            {
                CourseId: { serverOwned: true },
                SortOrder: { serverOwned: true }
            },
            { CourseId: courseTarget }
        )

        expect(isCompatibleWidgetBindingEntity(slotWithOptionalAccent, entity, { relationParent: courseTarget })).toBe(true)
        expect(
            isCompatibleWidgetBindingEntity(slotWithOptionalAccent, setComponentRequiredness(entity, 'Accent', true), {
                relationParent: courseTarget
            })
        ).toBe(false)
        const forgedServerOwnedAccent: WidgetBindingSlotDefinition = {
            ...slotWithOptionalAccent,
            requirements: {
                ...slotWithOptionalAccent.requirements,
                components: slotWithOptionalAccent.requirements.components.map((component) =>
                    component.field === 'accent'
                        ? { ...component, allowServerOwnedRead: true as const, requireServerOwned: true as const }
                        : component
                )
            }
        }
        expect(widgetBindingSlotDefinitionSchema.safeParse(forgedServerOwnedAccent).success).toBe(false)
    })

    it('allows server-owned order fields only for registered LMS child entities', () => {
        const variants = [
            { entityCodename: 'CourseItems', parentField: 'CourseId' },
            { entityCodename: 'CourseSections', parentField: 'CourseId' },
            { entityCodename: 'TrackStages', parentField: 'TrackId' },
            { entityCodename: 'TrackSteps', parentField: 'TrackId' }
        ] as const

        for (const { entityCodename, parentField } of variants) {
            const { panelSlot } = getRelationBuilderSlots(parentField)
            const relationParent = {
                id: '0190a9b5-3cde-7abc-8def-0123456789c5',
                kind: 'object',
                codename: parentField === 'CourseId' ? 'Courses' : 'LearningTracks'
            }
            const entity = createEntity(
                panelSlot,
                entityCodename,
                {
                    [parentField]: { serverOwned: true },
                    SortOrder: { serverOwned: true }
                },
                { [parentField]: relationParent }
            )

            expect(
                isCompatibleWidgetBindingEntity(panelSlot, entity, { relationParent }),
                `${entityCodename} relation fields should be readable`
            ).toBe(true)
            expect(
                isCompatibleWidgetBindingEntity(
                    panelSlot,
                    {
                        ...entity,
                        codename: `Untrusted${entityCodename}`
                    },
                    { relationParent }
                ),
                `${entityCodename} must not trust the same fields on another entity`
            ).toBe(false)
        }
    })
})
