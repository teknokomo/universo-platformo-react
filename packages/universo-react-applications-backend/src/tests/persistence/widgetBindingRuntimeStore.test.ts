import { getLayoutWidgetDefinition, type WidgetBindingSlotDefinition } from '@universo-react/types'
import type { WidgetBindingRecordQuery } from '../../services/widgetBindingQuery'
import { createMockDbExecutor } from '../utils/dbMocks'
import {
    loadRuntimeWidgetBindingMetadata,
    loadWidgetBindingRuntimeRecords,
    type RuntimeWidgetBindingComponentMetadata,
    type RuntimeWidgetBindingObjectMetadata
} from '../../persistence/widgetBindingRuntimeStore'

const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
const parentObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312278'
const rowId = '019ccefc-2f7b-7b36-82f4-85cdb1312276'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312277'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'

const object: RuntimeWidgetBindingObjectMetadata = {
    id: objectId,
    codename: 'CustomLogos',
    kind: 'object',
    tableName: 'custom_marketing_records',
    config: { capabilities: { dataSchema: { enabled: true }, records: { enabled: true } } }
}

const componentsFor = (owner: RuntimeWidgetBindingObjectMetadata, slot: WidgetBindingSlotDefinition, relationTargetObjectId?: string) =>
    slot.requirements.components.map(
        (requirement, index): RuntimeWidgetBindingComponentMetadata => ({
            objectId: owner.id,
            codename: requirement.componentCodename,
            columnName: `cmp_${String(index + 1).padStart(24, '0')}`,
            dataType: requirement.valueType.toUpperCase(),
            isRequired: requirement.required,
            validationRules: {
                localized: requirement.localized,
                ...(requirement.maxLength === undefined ? {} : { maxLength: requirement.maxLength }),
                ...(requirement.semanticKey ? { unique: true } : {}),
                ...(requirement.pattern === undefined ? {} : { pattern: requirement.pattern }),
                ...(requirement.format === undefined ? {} : { format: requirement.format })
            },
            ...(requirement.valueType === 'ref' ? { targetObjectId: relationTargetObjectId ?? parentObjectId } : {})
        })
    )

const definitionAndSlot = () => {
    const definition = getLayoutWidgetDefinition('marketing.collection', { variant: 'logos' })
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'items')
    if (!definition || !slot) throw new Error('Marketing logo item contract is unavailable')
    return { definition, slot }
}

const recordSetQuery = (slot: WidgetBindingSlotDefinition, entityCodename: string): WidgetBindingRecordQuery => {
    const order = slot.requirements.components.find(({ field }) => field === slot.orderByField)
    const visibility = slot.requirements.components.find(({ field }) => field === slot.visibilityField)
    if (!order || !slot.maxResolvedRecords) throw new Error(`Missing ordered contract for ${slot.key}`)
    const target = {
        entityKind: 'object' as const,
        entityCodename,
        selector: { kind: 'record-set' as const },
        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    }
    return {
        kind: 'record-set',
        target,
        slot: slot.key,
        projection: target.projection,
        ordered: {
            orderByComponentCodename: order.componentCodename,
            ...(visibility ? { visibilityComponentCodename: visibility.componentCodename } : {}),
            limit: slot.maxResolvedRecords
        }
    }
}

describe('widgetBindingRuntimeStore', () => {
    it('loads only requested published Component metadata for a custom Object', async () => {
        const { executor } = createMockDbExecutor()
        const slot = definitionAndSlot().slot
        const components = componentsFor(object, slot)
        const requestedNames = ['LogoKey', 'AltText']
        executor.query
            .mockResolvedValueOnce([
                { id: objectId, codename: object.codename, kind: 'object', table_name: object.tableName, config: object.config }
            ])
            .mockResolvedValueOnce([
                ...components
                    .filter(({ codename }) => requestedNames.includes(String(codename)))
                    .map((component) => ({
                        object_id: component.objectId,
                        codename: component.codename,
                        column_name: component.columnName,
                        data_type: component.dataType,
                        is_required: component.isRequired,
                        validation_rules: component.validationRules,
                        target_object_id: component.targetObjectId
                    })),
                {
                    object_id: objectId,
                    codename: 'PrivateComponent',
                    column_name: 'cmp_private',
                    data_type: 'TEXT',
                    is_required: false
                }
            ])

        const metadata = await loadRuntimeWidgetBindingMetadata(executor, schemaName, new Map([[String(object.codename), requestedNames]]))

        expect(metadata.objectsByCodename.get(String(object.codename))).toMatchObject({ id: objectId, kind: 'object' })
        expect(metadata.componentsByObjectId.get(objectId)?.map(({ codename }) => codename)).toEqual(requestedNames)
        const [objectSql, objectParameters] = executor.query.mock.calls[0] ?? []
        const [componentSql, componentParameters] = executor.query.mock.calls[1] ?? []
        expect(String(objectSql)).toContain("'object'")
        expect(String(objectSql)).toContain('"_app_published" = true')
        expect(String(objectSql)).toContain('LIMIT $2')
        expect(objectParameters).toEqual([[object.codename], 2])
        expect(String(componentSql)).toContain('"_app_published" = true')
        expect(String(componentSql)).toContain('= ANY($2::text[])')
        expect(String(componentSql)).toContain('LIMIT $3')
        expect(componentParameters).toEqual([[objectId], requestedNames, 8193])
    })

    it('applies workspace, visibility, deterministic order, projection, and limit+1 in SQL', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        executor.query.mockResolvedValueOnce([
            { record_id: rowId, field_0: 'sydney', field_1: null, field_2: null, field_3: { en: 'Sydney' }, field_4: 1, field_5: true }
        ])
        const query = recordSetQuery(slot, 'CustomLogos')
        const components = componentsFor(object, slot)

        const rows = await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            query,
            object,
            components,
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        const orderColumn = components.find(({ codename }) => codename === 'SortOrder')?.columnName
        const visibleColumn = components.find(({ codename }) => codename === 'IsVisible')?.columnName
        expect(String(sql)).toContain(`FROM "${schemaName}"."${object.tableName}" AS record`)
        expect(String(sql)).toContain('"workspace_id" = $1')
        expect(String(sql)).toContain(`"${visibleColumn}" = true`)
        expect(String(sql)).toContain('"_app_published" = true')
        expect(String(sql)).toContain(`ORDER BY "${orderColumn}" ASC NULLS LAST, "id" ASC`)
        expect(String(sql)).toContain('LIMIT $2')
        expect(String(sql)).not.toContain('SELECT *')
        expect(parameters).toEqual([workspaceId, 101])
        expect(rows).toEqual([
            {
                recordId: rowId,
                data: { key: 'sydney', imageLight: null, imageDark: null, altText: { en: 'Sydney' }, order: 1, visible: true }
            }
        ])
    })

    it('declares the row alias referenced by semantic-key lifecycle predicates', async () => {
        const { executor } = createMockDbExecutor()
        const definition = getLayoutWidgetDefinition('marketing.footer')
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'site')
        const semanticKey = slot?.requirements.components.find(({ semanticKey: isSemanticKey }) => isSemanticKey)
        if (!slot || !semanticKey) throw new Error('Marketing footer site binding contract is unavailable')
        const target = {
            entityKind: 'object' as const,
            entityCodename: 'MarketingPageSiteSettings',
            selector: { kind: 'semantic-key' as const, field: semanticKey.field, value: 'site-settings' },
            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        }
        const query: WidgetBindingRecordQuery = {
            kind: 'semantic-key',
            target,
            slot: slot.key,
            projection: target.projection,
            selector: { componentCodename: semanticKey.componentCodename, value: 'site-settings' },
            limit: 2
        }
        const siteSettingsObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            codename: 'MarketingPageSiteSettings',
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                recordPolicy: {
                    version: 1,
                    semanticKey: { componentCodename: 'SiteKey', creationPrefix: 'site', protectedValues: ['site-settings'] },
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    runtimeMutation: 'deny'
                }
            }
        }
        executor.query.mockResolvedValueOnce([
            {
                record_id: rowId,
                ...Object.fromEntries(target.projection.map((_, index) => [`field_${index}`, null]))
            }
        ])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            query,
            object: siteSettingsObject,
            components: componentsFor(siteSettingsObject, slot),
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain(`FROM "${schemaName}"."${object.tableName}" AS record`)
        expect(String(sql)).toContain('record."_app_published" = true')
        expect(String(sql)).toContain('"workspace_id" = $1')
        expect(parameters).toEqual([workspaceId, 'site-settings', 3])
    })

    it('accepts semantic keys allowed by the registered Component pattern', async () => {
        const { executor } = createMockDbExecutor()
        const definition = getLayoutWidgetDefinition('marketing.footer')
        const registeredSlot = definition?.bindingSlots?.find(({ key }) => key === 'site')
        const registeredSemanticKey = registeredSlot?.requirements.components.find(({ semanticKey }) => semanticKey === true)
        if (!registeredSlot || !registeredSemanticKey) throw new Error('Marketing footer site binding contract is unavailable')

        const pattern = '^Marketing[A-Z][A-Za-z0-9]*$'
        const slot: WidgetBindingSlotDefinition = {
            ...registeredSlot,
            requirements: {
                ...registeredSlot.requirements,
                components: registeredSlot.requirements.components.map((requirement) =>
                    requirement.semanticKey ? { ...requirement, pattern } : requirement
                )
            }
        }
        const semanticKey = slot.requirements.components.find(({ semanticKey: isKey }) => isKey)!
        const semanticValue = 'MarketingSite'
        const projection = slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        const target = {
            entityKind: 'object' as const,
            entityCodename: 'CustomSiteSettings',
            selector: { kind: 'semantic-key' as const, field: semanticKey.field, value: semanticValue },
            projection
        }
        const query: WidgetBindingRecordQuery = {
            kind: 'semantic-key',
            target,
            slot: slot.key,
            projection,
            selector: { componentCodename: semanticKey.componentCodename, value: semanticValue },
            limit: 2
        }
        const siteSettingsObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            codename: target.entityCodename,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                recordPolicy: {
                    version: 1,
                    semanticKey: { componentCodename: 'SiteKey', creationPrefix: 'site', protectedValues: ['site-settings'] },
                    denyDeleteWhenBound: true,
                    immutableSemanticKeyWhenBound: true,
                    runtimeMutation: 'deny'
                }
            }
        }
        executor.query.mockResolvedValueOnce([
            { record_id: rowId, ...Object.fromEntries(projection.map((_, index) => [`field_${index}`, null])) }
        ])

        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                schemaName,
                workspaceId,
                workspacesEnabled: true,
                query,
                object: siteSettingsObject,
                components: componentsFor(siteSettingsObject, slot),
                slot
            })
        ).resolves.toHaveLength(1)

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain('"workspace_id" = $1')
        expect(parameters).toEqual([workspaceId, semanticValue, 3])
    })

    it('applies relation UUID, parent lifecycle/workspace, visibility, and target contract before returning records', async () => {
        const { executor } = createMockDbExecutor()
        const definition = getLayoutWidgetDefinition('marketing.pricing')
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'benefits')
        const parentSlot = definition?.bindingSlots?.find(({ key }) => key === 'tiers')
        if (!slot || !parentSlot) throw new Error('Marketing pricing relation contract is unavailable')
        const parentRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312282'
        const parentObject: RuntimeWidgetBindingObjectMetadata = {
            id: parentObjectId,
            codename: 'MarketingPagePricing',
            kind: 'object',
            tableName: 'marketing_pricing_tiers',
            config: { capabilities: { dataSchema: { enabled: true }, records: { enabled: true } } }
        }
        const components = componentsFor({ ...object, codename: 'MarketingPagePricingBenefit' }, slot, parentObjectId)
        const relation = slot.relation!
        const relationComponent = slot.requirements.components.find(({ field }) => field === relation.field)!
        const parentTarget = {
            entityKind: 'object' as const,
            entityCodename: parentObject.codename,
            selector: { kind: 'record-set' as const },
            projection: parentSlot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        }
        const target = {
            entityKind: 'object' as const,
            entityCodename: 'MarketingPagePricingBenefit',
            selector: { kind: 'relation-set' as const, parentSlot: 'tiers' },
            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
        }
        const query: WidgetBindingRecordQuery = {
            kind: 'relation-set',
            target,
            slot: 'benefits',
            projection: target.projection,
            selector: { relationComponentCodename: relationComponent.componentCodename, parentRecordIds: [parentRecordId], parentTarget },
            ordered: {
                orderByComponentCodename: slot.requirements.components.find(({ field }) => field === slot.orderByField)!.componentCodename,
                visibilityComponentCodename: slot.requirements.components.find(({ field }) => field === slot.visibilityField)!
                    .componentCodename,
                limit: slot.maxResolvedRecords!
            }
        }
        executor.query.mockResolvedValueOnce([
            { record_id: rowId, field_0: 'starter-support', field_1: parentRecordId, field_2: { en: 'Support' }, field_3: 1, field_4: true }
        ])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            query,
            object: { ...object, codename: 'MarketingPagePricingBenefit' },
            components,
            slot,
            parentObject,
            parentSlot,
            parentObjectId
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        const relationColumn = components.find(({ codename }) => codename === 'TierRef')?.columnName
        const visibleColumn = components.find(({ codename }) => codename === 'IsVisible')?.columnName
        expect(String(sql)).toContain(`"${relationColumn}" = ANY($2::uuid[])`)
        expect(String(sql)).toContain('EXISTS (')
        expect(String(sql)).toContain('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."marketing_pricing_tiers" parent_record')
        expect(String(sql)).toContain('parent_record."workspace_id" = $1')
        expect(String(sql)).toContain('parent_record."_app_published" = true')
        expect(String(sql)).toContain(`"${visibleColumn}" = true`)
        expect(parameters).toEqual([workspaceId, [parentRecordId], 201])

        const mismatchedExecutor = createMockDbExecutor().executor
        await expect(
            loadWidgetBindingRuntimeRecords(mismatchedExecutor, {
                schemaName,
                workspaceId: null,
                workspacesEnabled: false,
                query,
                object: { ...object, codename: 'MarketingPagePricingBenefit' },
                components: components.map((component) =>
                    component.codename === 'TierRef' ? { ...component, targetObjectId: workspaceId } : component
                ),
                slot,
                parentObject,
                parentSlot,
                parentObjectId
            })
        ).rejects.toThrow('Widget binding REF targets another Object')
        expect(mismatchedExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects malformed projections, excessive limits, missing workspace, and disabled Object capabilities before SQL', async () => {
        const { slot } = definitionAndSlot()
        const validQuery = recordSetQuery(slot, 'CustomLogos')
        const { executor } = createMockDbExecutor()
        const input = {
            schemaName,
            workspaceId: null,
            workspacesEnabled: false,
            query: validQuery,
            object,
            components: componentsFor(object, slot),
            slot
        }

        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                ...input,
                query: { ...validQuery, projection: [{ field: 'private', componentCodename: 'PrivateComponent' }] }
            })
        ).rejects.toThrow('projection is invalid')
        if (validQuery.kind !== 'record-set') throw new Error('Expected record-set query')
        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                ...input,
                query: { ...validQuery, ordered: { ...validQuery.ordered, limit: slot.maxResolvedRecords! + 1 } }
            })
        ).rejects.toThrow('ordered selector is invalid')
        await expect(loadWidgetBindingRuntimeRecords(executor, { ...input, workspaceId: null, workspacesEnabled: true })).rejects.toThrow(
            'workspace scope is invalid'
        )
        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                ...input,
                object: { ...object, config: {} }
            })
        ).rejects.toThrow('Object capabilities are incompatible')
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('fails closed instead of silently truncating a bounded record set', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        const query = recordSetQuery(slot, 'CustomLogos')
        executor.query.mockResolvedValueOnce(
            Array.from({ length: slot.maxResolvedRecords! + 1 }, (_, index) => ({
                record_id: `019ccefc-2f7b-7b36-82f4-85cdb131${String(3000 + index).padStart(4, '0')}`,
                field_0: `logo-${index}`
            }))
        )

        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                schemaName,
                workspaceId: null,
                workspacesEnabled: false,
                query,
                object,
                components: componentsFor(object, slot),
                slot
            })
        ).rejects.toThrow('query returned too many records')
        expect(executor.query.mock.calls[0]?.[1]).toEqual([slot.maxResolvedRecords! + 1])
    })
})
