import { getLayoutWidgetDefinition, type WidgetBindingSlotDefinition } from '@universo-react/types'
import type { WidgetBindingRecordQuery } from '../../services/widgetBindingQuery'
import { createMockDbExecutor } from '../utils/dbMocks'
import {
    loadPublishedDashboardMenuEntities,
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
            presentation: {
                name: {
                    _primary: 'en',
                    locales: { en: { content: requirement.componentCodename }, ru: { content: `RU ${requirement.componentCodename}` } }
                }
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

const learnerEnrollmentQuery = (slot: WidgetBindingSlotDefinition, targetKind: 'course' | 'track'): WidgetBindingRecordQuery => {
    const order = slot.requirements.components.find(({ field }) => field === slot.orderByField)
    if (!order || !slot.maxResolvedRecords) throw new Error('Missing learner Enrollment ordering contract')
    const target = {
        entityKind: 'object' as const,
        entityCodename: 'Enrollments',
        selector: { kind: 'learner-enrollment-set' as const, targetKind },
        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    }
    return {
        kind: 'learner-enrollment-set',
        target,
        slot: slot.key,
        projection: target.projection,
        selector: { targetKind },
        ordered: { orderByComponentCodename: order.componentCodename, limit: slot.maxResolvedRecords }
    }
}

describe('widgetBindingRuntimeStore', () => {
    it('loads published Page and Hub metadata plus explicitly primary Objects through a bounded schema-qualified query', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([
            {
                id: objectId,
                codename: 'Welcome',
                kind: 'page',
                presentation: { en: 'Welcome' },
                config: { sortOrder: 1, runtime: { icon: 'home' } },
                table_name: null
            }
        ])

        await expect(loadPublishedDashboardMenuEntities(executor, schemaName)).resolves.toEqual([
            {
                id: objectId,
                codename: 'Welcome',
                kind: 'page',
                presentation: { en: 'Welcome' },
                config: { sortOrder: 1, runtime: { icon: 'home' } },
                tableName: null
            }
        ])

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain(`FROM "${schemaName}"."_app_objects"`)
        expect(String(sql)).toContain('"_app_published" = true')
        expect(String(sql)).toContain(`"kind" IN ('hub', 'page')`)
        expect(String(sql)).toContain(`"kind" = 'object'`)
        expect(String(sql)).toContain(`"config" -> 'runtime' ->> 'menuVisibility' = 'primary'`)
        expect(String(sql)).toContain('LIMIT $1')
        expect(parameters).toEqual([257])
    })

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
                        presentation: component.presentation,
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
        expect(metadata.componentsByObjectId.get(objectId)?.[0]?.presentation).toMatchObject({
            name: { locales: { en: { content: expect.any(String) } } }
        })
        const [objectSql, objectParameters] = executor.query.mock.calls[0] ?? []
        const [componentSql, componentParameters] = executor.query.mock.calls[1] ?? []
        expect(String(objectSql)).toContain("'object'")
        expect(String(objectSql)).toContain('"_app_published" = true')
        expect(String(objectSql)).toContain('LIMIT $2')
        expect(objectParameters).toEqual([[object.codename], 2])
        expect(String(componentSql)).toContain('"_app_published" = true')
        expect(String(componentSql)).toContain('"presentation"')
        expect(String(componentSql)).toContain('= ANY($2::text[])')
        expect(String(componentSql)).toContain('LIMIT $3')
        expect(componentParameters).toEqual([[objectId], requestedNames, 8193])
    })

    it('adds only configured owner and parent ACL fields to the bounded Component metadata request', async () => {
        const { executor } = createMockDbExecutor()
        const requestedNames = ['LogoKey', 'AltText']
        const aclObject = {
            ...object,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'OwnerId' },
                runtimeRecordParentAccess: {
                    mode: 'parentRecord',
                    parentObjectCodename: 'Account',
                    parentFieldCodename: 'AccountRef'
                }
            }
        }
        executor.query
            .mockResolvedValueOnce([
                { id: objectId, codename: object.codename, kind: 'object', table_name: object.tableName, config: aclObject.config }
            ])
            .mockResolvedValueOnce([])

        await loadRuntimeWidgetBindingMetadata(executor, schemaName, new Map([[String(object.codename), requestedNames]]))

        const [componentSql, componentParameters] = executor.query.mock.calls[1] ?? []
        expect(String(componentSql)).toContain('= ANY($2::text[])')
        expect(componentParameters).toEqual([[objectId], ['LogoKey', 'AltText', 'OwnerId', 'AccountRef'], 8193])
    })

    it('applies workspace, visibility, deterministic order, projection, and limit+1 in SQL', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        executor.query.mockResolvedValueOnce([
            {
                record_id: rowId,
                field_0: 'sydney',
                field_1: null,
                field_2: null,
                field_3: { en: 'Sydney' },
                field_4: 1,
                field_5: true,
                _upl_version: 6
            }
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
        expect(String(sql)).toContain('COALESCE(record."_upl_version", 1)::int AS "_upl_version"')
        expect(String(sql)).toContain(`ORDER BY "${orderColumn}" ASC NULLS LAST, "id" ASC`)
        expect(String(sql)).toContain('LIMIT $2')
        expect(String(sql)).not.toContain('SELECT *')
        expect(parameters).toEqual([workspaceId, 101])
        expect(rows).toEqual([
            {
                recordId: rowId,
                version: 6,
                data: { key: 'sydney', imageLight: null, imageDark: null, altText: { en: 'Sydney' }, order: 1, visible: true }
            }
        ])
    })

    it('scopes learner Enrollment rows to the trusted actor and fixed target kind in parameterized SQL', async () => {
        const { executor } = createMockDbExecutor()
        const actorId = '550e8400-e29b-41d4-a716-446655440000'
        const learnerObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            codename: 'Enrollments',
            tableName: 'app_enrollments'
        }
        const definition = getLayoutWidgetDefinition('detailsTable', { variant: 'learner-enrollments' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!slot) throw new Error('Learner Enrollment rows slot is missing')
        const components = componentsFor(learnerObject, slot)
        executor.query.mockResolvedValueOnce([
            { record_id: rowId, field_0: { en: 'Compliance Refresh Course' }, field_1: actorId, field_2: 'course', _upl_version: 3 }
        ])

        const rows = await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            currentUserId: actorId,
            query: learnerEnrollmentQuery(slot, 'course'),
            object: learnerObject,
            components,
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        const assignedUserColumn = components.find(({ codename }) => codename === 'AssignedUserId')?.columnName
        const targetTypeColumn = components.find(({ codename }) => codename === 'TargetType')?.columnName
        expect(String(sql)).toContain(`FROM "${schemaName}"."app_enrollments" AS record`)
        expect(String(sql)).toContain(`"${assignedUserColumn}" = $2`)
        expect(String(sql)).toContain(`"${targetTypeColumn}" = $3`)
        expect(String(sql)).toContain('"workspace_id" = $1')
        expect(String(sql)).toContain('"_app_published" = true')
        expect(String(sql)).toContain('LIMIT $4')
        expect(parameters).toEqual([workspaceId, actorId, 'course', slot.maxResolvedRecords + 1])
        expect(rows).toEqual([
            {
                recordId: rowId,
                version: 3,
                data: {
                    title: { en: 'Compliance Refresh Course' },
                    assignedUser: actorId,
                    targetKind: 'course'
                }
            }
        ])
    })

    it('fails closed when learner Enrollment scope lacks an authenticated UUIDv7-independent actor UUID', async () => {
        const { executor } = createMockDbExecutor()
        const learnerObject: RuntimeWidgetBindingObjectMetadata = { ...object, codename: 'Enrollments', tableName: 'app_enrollments' }
        const definition = getLayoutWidgetDefinition('detailsTable', { variant: 'learner-enrollments' })
        const slot = definition?.bindingSlots?.find(({ key }) => key === 'rows')
        if (!slot) throw new Error('Learner Enrollment rows slot is missing')

        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                schemaName,
                workspaceId,
                workspacesEnabled: true,
                currentUserId: 'not-an-authenticated-user',
                query: learnerEnrollmentQuery(slot, 'track'),
                object: learnerObject,
                components: componentsFor(learnerObject, slot),
                slot
            })
        ).rejects.toThrow('Learner enrollment scope is unavailable')
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('fails closed on an invalid record version instead of projecting a mutation target', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        executor.query.mockResolvedValueOnce([{ record_id: rowId, _upl_version: Number.MAX_SAFE_INTEGER + 1 }])

        await expect(
            loadWidgetBindingRuntimeRecords(executor, {
                schemaName,
                workspaceId: null,
                workspacesEnabled: false,
                query: recordSetQuery(slot, 'CustomLogos'),
                object,
                components: componentsFor(object, slot),
                slot
            })
        ).rejects.toThrow('record version is invalid')
    })

    it('filters anonymous bound-record reads when the source Object uses owner-or-shared access', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        const query = recordSetQuery(slot, 'CustomLogos')
        const privateObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordAccess: { mode: 'ownerOrShared', ownerColumnName: 'owner_id' },
                runtimeLibrary: {
                    shared: {
                        objectCodename: 'RecordShares',
                        targetObjectFieldCodename: 'TargetObject',
                        targetRecordFieldCodename: 'TargetRecord'
                    }
                }
            }
        }
        executor.query.mockResolvedValueOnce([])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            currentUserId: null,
            query,
            object: privateObject,
            components: componentsFor(privateObject, slot),
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain('AND (FALSE)')
        expect(parameters).toEqual([workspaceId, slot.maxResolvedRecords! + 1])
    })

    it('fails closed when a bound source has a malformed record-access policy', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        const query = recordSetQuery(slot, 'CustomLogos')
        const malformedObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordAccess: { mode: 'ownerOrShared' }
            }
        }
        executor.query.mockResolvedValueOnce([])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId: null,
            workspacesEnabled: false,
            currentUserId: 'member-user-id',
            query,
            object: malformedObject,
            components: componentsFor(malformedObject, slot),
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain('AND (FALSE)')
        expect(parameters).toEqual([slot.maxResolvedRecords! + 1])
    })

    it.each([null, false])('fails closed when a bound source has an explicitly malformed parent policy: %s', async (invalidPolicy) => {
        const { slot } = definitionAndSlot()
        const query = recordSetQuery(slot, 'CustomLogos')
        const { executor } = createMockDbExecutor()
        const malformedObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordParentAccess: invalidPolicy
            }
        }
        executor.query.mockResolvedValueOnce([])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId: null,
            workspacesEnabled: false,
            currentUserId: 'member-user-id',
            query,
            object: malformedObject,
            components: componentsFor(malformedObject, slot),
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[0] ?? []
        expect(String(sql)).toContain('AND (FALSE)')
        expect(parameters).toEqual([slot.maxResolvedRecords! + 1])
    })

    it('applies the shared owner-or-shared row policy to authenticated bound-record reads', async () => {
        const { executor } = createMockDbExecutor()
        const { slot } = definitionAndSlot()
        const query = recordSetQuery(slot, 'CustomLogos')
        const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312290'
        const relationObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312291'
        const privateObject: RuntimeWidgetBindingObjectMetadata = {
            ...object,
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'OwnerId' },
                runtimeLibrary: {
                    shared: {
                        objectCodename: 'RecordShares',
                        targetObjectFieldCodename: 'TargetObject',
                        targetRecordFieldCodename: 'TargetRecord',
                        principalTypeFieldCodename: 'PrincipalType',
                        principalIdFieldCodename: 'PrincipalId',
                        allowedPrincipalTypes: ['user']
                    }
                }
            }
        }
        const ownerComponent: RuntimeWidgetBindingComponentMetadata = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312292',
            objectId,
            codename: 'OwnerId',
            columnName: 'owner_id',
            dataType: 'UUID',
            isRequired: false,
            validationRules: {}
        }
        const relationAttrs = [
            ['TargetObject', 'target_object'],
            ['TargetRecord', 'target_record'],
            ['PrincipalType', 'principal_type'],
            ['PrincipalId', 'principal_id']
        ].map(([codename, column_name], index) => ({
            id: `019ccefc-2f7b-7b36-82f4-85cdb131229${3 + index}`,
            codename,
            column_name,
            data_type: 'STRING',
            is_required: false,
            validation_rules: {},
            target_object_id: null,
            target_object_kind: null,
            ui_config: {}
        }))
        executor.query
            .mockResolvedValueOnce([{ id: relationObjectId, codename: 'RecordShares', table_name: 'record_shares', config: {} }])
            .mockResolvedValueOnce(relationAttrs)
            .mockResolvedValueOnce([
                { record_id: rowId, ...Object.fromEntries(query.projection.map((_, index) => [`field_${index}`, null])) }
            ])

        await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            currentUserId: userId,
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: false
            },
            query,
            object: privateObject,
            components: [...componentsFor(privateObject, slot), ownerComponent],
            slot
        })

        const [sql, parameters] = executor.query.mock.calls[2] ?? []
        expect(String(sql)).toContain('"owner_id" = $2')
        expect(String(sql)).toContain('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."record_shares" rel')
        expect(String(sql)).toContain('rel."principal_type" = ANY($5::text[])')
        expect(parameters).toEqual([workspaceId, userId, 'CustomLogos', userId, ['user'], slot.maxResolvedRecords! + 1])
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
            config: {
                capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'AccountOwner' },
                runtimeLibrary: {
                    shared: {
                        objectCodename: 'RecordShares',
                        targetObjectFieldCodename: 'TargetObject',
                        targetRecordFieldCodename: 'TargetRecord',
                        principalTypeFieldCodename: 'PrincipalType',
                        principalIdFieldCodename: 'PrincipalId',
                        allowedPrincipalTypes: ['user']
                    }
                }
            }
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
        const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312290'
        const relationObjectId = '019ccefc-2f7b-7b36-82f4-85cdb1312291'
        const relationAttrs = [
            ['TargetObject', 'target_object'],
            ['TargetRecord', 'target_record'],
            ['PrincipalType', 'principal_type'],
            ['PrincipalId', 'principal_id']
        ].map(([codename, column_name], index) => ({
            id: `019ccefc-2f7b-7b36-82f4-85cdb131229${3 + index}`,
            codename,
            column_name,
            data_type: 'STRING',
            is_required: false,
            validation_rules: {},
            target_object_id: null,
            target_object_kind: null,
            ui_config: {}
        }))
        executor.query
            .mockResolvedValueOnce([{ id: relationObjectId, codename: 'RecordShares', table_name: 'record_shares', config: {} }])
            .mockResolvedValueOnce(relationAttrs)
            .mockResolvedValueOnce([
                {
                    record_id: rowId,
                    field_0: 'starter-support',
                    field_1: parentRecordId,
                    field_2: { en: 'Support' },
                    field_3: 1,
                    field_4: true,
                    _upl_version: 7
                }
            ])

        const rows = await loadWidgetBindingRuntimeRecords(executor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            currentUserId: userId,
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: false,
                editContent: false,
                deleteContent: false,
                readReports: false
            },
            query,
            object: { ...object, codename: 'MarketingPagePricingBenefit' },
            components,
            slot,
            parentObject,
            parentComponents: [
                ...componentsFor(parentObject, parentSlot),
                {
                    id: '019ccefc-2f7b-7b36-82f4-85cdb1312292',
                    objectId: parentObject.id,
                    codename: 'AccountOwner',
                    columnName: 'account_owner_id',
                    dataType: 'UUID',
                    isRequired: false,
                    validationRules: {}
                }
            ],
            parentSlot,
            parentObjectId
        })

        const [sql, parameters] = executor.query.mock.calls[2] ?? []
        const relationColumn = components.find(({ codename }) => codename === 'TierRef')?.columnName
        const visibleColumn = components.find(({ codename }) => codename === 'IsVisible')?.columnName
        expect(String(sql)).toContain(`"${relationColumn}" = ANY($6::uuid[])`)
        expect(String(sql)).toContain('COALESCE(record."_upl_version", 1)::int AS "_upl_version"')
        expect(String(sql)).toContain('EXISTS (')
        expect(String(sql)).toContain('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."marketing_pricing_tiers" parent_record')
        expect(String(sql)).toContain('parent_record."workspace_id" = $1')
        expect(String(sql)).toContain('parent_record."_app_published" = true')
        expect(String(sql)).toContain('"account_owner_id" = $2')
        expect(String(sql)).toContain('FROM "app_019ccefc2f7b7b3682f485cdb1312268"."record_shares" rel')
        expect(String(sql)).toContain(`"${visibleColumn}" = true`)
        expect(parameters).toEqual([workspaceId, userId, 'MarketingPagePricing', userId, ['user'], [parentRecordId], 201])
        expect(rows[0]?.data._upl_version).toBe(7)

        const invalidParentAclExecutor = createMockDbExecutor().executor
        invalidParentAclExecutor.query.mockResolvedValueOnce([])
        await loadWidgetBindingRuntimeRecords(invalidParentAclExecutor, {
            schemaName,
            workspaceId,
            workspacesEnabled: true,
            currentUserId: userId,
            query,
            object: { ...object, codename: 'MarketingPagePricingBenefit' },
            components,
            slot,
            parentObject: {
                ...parentObject,
                config: {
                    capabilities: { dataSchema: { enabled: true }, records: { enabled: true } },
                    runtimeRecordParentAccess: false
                }
            },
            parentComponents: componentsFor(parentObject, parentSlot),
            parentSlot,
            parentObjectId
        })

        const [invalidParentSql] = invalidParentAclExecutor.query.mock.calls[0] ?? []
        expect(String(invalidParentSql)).toContain('EXISTS (')
        expect(String(invalidParentSql)).toContain('AND (FALSE)')

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
