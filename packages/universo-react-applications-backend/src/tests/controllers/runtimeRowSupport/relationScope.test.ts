import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import { UpdateFailure, type RuntimeSchemaContext } from '../../../shared/runtimeHelpers'
import type { RuntimeObjectCollectionAttr, RuntimeZoneWidgets } from '../../../services/runtimeRowSupport/contracts'
import { lockRuntimeRelationParentRecord, resolveRuntimeRelationWriteScope } from '../../../controllers/runtimeRowSupport/relationScope'
import { attachRuntimeRelationAuthorityProjection } from '../../../services/runtimeRowSupport/runtimeRelationAuthority'
import { createRelationBuilderEffectiveWidget } from './runtimeRelationAuthorityFixture'

const parentObjectId = '0190a9b5-3cde-7abc-8def-0123456789d1'
const parentRecordId = '0190a9b5-3cde-7abc-8def-0123456789d2'

const childAttrs: RuntimeObjectCollectionAttr[] = [
    {
        id: 'course-ref',
        codename: 'CourseId',
        column_name: 'course_id',
        data_type: 'REF',
        ui_config: { serverOwned: true },
        is_required: true,
        target_object_id: parentObjectId,
        target_object_kind: 'object'
    },
    {
        id: 'sort-order',
        codename: 'SortOrder',
        column_name: 'sort_order',
        data_type: 'NUMBER',
        ui_config: { serverOwned: true },
        is_required: true
    }
]

const parentAttrs: RuntimeObjectCollectionAttr[] = [
    {
        id: 'course-title',
        codename: 'Title',
        column_name: 'title',
        data_type: 'STRING',
        is_required: true
    }
]

const effectiveRelationWidget = createRelationBuilderEffectiveWidget()
const zoneWidgets: RuntimeZoneWidgets = attachRuntimeRelationAuthorityProjection(
    {
        left: [],
        top: [],
        right: [],
        bottom: [],
        center: [
            {
                id: effectiveRelationWidget.id,
                layoutId: 'layout-1',
                widgetKey: effectiveRelationWidget.widgetKey,
                sortOrder: effectiveRelationWidget.sortOrder,
                config: effectiveRelationWidget.config
            }
        ]
    },
    [effectiveRelationWidget]
)

const makeExecutor = (query: jest.Mock): DbExecutor => ({ query } as unknown as DbExecutor)

const resolveScope = async (
    query: jest.Mock,
    overrides: Partial<{
        parentRecordId: string
        childCodename: string
        parentFieldServerOwned: boolean
        childAttrs: RuntimeObjectCollectionAttr[]
        zoneWidgets: RuntimeZoneWidgets
    }> = {}
) =>
    resolveRuntimeRelationWriteScope({
        manager: makeExecutor(query),
        schemaIdent: '"app_test"',
        zoneWidgets: overrides.zoneWidgets ?? zoneWidgets,
        childEntity: { id: '0190a9b5-3cde-7abc-8def-0123456789d4', codename: overrides.childCodename ?? 'CourseItems' },
        childAttrs:
            overrides.childAttrs ??
            (overrides.parentFieldServerOwned === false
                ? childAttrs.map((attr, index) => (index === 0 ? { ...attr, ui_config: null } : attr))
                : childAttrs),
        request: {
            fieldCodename: 'CourseId',
            parentRecordId: overrides.parentRecordId ?? parentRecordId,
            layoutTarget: { targetKind: 'object', entityTypeId: parentObjectId }
        }
    })

describe('resolveRuntimeRelationWriteScope', () => {
    const makeMetadataQuery = () =>
        jest.fn(async (sql: string) => {
            if (sql.includes('FROM "app_test"._app_objects')) {
                return [{ id: parentObjectId, kind: 'object', codename: 'Courses', table_name: 'courses', config: null }]
            }
            if (sql.includes('FROM "app_test"._app_components')) return parentAttrs
            return []
        })

    it('resolves scope from the validated Entity binding without scanning runtime record tables', async () => {
        const query = makeMetadataQuery()
        const scope = await resolveScope(query)

        expect(scope).toMatchObject({
            request: { fieldCodename: 'CourseId', parentRecordId },
            parentFieldAttr: { column_name: 'course_id', target_object_id: parentObjectId },
            parentCollection: { id: parentObjectId, codename: 'Courses', table_name: 'courses' },
            sortOrderAttr: { column_name: 'sort_order', data_type: 'NUMBER' }
        })
        expect(scope?.ownedFieldAttrs.map(({ column_name }) => column_name)).toEqual(['course_id', 'sort_order'])
        expect(query.mock.calls.every(([sql]) => !sql.includes('FROM "app_test".courses'))).toBe(true)
    })

    it('rejects an Entity mismatch and defers exact parent record access to the lock query', async () => {
        const query = makeMetadataQuery()
        const requestedParentRecordId = '0190a9b5-3cde-7abc-8def-0123456789d3'

        await expect(resolveScope(query, { parentRecordId: requestedParentRecordId })).resolves.toMatchObject({
            request: { parentRecordId: requestedParentRecordId }
        })
        await expect(resolveScope(query, { childCodename: 'OtherItems' })).resolves.toBeNull()

        const unavailableParentQuery = jest.fn(async () => [])
        const authorizedEntityScope = await resolveScope(makeMetadataQuery(), { parentRecordId: requestedParentRecordId })
        if (!authorizedEntityScope) throw new Error('Expected Entity-level relation authority')
        await expect(
            lockRuntimeRelationParentRecord({
                executor: makeExecutor(unavailableParentQuery),
                ctx: {
                    schemaName: 'app_test',
                    schemaIdent: '"app_test"',
                    userId: 'user-1',
                    role: 'editor',
                    permissions: {} as RuntimeSchemaContext['permissions'],
                    currentWorkspaceId: null,
                    workspacesEnabled: false
                } as RuntimeSchemaContext,
                scope: authorizedEntityScope
            })
        ).rejects.toMatchObject<Partial<UpdateFailure>>({ statusCode: 404 })
        expect(unavailableParentQuery).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE OF parentRecord'), [
            requestedParentRecordId
        ])
    })

    it('rejects relation scopes when the parent field is not server-owned', async () => {
        await expect(resolveScope(makeMetadataQuery(), { parentFieldServerOwned: false })).resolves.toBeNull()
    })

    it('requires the panel ordering field to be server-owned even when manual reordering is disabled', async () => {
        const noReorderWidget = createRelationBuilderEffectiveWidget({ enableRowReordering: false })
        const noReorderZoneWidgets = attachRuntimeRelationAuthorityProjection(
            {
                left: [],
                top: [],
                right: [],
                bottom: [],
                center: [{ ...noReorderWidget, layoutId: 'layout-1' }]
            },
            [noReorderWidget]
        )
        const attrs = childAttrs.map((attr, index) => (index === 1 ? { ...attr, ui_config: null } : attr))

        await expect(resolveScope(makeMetadataQuery(), { zoneWidgets: noReorderZoneWidgets, childAttrs: attrs })).resolves.toBeNull()
    })

    it('requires every relationBuilder-owned field in the host layout to be server-owned', async () => {
        const siblingWidget = createRelationBuilderEffectiveWidget({
            parentFieldCodename: 'AlternateCourseId',
            sortOrderFieldCodename: 'AlternateSortOrder'
        })
        const widgets = attachRuntimeRelationAuthorityProjection(
            {
                left: [],
                top: [],
                right: [],
                bottom: [],
                center: [...zoneWidgets.center, { ...siblingWidget, layoutId: 'layout-1' }]
            },
            [effectiveRelationWidget, siblingWidget]
        )
        const siblingAttrs: RuntimeObjectCollectionAttr[] = [
            {
                id: 'alternate-course-ref',
                codename: 'AlternateCourseId',
                column_name: 'alternate_course_id',
                data_type: 'REF',
                ui_config: { serverOwned: true },
                is_required: false,
                target_object_id: parentObjectId,
                target_object_kind: 'object'
            },
            {
                id: 'alternate-sort-order',
                codename: 'AlternateSortOrder',
                column_name: 'alternate_sort_order',
                data_type: 'NUMBER',
                ui_config: { serverOwned: true },
                is_required: false
            }
        ]

        await expect(
            resolveScope(makeMetadataQuery(), {
                zoneWidgets: widgets,
                childAttrs: [...childAttrs, { ...siblingAttrs[0]!, ui_config: null }, siblingAttrs[1]!]
            })
        ).resolves.toBeNull()
        await expect(
            resolveScope(makeMetadataQuery(), { zoneWidgets: widgets, childAttrs: [...childAttrs, ...siblingAttrs] })
        ).resolves.toMatchObject({
            ownedFieldAttrs: expect.arrayContaining([
                expect.objectContaining({ column_name: 'alternate_course_id' }),
                expect.objectContaining({ column_name: 'alternate_sort_order' })
            ])
        })
    })
})

describe('lockRuntimeRelationParentRecord', () => {
    const context = {
        schemaName: 'app_test',
        schemaIdent: '"app_test"',
        userId: 'user-1',
        role: 'editor',
        permissions: {} as RuntimeSchemaContext['permissions'],
        currentWorkspaceId: null,
        workspacesEnabled: false
    } as RuntimeSchemaContext

    it('locks the authorized active parent row before any scoped child mutation', async () => {
        const query = jest.fn(async () => [{ id: parentRecordId, _upl_locked: false }])
        const scope = await resolveScope(
            jest.fn(async (sql: string) => {
                if (sql.includes('FROM "app_test"._app_objects')) {
                    return [{ id: parentObjectId, kind: 'object', codename: 'Courses', table_name: 'courses', config: null }]
                }
                if (sql.includes('FROM "app_test"._app_components')) return parentAttrs
                return []
            })
        )
        if (!scope) throw new Error('Expected authorized relation scope')

        await expect(lockRuntimeRelationParentRecord({ executor: makeExecutor(query), ctx: context, scope })).resolves.toBeUndefined()

        expect(query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE OF parentRecord'), [parentRecordId])
        expect(query.mock.calls[0]?.[0]).toContain('AND TRUE')
    })

    it('fails closed when the parent row is locked or unavailable', async () => {
        const scope = {
            request: { fieldCodename: 'CourseId', parentRecordId },
            parentFieldAttr: childAttrs[0]!,
            parentCollection: {
                id: parentObjectId,
                kind: 'object',
                codename: 'Courses',
                table_name: 'courses',
                config: null,
                lifecycleContract: resolveApplicationLifecycleContractFromConfig(null)
            },
            parentAttrs,
            sortOrderAttr: childAttrs[1]!,
            ownedFieldAttrs: childAttrs,
            authority: {
                slotKey: 'panel:items',
                parentFieldCodename: 'CourseId',
                parentEntityCodename: 'Courses',
                parentRecordId,
                childEntityCodename: 'CourseItems',
                sortOrderFieldCodename: 'SortOrder',
                enableRowReordering: true
            }
        }

        await expect(
            lockRuntimeRelationParentRecord({
                executor: makeExecutor(jest.fn(async () => [])),
                ctx: context,
                scope
            })
        ).rejects.toMatchObject<Partial<UpdateFailure>>({ statusCode: 404 })
        await expect(
            lockRuntimeRelationParentRecord({
                executor: makeExecutor(jest.fn(async () => [{ id: parentRecordId, _upl_locked: true }])),
                ctx: context,
                scope
            })
        ).rejects.toMatchObject<Partial<UpdateFailure>>({ statusCode: 423 })
    })
})
