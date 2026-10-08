import {
    loadSavedRuntimeReportSource,
    loadSavedRuntimeReportSourceById,
    SavedRuntimeReportSourceError,
    type SavedRuntimeReportReadScope
} from '../../persistence/savedRuntimeReportSourceStore'
import { createMockDbExecutor, type MockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312275'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312277'
const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312290'
const outsiderId = '019ccefc-2f7b-7b36-82f4-85cdb1312293'
const otherOwnerId = '019ccefc-2f7b-7b36-82f4-85cdb1312294'
const otherWorkspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312295'
const reportRecordId = '019ccefc-2f7b-7b36-82f4-85cdb1312296'
const relationId = '019ccefc-2f7b-7b36-82f4-85cdb1312291'
const reportCodename = 'LearnerProgress'
const scope: SavedRuntimeReportReadScope = {
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
        readReports: true
    }
}
const definition = {
    codename: reportCodename,
    title: { en: 'Learner progress' },
    datasource: { kind: 'records.list', sectionCodename: 'ContentProgress' },
    columns: [{ field: 'Learner', label: 'Learner', type: 'text' }],
    filters: [],
    aggregations: []
}
const source = { id: objectId, codename: 'Reports', kind: 'object', table_name: 'obj_reports', config: {} }
const component = {
    id: '019ccefc-2f7b-7b36-82f4-85cdb1312292',
    object_id: objectId,
    codename: 'Definition',
    column_name: 'report_definition',
    data_type: 'JSON',
    is_required: true
}
const ownerComponent = { ...component, codename: 'OwnerId', column_name: 'owner_id', data_type: 'UUID' }
const aclConfig = {
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

const queueMetadata = (
    executor: MockDbExecutor,
    objectOverrides: Record<string, unknown> = {},
    components: Record<string, unknown>[] = [component]
) => {
    executor.query.mockResolvedValueOnce([{ ...source, ...objectOverrides }]).mockResolvedValueOnce(components)
}

const expectSourceError = async (result: Promise<unknown>, reason: SavedRuntimeReportSourceError['reason']) => {
    await expect(result).rejects.toMatchObject({ name: 'SavedRuntimeReportSourceError', reason })
}

describe('savedRuntimeReportSourceStore SQL-first reads', () => {
    it.each([
        ['anonymous', { currentUserId: null }],
        ['absent user', { currentUserId: undefined }],
        ['empty user', { currentUserId: '' }],
        ['missing permissions', { permissions: undefined }],
        ['readReports denied', { permissions: { ...scope.permissions!, readReports: false } }],
        ['admin without readReports', { permissions: { ...scope.permissions!, manageApplication: true, readReports: false } }],
        ['missing workspace', { workspaceId: null }],
        ['workspace supplied for unscoped application', { workspacesEnabled: false }],
        ['malformed workspace', { workspaceId: 'not-a-uuid' }],
        ['non-v7 workspace', { workspaceId: '019ccefc-2f7b-4b36-82f4-85cdb1312277' }]
    ] as const)('denies %s before any metadata or record SQL', async (_label, overrides) => {
        const { executor } = createMockDbExecutor()
        await expectSourceError(loadSavedRuntimeReportSource(executor, { ...scope, ...overrides }, reportCodename), 'permission-denied')
        expect(executor.query).not.toHaveBeenCalled()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it.each(['', '9Report', 'Report name', "Report' OR true--", 'Report;DROP', 'Report/Other', 'R'.repeat(129)])(
        'rejects malformed report reference %j before SQL',
        async (codename) => {
            const { executor } = createMockDbExecutor()
            await expectSourceError(loadSavedRuntimeReportSource(executor, scope, codename), 'malformed-config')
            expect(executor.query).not.toHaveBeenCalled()
        }
    )

    it.each([definition, JSON.stringify(definition)])(
        'returns a validated saved definition from native or encoded JSON',
        async (stored) => {
            const { executor } = createMockDbExecutor()
            queueMetadata(executor)
            executor.query.mockResolvedValueOnce([{ definition: stored }])
            await expect(loadSavedRuntimeReportSource(executor, scope, reportCodename)).resolves.toEqual(definition)

            expect(executor.query).toHaveBeenCalledTimes(3)
            const [objectSql, objectParams] = executor.query.mock.calls[0]
            const [componentSql, componentParams] = executor.query.mock.calls[1]
            expect(objectSql).toContain(`FROM "${schemaName}"."_app_objects"`)
            expect(objectSql).toContain('"kind" = \'object\'')
            expect(objectSql).toContain('= ANY($1::text[])')
            expect(objectSql).toContain('LIMIT $2')
            expect(objectParams).toEqual([['Reports'], 2])
            expect(componentSql).toContain(`FROM "${schemaName}"."_app_components"`)
            expect(componentSql).toContain('"object_id" = ANY($1::uuid[])')
            expect(componentSql).toContain('= ANY($2::text[])')
            expect(componentParams).toEqual([[objectId], ['Definition'], 8193])
            for (const sql of [objectSql, componentSql]) {
                for (const flag of ['_upl_deleted', '_app_deleted', '_upl_archived', '_app_archived']) {
                    expect(sql).toContain(`"${flag}" = false`)
                }
                expect(sql).toContain('"_app_published" = true')
            }
        }
    )

    it('quotes published physical identifiers, binds the codename, and probes duplicate definitions with LIMIT 2', async () => {
        const { executor } = createMockDbExecutor()
        const codename = 'Report.v2-summary_1'
        queueMetadata(executor, { table_name: 'reports_physical' }, [{ ...component, column_name: 'definition_physical' }])
        executor.query.mockResolvedValueOnce([{ definition: { ...definition, codename } }])
        await loadSavedRuntimeReportSource(executor, scope, codename)

        const [sql, parameters] = executor.query.mock.calls[2]
        expect(sql).toContain('SELECT "definition_physical" AS "definition"')
        expect(sql).toContain(`FROM "${schemaName}"."reports_physical" AS "report_record"`)
        expect(sql).toContain('"definition_physical"->>\'codename\' = $1')
        expect(sql).toContain('ORDER BY "id" ASC')
        expect(sql).toContain('LIMIT 2')
        expect(sql).not.toContain(codename)
        expect(parameters).toEqual([codename])
    })

    it.each([false, true])('keeps unrestricted and admin ACL reads executable (admin=%s)', async (admin) => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor, { config: admin ? aclConfig : {} }, [component, ownerComponent])
        executor.query.mockResolvedValueOnce([{ definition }])
        await loadSavedRuntimeReportSource(
            executor,
            {
                ...scope,
                permissions: { ...scope.permissions!, manageApplication: admin }
            },
            reportCodename
        )
        const [sql] = executor.query.mock.calls[2]
        expect(sql).not.toMatch(/\b(?:null|undefined)\b/i)
        expect(sql).not.toContain('AND (FALSE)')
    })

    it('enforces active lifecycle and request-scoped workspace predicates before selecting a saved report', async () => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor)
        executor.query.mockResolvedValueOnce([])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'stale-source')
        const [sql] = executor.query.mock.calls[2]
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
        expect(sql).toContain("workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
        expect(sql).not.toContain(workspaceId)
    })

    it('permits applications without workspaces without adding a workspace predicate', async () => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor)
        executor.query.mockResolvedValueOnce([{ definition }])
        await expect(
            loadSavedRuntimeReportSource(executor, { ...scope, workspacesEnabled: false, workspaceId: null }, reportCodename)
        ).resolves.toEqual(definition)
        expect(executor.query.mock.calls[2][0]).not.toContain('workspace_id')
    })

    it('loads the configured owner field and enforces owner-or-shared ACL with bound principals and a correlated record id', async () => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor, { config: aclConfig }, [component, ownerComponent])
        const relationAttrs = [
            ['TargetObject', 'target_object'],
            ['TargetRecord', 'target_record'],
            ['PrincipalType', 'principal_type'],
            ['PrincipalId', 'principal_id']
        ].map(([codename, column_name]) => ({ codename, column_name, data_type: 'STRING', is_required: false }))
        executor.query
            .mockResolvedValueOnce([{ id: relationId, codename: 'RecordShares', table_name: 'record_shares', config: {} }])
            .mockResolvedValueOnce(relationAttrs)
            .mockResolvedValueOnce([{ definition }])
        await expect(loadSavedRuntimeReportSource(executor, scope, reportCodename)).resolves.toEqual(definition)

        expect(executor.query.mock.calls[1][1]).toEqual([[objectId], ['Definition', 'OwnerId'], 8193])
        const [sql, parameters] = executor.query.mock.calls[4]
        expect(sql).toContain('"owner_id" = $1 OR EXISTS (')
        expect(sql).toContain(`FROM "${schemaName}"."record_shares" rel`)
        expect(sql).toContain('rel."target_object"::text = $2::text')
        expect(sql).toContain('rel."target_record"::text = "report_record"."id"::text')
        expect(sql).toContain('rel."principal_id"::text = $3::text')
        expect(sql).toContain('rel."principal_type" = ANY($4::text[])')
        expect(sql).toContain('rel._upl_deleted = false')
        expect(sql).toContain('rel._app_deleted = false')
        expect(sql).toContain("rel.workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
        expect(sql).toContain('"report_definition"->>\'codename\' = $5')
        expect(sql).not.toContain(userId)
        expect(parameters).toEqual([userId, 'Reports', userId, ['user'], reportCodename])
    })

    it.each(['codename', 'id'] as const)(
        'uses the same owner, shared, outsider, and workspace policy for %s references',
        async (referenceKind) => {
            const relationAttrs = [
                ['TargetObject', 'target_object'],
                ['TargetRecord', 'target_record'],
                ['PrincipalType', 'principal_type'],
                ['PrincipalId', 'principal_id']
            ].map(([codename, column_name]) => ({ codename, column_name, data_type: 'STRING', is_required: false }))
            const scenarios = [
                {
                    name: 'owner in current workspace',
                    actorId: userId,
                    recordWorkspaceId: workspaceId,
                    ownerId: userId,
                    sharePrincipalId: null,
                    shareWorkspaceId: null,
                    authorized: true
                },
                {
                    name: 'shared user in current workspace',
                    actorId: userId,
                    recordWorkspaceId: workspaceId,
                    ownerId: otherOwnerId,
                    sharePrincipalId: userId,
                    shareWorkspaceId: workspaceId,
                    authorized: true
                },
                {
                    name: 'outsider without a matching share',
                    actorId: outsiderId,
                    recordWorkspaceId: workspaceId,
                    ownerId: otherOwnerId,
                    sharePrincipalId: userId,
                    shareWorkspaceId: workspaceId,
                    authorized: false
                },
                {
                    name: 'owner record in another workspace',
                    actorId: userId,
                    recordWorkspaceId: otherWorkspaceId,
                    ownerId: userId,
                    sharePrincipalId: null,
                    shareWorkspaceId: null,
                    authorized: false
                },
                {
                    name: 'share in another workspace',
                    actorId: userId,
                    recordWorkspaceId: workspaceId,
                    ownerId: otherOwnerId,
                    sharePrincipalId: userId,
                    shareWorkspaceId: otherWorkspaceId,
                    authorized: false
                }
            ] as const

            for (const scenario of scenarios) {
                const { executor } = createMockDbExecutor()
                queueMetadata(executor, { config: aclConfig }, [component, ownerComponent])
                const recordIsInScope = scenario.recordWorkspaceId === workspaceId
                const hasOwnerAccess = scenario.ownerId === scenario.actorId
                const hasSharedAccess = scenario.sharePrincipalId === scenario.actorId && scenario.shareWorkspaceId === workspaceId
                const authorized = recordIsInScope && (hasOwnerAccess || hasSharedAccess)
                executor.query
                    .mockResolvedValueOnce([{ id: relationId, codename: 'RecordShares', table_name: 'record_shares', config: {} }])
                    .mockResolvedValueOnce(relationAttrs)
                    .mockResolvedValueOnce(authorized ? [{ definition }] : [])

                const scenarioScope = { ...scope, currentUserId: scenario.actorId }
                const result =
                    referenceKind === 'id'
                        ? loadSavedRuntimeReportSourceById(executor, scenarioScope, reportRecordId)
                        : loadSavedRuntimeReportSource(executor, scenarioScope, reportCodename)

                if (scenario.authorized) {
                    await expect(result).resolves.toEqual(definition)
                } else {
                    await expectSourceError(result, 'stale-source')
                }
                expect(authorized).toBe(scenario.authorized)

                const [sql, parameters] = executor.query.mock.calls[4]
                expect(sql).toContain('"owner_id" = $1 OR EXISTS (')
                expect(sql).toContain("rel.workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
                expect(sql).toContain("AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
                expect(parameters).toEqual([
                    scenario.actorId,
                    'Reports',
                    scenario.actorId,
                    ['user'],
                    referenceKind === 'id' ? reportRecordId : reportCodename
                ])
                if (referenceKind === 'id') {
                    expect(sql).toContain('"report_record"."id"::text = $5')
                    expect(sql).not.toContain('"report_definition"->>\'codename\' = $5')
                } else {
                    expect(sql).toContain('"report_definition"->>\'codename\' = $5')
                    expect(sql).not.toContain('"report_record"."id"::text = $5')
                }
                if (!scenario.authorized) {
                    expect(executor.query.mock.calls[4][1]).not.toContain(otherWorkspaceId)
                }
            }
        }
    )

    it.each(['not-a-uuid', '019ccefc-2f7b-4b36-82f4-85cdb1312296'])(
        'rejects non-v7 report IDs before metadata SQL: %s',
        async (invalidId) => {
            const { executor } = createMockDbExecutor()
            await expectSourceError(loadSavedRuntimeReportSourceById(executor, scope, invalidId), 'malformed-config')
            expect(executor.query).not.toHaveBeenCalled()
        }
    )

    it.each([
        ['malformed policy', { runtimeRecordAccess: false }, [component]],
        ['missing owner metadata', aclConfig, [component]],
        ['missing sharing policy', { runtimeRecordAccess: aclConfig.runtimeRecordAccess }, [component, ownerComponent]]
    ] as const)('fails closed for %s', async (_label, config, components) => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor, { config }, [...components])
        executor.query.mockResolvedValueOnce([])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'stale-source')
        expect(executor.query.mock.calls[2][0]).toContain('AND (FALSE)')
        expect(executor.query.mock.calls[2][1]).toEqual([reportCodename])
    })

    it('rejects a missing Reports source before component or record SQL', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'stale-source')
        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['wrong source kind', { kind: 'hub' }, [component]],
        ['missing physical table', { table_name: null }, [component]],
        ['missing Definition', {}, []],
        ['wrong component name', {}, [{ ...component, codename: 'PrivateDefinition' }]],
        ['non-JSON Definition', {}, [{ ...component, data_type: 'STRING' }]],
        ['missing physical column', {}, [{ ...component, column_name: null }]]
    ])('rejects %s before reading records', async (_label, overrides, components) => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor, overrides as Record<string, unknown>, components as Record<string, unknown>[])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'stale-source')
        expect(executor.query).toHaveBeenCalledTimes(2)
    })

    it('fails closed on duplicate codenames instead of choosing the first saved report', async () => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor)
        executor.query.mockResolvedValueOnce([{ definition }, { definition }])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'malformed-config')
        expect(executor.query.mock.calls[2][0]).toContain('LIMIT 2')
    })

    it.each([
        null,
        [],
        '{bad json',
        {},
        { ...definition, codename: 'AnotherReport' },
        { ...definition, columns: [] },
        { ...definition, datasource: { kind: 'raw.sql', sql: 'SELECT secret' } },
        { ...definition, privateStorageId: objectId }
    ])('rejects invalid, mismatched, or unexpected saved definition %j', async (stored) => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor)
        executor.query.mockResolvedValueOnce([{ definition: stored }])
        await expectSourceError(loadSavedRuntimeReportSource(executor, scope, reportCodename), 'malformed-config')
    })

    it('propagates executor failures rather than reporting an inaccessible definition as successful', async () => {
        const { executor } = createMockDbExecutor()
        queueMetadata(executor)
        const failure = new Error('database unavailable')
        executor.query.mockRejectedValueOnce(failure)
        await expect(loadSavedRuntimeReportSource(executor, scope, reportCodename)).rejects.toBe(failure)
    })
})
