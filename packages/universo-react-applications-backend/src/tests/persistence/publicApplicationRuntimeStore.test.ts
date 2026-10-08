import { getLayoutWidgetDefinition, type WidgetBindingSlotDefinition, type WidgetBindingTarget } from '@universo-react/types'
import type { WidgetBindingRecordQuery } from '../../services/widgetBindingQuery'
import { createPublicMarketingBindingRecordLoader } from '../../persistence/publicApplicationRuntimeStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const siteRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312271'
const tierRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
const benefitRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
const objectIds = {
    child: '019ccefc-2f7b-7b36-82f4-85cdb1312280',
    parent: '019ccefc-2f7b-7b36-82f4-85cdb1312281'
}

const slotFor = (widgetKey: string, slotKey: string, rendererConfig?: unknown): WidgetBindingSlotDefinition => {
    const slot = getLayoutWidgetDefinition(widgetKey, rendererConfig)?.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new Error(`Missing fixture slot ${widgetKey}:${slotKey}`)
    return slot
}

const targetFor = (
    slot: WidgetBindingSlotDefinition,
    entityCodename: string,
    selector: WidgetBindingTarget['selector']
): WidgetBindingTarget => ({
    entityKind: 'object',
    entityCodename,
    selector,
    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
})

const queryForSemantic = (slot: WidgetBindingSlotDefinition, entityCodename: string, value: string): WidgetBindingRecordQuery => {
    const semanticRequirement = slot.requirements.components.find(({ semanticKey }) => semanticKey === true)
    if (!semanticRequirement) throw new Error(`Missing semantic key for ${slot.key}`)
    return {
        kind: 'semantic-key',
        slot: slot.key,
        target: targetFor(slot, entityCodename, { kind: 'semantic-key', field: semanticRequirement.field, value }),
        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename })),
        selector: { componentCodename: semanticRequirement.componentCodename, value },
        limit: 2
    }
}

const queryForRecordSet = (slot: WidgetBindingSlotDefinition, entityCodename: string): WidgetBindingRecordQuery => {
    const order = slot.requirements.components.find(({ field }) => field === slot.orderByField)
    const visibility = slot.requirements.components.find(({ field }) => field === slot.visibilityField)
    if (!order || !slot.maxResolvedRecords) throw new Error(`Missing ordered contract for ${slot.key}`)
    return {
        kind: 'record-set',
        slot: slot.key,
        target: targetFor(slot, entityCodename, { kind: 'record-set' }),
        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename })),
        ordered: {
            orderByComponentCodename: order.componentCodename,
            ...(visibility ? { visibilityComponentCodename: visibility.componentCodename } : {}),
            limit: slot.maxResolvedRecords
        }
    }
}

const objectConfig = (slot: WidgetBindingSlotDefinition) => ({
    capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
    ...(slot.requirements.recordPolicy ? { recordPolicy: { version: 1, ...slot.requirements.recordPolicy } } : {})
})

const objectMetadata = (slot: WidgetBindingSlotDefinition, codename: string, id: string, tableName: string) => ({
    id,
    codename,
    tableName,
    kind: 'object',
    config: objectConfig(slot)
})

const componentMetadata = (slot: WidgetBindingSlotDefinition, objectId: string, relationTarget?: { id: string; codename: string }) =>
    slot.requirements.components.map((component) => ({
        objectId,
        codename: component.componentCodename,
        columnName: `cmp_${component.componentCodename.toLowerCase()}`,
        dataType:
            component.valueType === 'string'
                ? 'TEXT'
                : component.valueType === 'number'
                ? 'NUMERIC'
                : component.valueType === 'boolean'
                ? 'BOOLEAN'
                : component.valueType === 'ref'
                ? 'REF'
                : 'JSONB',
        isRequired: component.required,
        validationRules: {
            localized: component.localized,
            ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
            ...(component.semanticKey ? { unique: true } : {}),
            ...(component.pattern === undefined ? {} : { pattern: component.pattern }),
            ...(component.format ? { format: component.format } : {})
        },
        targetObjectId: component.valueType === 'ref' ? relationTarget?.id ?? null : null,
        targetObjectKind: component.valueType === 'ref' ? 'object' : null,
        targetObjectCodename: component.valueType === 'ref' ? relationTarget?.codename ?? null : null
    }))

describe('publicApplicationRuntimeStore', () => {
    it('resolves a custom published Object using its registered semantic projection and workspace scope', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.brand', 'site')
        const query = queryForSemantic(slot, 'CustomSiteSettings', 'site-default')
        const privateColumn = 'cmp_PrivateInternalNote'
        executor.query
            .mockResolvedValueOnce([objectMetadata(slot, 'CustomSiteSettings', objectIds.child, 'custom_site_settings')])
            .mockResolvedValueOnce(componentMetadata(slot, objectIds.child))
            .mockResolvedValueOnce([{ workspaceScoped: true }])
            .mockResolvedValueOnce([
                {
                    record_id: siteRecordId,
                    binding_0: 'site-default',
                    binding_1: { en: 'Public brand' },
                    [privateColumn]: 'never selected'
                }
            ])

        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId })
        const records = await loadRecords({ widgetKey: 'marketing.brand', rendererConfig: {}, query })

        expect(records).toEqual([{ recordId: siteRecordId, data: { key: 'site-default', brandName: { en: 'Public brand' } } }])
        const metadataSql = String(executor.query.mock.calls[0]?.[0])
        const componentSql = String(executor.query.mock.calls[1]?.[0])
        const dataSql = String(executor.query.mock.calls[3]?.[0])
        expect(metadataSql).toContain("o.kind = 'object'")
        expect(metadataSql).toContain('"_app_published" = true')
        expect(componentSql).toContain('"_app_published" = true')
        expect(dataSql).toContain('"record"."_app_published" = true')
        expect(dataSql).toContain('"record"."_upl_archived" = false')
        expect(dataSql).toContain('"record"."_app_archived" = false')
        expect(dataSql).toContain('record."workspace_id" = $1')
        expect(dataSql).toContain('record."cmp_sitekey" = $2')
        expect(dataSql).toContain('record."id" AS "record_id"')
        expect(dataSql).toContain('record."cmp_brandname" AS "binding_1"')
        expect(dataSql).not.toContain(privateColumn)
        expect(dataSql).not.toContain('SELECT *')
        expect(executor.query.mock.calls[3]?.[1]).toEqual([workspaceId, 'site-default', 3])
    })

    it('filters Hero content by the active semantic binding before applying its runtime row limit', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.hero', 'content')
        const selectedHeroKey = 'hero-bound'
        const query = queryForSemantic(slot, 'CustomMarketingHero', selectedHeroKey)
        if (query.kind !== 'semantic-key') throw new Error('Expected a Hero semantic-key query')

        const row: Record<string, unknown> = { record_id: siteRecordId }
        query.projection.forEach(({ componentCodename }, index) => {
            row[`binding_${index}`] =
                componentCodename === query.selector.componentCodename ? selectedHeroKey : { en: `Bound ${componentCodename}` }
        })
        executor.query
            .mockResolvedValueOnce([objectMetadata(slot, 'CustomMarketingHero', objectIds.child, 'custom_marketing_hero')])
            .mockResolvedValueOnce(componentMetadata(slot, objectIds.child))
            .mockResolvedValueOnce([{ workspaceScoped: true }])
            .mockResolvedValueOnce([row])

        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId })
        const records = await loadRecords({ widgetKey: 'marketing.hero', rendererConfig: {}, query })

        expect(records).toHaveLength(1)
        const sql = String(executor.query.mock.calls[3]?.[0])
        expect(sql).toContain('record."cmp_herokey" = $2')
        expect(sql).toMatch(/WHERE[\s\S]*record\."cmp_herokey" = \$2[\s\S]*LIMIT \$3/u)
        expect(executor.query.mock.calls[3]?.[1]).toEqual([workspaceId, selectedHeroKey, 3])
    })

    it('rejects a public binding to a protected Component before issuing a record query', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.brand', 'site')
        const query = queryForSemantic(slot, 'CustomSiteSettings', 'site-default')
        const components = componentMetadata(slot, objectIds.child).map((component) =>
            component.codename === 'BrandName' ? { ...component, uiConfig: { private: true } } : component
        )
        executor.query
            .mockResolvedValueOnce([objectMetadata(slot, 'CustomSiteSettings', objectIds.child, 'custom_site_settings')])
            .mockResolvedValueOnce(components)

        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId })
        await expect(loadRecords({ widgetKey: 'marketing.brand', rendererConfig: {}, query })).rejects.toThrow(
            'Object/Component contract is incompatible'
        )
        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes('custom_site_settings'))).toBe(false)
    })

    it('filters record-set visibility, order, workspace, and the registered limit in SQL', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.navigation', 'items')
        const query = queryForRecordSet(slot, 'CustomNavigationItems')
        executor.query
            .mockResolvedValueOnce([objectMetadata(slot, 'CustomNavigationItems', objectIds.child, 'custom_navigation_items')])
            .mockResolvedValueOnce(componentMetadata(slot, objectIds.child))
            .mockResolvedValueOnce([{ workspaceScoped: true }])
            .mockResolvedValueOnce([
                {
                    record_id: siteRecordId,
                    binding_0: 'nav-home',
                    binding_1: { en: 'Home' },
                    binding_2: '/',
                    binding_3: null,
                    binding_4: 1,
                    binding_5: true
                }
            ])

        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId })
        const records = await loadRecords({ widgetKey: 'marketing.navigation', rendererConfig: {}, query })

        expect(records[0]?.data).toEqual({ key: 'nav-home', label: { en: 'Home' }, href: '/', sectionKey: null, order: 1, visible: true })
        const sql = String(executor.query.mock.calls[3]?.[0])
        expect(sql).toContain('record."workspace_id" = $1')
        expect(sql).toContain('record."cmp_isvisible" = true')
        expect(sql).toContain('ORDER BY record."cmp_sortorder" ASC NULLS LAST, record."id" ASC')
        expect(sql).toContain(`LIMIT $2`)
        expect(executor.query.mock.calls[3]?.[1]).toEqual([workspaceId, slot.maxResolvedRecords! + 1])
    })

    it('validates relation metadata and constrains both child and parent rows before returning records', async () => {
        const { executor } = createMockDbExecutor()
        const childSlot = slotFor('marketing.pricing', 'benefits')
        const parentSlot = slotFor('marketing.pricing', 'tiers')
        const parentCodename = 'CustomPricingTiers'
        const childCodename = 'CustomPricingBenefits'
        const relation = childSlot.relation!
        const relationComponent = childSlot.requirements.components.find(({ field }) => field === relation.field)!
        const parentTarget = targetFor(parentSlot, parentCodename, { kind: 'record-set' })
        const query: WidgetBindingRecordQuery = {
            kind: 'relation-set',
            slot: childSlot.key,
            target: targetFor(childSlot, childCodename, { kind: 'relation-set', parentSlot: relation.parentSlot }),
            projection: childSlot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename })),
            selector: {
                relationComponentCodename: relationComponent.componentCodename,
                parentRecordIds: [tierRecordId],
                parentTarget
            },
            ordered: {
                orderByComponentCodename: childSlot.requirements.components.find(({ field }) => field === childSlot.orderByField)!
                    .componentCodename,
                visibilityComponentCodename: childSlot.requirements.components.find(({ field }) => field === childSlot.visibilityField)!
                    .componentCodename,
                limit: childSlot.maxResolvedRecords!
            }
        }
        executor.query
            .mockResolvedValueOnce([objectMetadata(childSlot, childCodename, objectIds.child, 'custom_pricing_benefits')])
            .mockResolvedValueOnce(componentMetadata(childSlot, objectIds.child, { id: objectIds.parent, codename: parentCodename }))
            .mockResolvedValueOnce([{ workspaceScoped: true }])
            .mockResolvedValueOnce([objectMetadata(parentSlot, parentCodename, objectIds.parent, 'custom_pricing_tiers')])
            .mockResolvedValueOnce(componentMetadata(parentSlot, objectIds.parent))
            .mockResolvedValueOnce([{ workspaceScoped: true }])
            .mockResolvedValueOnce([
                {
                    record_id: benefitRecordId,
                    binding_0: 'pro-benefit',
                    binding_1: tierRecordId,
                    binding_2: { en: 'Priority support' },
                    binding_3: 1,
                    binding_4: true
                }
            ])

        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId })
        const records = await loadRecords({ widgetKey: 'marketing.pricing', rendererConfig: {}, query })

        expect(records).toEqual([
            {
                recordId: benefitRecordId,
                data: { key: 'pro-benefit', tier: tierRecordId, label: { en: 'Priority support' }, order: 1, visible: true }
            }
        ])
        const sql = String(executor.query.mock.calls[6]?.[0])
        expect(sql).toContain('record."cmp_tierref" = ANY($2::uuid[])')
        expect(sql).toContain('EXISTS (')
        expect(sql).toContain('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."custom_pricing_tiers" parent_record')
        expect(sql).toContain('parent_record."workspace_id" = $1')
        expect(sql).toContain('"parent_record"."_app_published" = true')
        expect(sql).toContain('record."cmp_isvisible" = true')
        expect(executor.query.mock.calls[6]?.[1]).toEqual([workspaceId, [tierRecordId], childSlot.maxResolvedRecords! + 1])
    })

    it('rejects an over-limit or altered projection before issuing any SQL', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.navigation', 'items')
        const validQuery = queryForRecordSet(slot, 'CustomNavigationItems')
        if (validQuery.kind !== 'record-set') throw new Error('Expected record-set fixture')
        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId: null })

        await expect(
            loadRecords({
                widgetKey: 'marketing.navigation',
                rendererConfig: {},
                query: { ...validQuery, ordered: { ...validQuery.ordered, limit: slot.maxResolvedRecords! + 1 } }
            })
        ).rejects.toThrow('ordered selector does not match its query')
        await expect(
            loadRecords({
                widgetKey: 'marketing.navigation',
                rendererConfig: {},
                query: {
                    ...validQuery,
                    projection: [{ field: 'privateColumn', componentCodename: 'PrivateColumn' }]
                }
            })
        ).rejects.toThrow('binding projection is invalid')
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('fails closed when the published custom Object lacks required runtime capabilities', async () => {
        const { executor } = createMockDbExecutor()
        const slot = slotFor('marketing.brand', 'site')
        const query = queryForSemantic(slot, 'CustomSiteSettings', 'site-default')
        executor.query.mockResolvedValueOnce([
            { ...objectMetadata(slot, 'CustomSiteSettings', objectIds.child, 'custom_site_settings'), config: {} }
        ])
        const loadRecords = createPublicMarketingBindingRecordLoader(executor, { schemaName, workspaceId: null })

        await expect(loadRecords({ widgetKey: 'marketing.brand', rendererConfig: {}, query })).rejects.toThrow(
            'Object capabilities are incompatible'
        )
        expect(executor.query).toHaveBeenCalledTimes(1)
    })
})
