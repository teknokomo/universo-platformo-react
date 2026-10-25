import { convertPgBindings } from '@universo-react/database'
import { copyWorkspace } from '../../services/runtimeWorkspaceService'
import { materializeWorkspaceCopySourceSnapshot } from '../../services/runtimeWorkspaceCopyService'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334441'

const vlc = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en' as const,
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
        }
    }
})

const getResetFieldBindings = (call: readonly [unknown, unknown[]?] | undefined) => {
    if (!call) return []
    const sql = String(call[0])
    const parameters = call[1] ?? []
    return Array.from(sql.matchAll(/jsonb_build_object\(\$(\d+)::text,/gu), (match) => {
        const fieldParameter = Number(match[1])
        return {
            columnName: sql.slice(match.index ?? 0).match(/\)\)\)\."([^"]+)"/u)?.[1],
            fieldParameterValue: parameters[fieldParameter - 1],
            defaultParameterValue: parameters[fieldParameter]
        }
    })
}

describe('runtimeWorkspaceCopyService', () => {
    it('captures all source business tables in one parameterized statement snapshot', async () => {
        const { txExecutor } = createMockDbExecutor()

        await materializeWorkspaceCopySourceSnapshot(txExecutor, schemaName, 'workspace-source', ['tbl_child', 'obj_parent', 'tbl_child'])

        expect(txExecutor.query).toHaveBeenCalledTimes(5)
        expect(txExecutor.query).toHaveBeenNthCalledWith(1, expect.stringContaining('CREATE TEMP TABLE workspace_copy_source_rows'))
        expect(txExecutor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('CREATE TEMP TABLE workspace_copy_source_settings'))
        expect(txExecutor.query).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('CREATE TEMP TABLE workspace_copy_template_material_owners')
        )
        expect(txExecutor.query).toHaveBeenNthCalledWith(
            4,
            expect.stringContaining('CREATE TEMP TABLE workspace_copy_excluded_template_ids')
        )
        const [snapshotSql, parameters] = txExecutor.query.mock.calls[4] as [string, unknown[]]
        expect(snapshotSql.match(/\bUNION ALL\b/gu)).toHaveLength(1)
        expect(snapshotSql).toContain(`FROM "${schemaName}"."obj_parent" source`)
        expect(snapshotSql).toContain(`FROM "${schemaName}"."tbl_child" source`)
        expect(snapshotSql).toContain('to_jsonb(source) AS row_data')
        expect(snapshotSql).toContain(`FROM "${schemaName}"."_app_workspace_settings" setting`)
        expect(snapshotSql).toContain('INSERT INTO workspace_copy_source_settings')
        expect(snapshotSql).not.toContain('LOCK TABLE')
        expect(parameters).toEqual(['workspace-source', 'obj_parent', 'tbl_child'])
    })

    it('captures workspace settings in the same statement when no business tables are copyable', async () => {
        const { txExecutor } = createMockDbExecutor()

        await materializeWorkspaceCopySourceSnapshot(txExecutor, schemaName, 'workspace-source', [])

        const [snapshotSql, parameters] = txExecutor.query.mock.calls[4] as [string, unknown[]]
        expect(snapshotSql).toContain('SELECT NULL::text AS source_table_name')
        expect(snapshotSql).toContain('INSERT INTO workspace_copy_source_rows')
        expect(snapshotSql).toContain('INSERT INTO workspace_copy_source_settings')
        expect(snapshotSql).toContain(`FROM "${schemaName}"."_app_workspace_settings" setting`)
        expect(parameters).toEqual(['workspace-source'])
    })

    it('captures included and excluded Material owners plus excluded template IDs in one source snapshot', async () => {
        const { txExecutor } = createMockDbExecutor()

        await materializeWorkspaceCopySourceSnapshot(
            txExecutor,
            schemaName,
            'workspace-source',
            ['obj_templates'],
            [{ tableName: 'obj_materials', ownerColumnName: 'template_owner_id', materialIncluded: false }],
            ['obj_excluded_templates']
        )

        const [snapshotSql, parameters] = txExecutor.query.mock.calls[4] as [string, unknown[]]
        expect(snapshotSql).toContain('owner_source_rows AS MATERIALIZED')
        expect(snapshotSql).toContain('excluded_template_rows AS MATERIALIZED')
        expect(snapshotSql).toContain('INSERT INTO workspace_copy_template_material_owners')
        expect(snapshotSql).toContain('INSERT INTO workspace_copy_excluded_template_ids')
        expect(snapshotSql).toContain(`FROM "${schemaName}"."obj_materials" source`)
        expect(snapshotSql).toContain('source."template_owner_id"::text AS template_owner_id')
        expect(snapshotSql).toContain(`FROM "${schemaName}"."obj_excluded_templates" source`)
        expect(parameters).toEqual(['workspace-source', 'obj_templates'])
    })

    it('copies workspace rows with a temporary id mapping and remaps uuid references after insert', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-copy', 'relation-copy', 'setting-copy']

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }

            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }

            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [{ tableName: 'obj_lessons', objectId: '018f8a78-7b8f-7c1d-a111-222233334470' }]
            }

            if (sql.includes("jsonb_typeof(component.ui_config->'resetOnCopy')")) return []

            if (sql.includes('component.column_name AS "columnName"') && sql.includes('LOWER(')) return []

            if (sql.includes('AS "parentTableName"')) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334471', parentTableName: 'obj_lessons' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334471' }]
            }

            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_lessons' }, { tableName: 'tbl_018f8a787b8f7c1da111222233334471' }]
            }

            if (sql.includes('information_schema.columns') && sql.includes("column_name NOT IN ('id', 'workspace_id')")) {
                if (params?.[1] === 'tbl_018f8a787b8f7c1da111222233334471') {
                    return [
                        { column_name: '_tp_parent_id' },
                        { column_name: 'cell_value' },
                        { column_name: '_seed_source_key' },
                        { column_name: '_seed_source_owned' },
                        { column_name: '_upl_created_at' },
                        { column_name: '_upl_created_by' },
                        { column_name: '_upl_updated_at' },
                        { column_name: '_upl_updated_by' },
                        { column_name: '_upl_version' },
                        { column_name: '_upl_deleted' },
                        { column_name: '_upl_deleted_at' },
                        { column_name: '_upl_deleted_by' },
                        { column_name: '_app_deleted' },
                        { column_name: '_app_deleted_at' },
                        { column_name: '_app_deleted_by' }
                    ]
                }
                return [
                    { column_name: 'title' },
                    { column_name: 'module_id' },
                    { column_name: '_seed_source_key' },
                    { column_name: '_seed_source_owned' },
                    { column_name: '_upl_created_at' },
                    { column_name: '_upl_updated_at' },
                    { column_name: '_upl_version' },
                    { column_name: '_upl_created_by' },
                    { column_name: '_upl_updated_by' },
                    { column_name: '_upl_deleted' },
                    { column_name: '_upl_deleted_at' },
                    { column_name: '_upl_deleted_by' },
                    { column_name: '_app_deleted' },
                    { column_name: '_app_deleted_at' },
                    { column_name: '_app_deleted_by' },
                    { column_name: '_upl_locked' }
                ]
            }

            if (sql.includes('information_schema.columns') && sql.includes("udt_name = 'uuid'")) {
                return params?.[1] === 'tbl_018f8a787b8f7c1da111222233334471'
                    ? [{ column_name: '_tp_parent_id' }]
                    : [{ column_name: 'module_id' }]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                const settings = JSON.parse(String(params?.[0] ?? '[]')) as unknown[]
                return settings.map((_, index) => ({ id: `setting-copy-${index}` }))
            }

            if (sql.includes('FROM workspace_copy_source_settings')) {
                return [
                    {
                        key: 'sectionLinksEnabled',
                        targetKind: 'global',
                        targetOwnerId: 'workspace-source',
                        targetKey: '',
                        value: false
                    }
                ]
            }

            return []
        })

        const result = await copyWorkspace(executor, {
            schemaName,
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
            sourceWorkspaceId: 'workspace-source',
            name: vlc('Workspace copy'),
            description: vlc('Workspace copy description'),
            userId: 'user-1',
            applicationSettings: {
                sectionLinksEnabled: true,
                workspaceOverrides: {
                    allowedAddresses: [{ key: 'sectionLinksEnabled', target: { kind: 'global' } }],
                    lockedAddresses: []
                }
            },
            actorUserId: 'user-1'
        })

        expect(result).toEqual({ id: 'workspace-copy' })
        const workspaceContextIds = txExecutor.query.mock.calls
            .filter(([sql]) => String(sql).includes("set_config('app.current_workspace_id'"))
            .map(([, params]) => params?.[0])
        expect(workspaceContextIds).toEqual(['workspace-source', 'workspace-copy'])
        const sourceWorkspaceLockIndex = txExecutor.query.mock.calls.findIndex(([sql]) => {
            const query = String(sql)
            return query.includes(`FROM "${schemaName}"."_app_workspaces"`) && query.includes('FOR SHARE')
        })
        const sourceTableDiscoveryIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('FROM information_schema.tables')
        )
        const sourceSnapshotIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('INSERT INTO workspace_copy_source_rows')
        )
        const firstSourceRowScanIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('INSERT INTO workspace_copy_id_map')
        )
        expect(sourceWorkspaceLockIndex).toBeGreaterThanOrEqual(0)
        const schemaLockIndex = txExecutor.query.mock.calls.findIndex(
            ([sql, params]) => String(sql).includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') && params?.[0] === schemaName
        )
        const baselineLockIndex = txExecutor.query.mock.calls.findIndex(
            ([sql, params]) =>
                String(sql).includes('pg_advisory_xact_lock_shared(hashtextextended($1::text, 0))') &&
                params?.[0] === `workspace-baseline:${schemaName}:018f8a78-7b8f-7c1d-a111-222233334444`
        )
        expect(schemaLockIndex).toBeGreaterThanOrEqual(0)
        expect(baselineLockIndex).toBeGreaterThanOrEqual(0)
        const personalWorkspaceLockIndex = txExecutor.query.mock.calls.findIndex(
            ([sql, params]) =>
                String(sql).includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))') &&
                params?.[0] === `personal-workspace:${schemaName}:user-1`
        )
        expect(schemaLockIndex).toBeGreaterThanOrEqual(0)
        expect(baselineLockIndex).toBeGreaterThan(schemaLockIndex)
        expect(personalWorkspaceLockIndex).toBeGreaterThan(baselineLockIndex)
        expect(personalWorkspaceLockIndex).toBeLessThan(sourceWorkspaceLockIndex)
        expect(sourceWorkspaceLockIndex).toBeLessThan(sourceTableDiscoveryIndex)
        expect(sourceSnapshotIndex).toBeGreaterThan(sourceTableDiscoveryIndex)
        expect(sourceSnapshotIndex).toBeLessThan(firstSourceRowScanIndex)
        expect(txExecutor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO workspace_copy_source_rows'))).toHaveLength(
            1
        )
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TEMP TABLE workspace_copy_id_map'))
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('INNER JOIN workspace_copy_id_map'), [
            'workspace-source',
            'workspace-copy',
            'obj_lessons',
            'user-1'
        ])
        const insertCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_lessons"`))
        expect(insertCall?.[0]).toEqual(expect.not.stringContaining('source."_upl_created_at"'))
        expect(insertCall?.[0]).toEqual(expect.not.stringContaining('source."_upl_created_by"'))
        expect(insertCall?.[0]).toEqual(expect.not.stringContaining('source."_upl_version"'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('source."_seed_source_key"'))
        expect(insertCall?.[0]).toEqual(expect.not.stringContaining('source."_seed_source_owned"'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('"_seed_source_key"'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('"_seed_source_owned"'))
        expect(insertCall?.[0]).toMatch(/source\."module_id",\s*source\."_seed_source_key",\s*false,\s*NOW\(\)/)
        expect(insertCall?.[0]).toEqual(expect.stringContaining('NOW()'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('$4::uuid'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('jsonb_populate_record(NULL::'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('FROM workspace_copy_source_rows source_snapshot'))
        expect(insertCall?.[0]).toEqual(expect.stringContaining('false'))
        const childInsertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."tbl_018f8a787b8f7c1da111222233334471"`)
        )
        expect(childInsertCall).toBeDefined()
        expect(childInsertCall?.[0]).toContain('INNER JOIN workspace_copy_id_map')
        expect(childInsertCall?.[0]).toContain('id_map.source_table_name = $5')
        expect(childInsertCall?.[0]).toContain('source."_tp_parent_id"')
        expect(childInsertCall?.[1]).toEqual([
            'workspace-source',
            'workspace-copy',
            'tbl_018f8a787b8f7c1da111222233334471',
            'user-1',
            'obj_lessons'
        ])
        expect(childInsertCall?.[0]).toContain('source."_seed_source_key"')
        expect(childInsertCall?.[0]).not.toContain('source."_seed_source_owned"')
        expect(childInsertCall?.[0]).toContain('"_seed_source_key"')
        expect(childInsertCall?.[0]).toContain('"_seed_source_owned"')
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('target."module_id" = id_map.old_id'), ['workspace-copy'])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('target_kind AS "targetKind"'), ['workspace-source'])
        const workspaceSettingInsertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)
        )
        expect(String(workspaceSettingInsertCall?.[0])).toContain('jsonb_to_recordset($1::jsonb)')
        expect(JSON.parse(String(workspaceSettingInsertCall?.[1]?.[0]))).toEqual([
            {
                target_kind: 'global',
                target_owner_id: 'workspace-copy',
                target_key: '',
                key: 'sectionLinksEnabled',
                value: false
            }
        ])
        expect(workspaceSettingInsertCall?.[1]?.slice(1)).toEqual(['workspace-copy', 'user-1'])
    })

    it('excludes marked guest rows and children while copying authored quiz content and applying reset defaults', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const quizTableComponentId = '018f8a78-7b8f-7c1d-a111-222233334470'
        const studentTableComponentId = '018f8a78-7b8f-7c1d-a111-222233334471'
        const attemptTableComponentId = '018f8a78-7b8f-7c1d-a111-222233334472'
        const responseTableComponentId = '018f8a78-7b8f-7c1d-a111-222233334473'
        const quizChildTable = 'tbl_018f8a787b8f7c1da111222233334470'
        const studentChildTable = 'tbl_018f8a787b8f7c1da111222233334471'
        const attemptChildTable = 'tbl_018f8a787b8f7c1da111222233334472'
        const responseChildTable = 'tbl_018f8a787b8f7c1da111222233334473'
        const configuredQuizId = '018f8a78-7b8f-7c1d-a111-222233334440'
        const parentObjects = [
            { tableName: 'obj_quizzes', objectId: '018f8a78-7b8f-7c1d-a111-222233334440' },
            { tableName: 'obj_access_links', objectId: '018f8a78-7b8f-7c1d-a111-222233334441' },
            { tableName: 'obj_students', objectId: '018f8a78-7b8f-7c1d-a111-222233334442' },
            { tableName: 'obj_quiz_attempts', objectId: '018f8a78-7b8f-7c1d-a111-222233334443' },
            { tableName: 'obj_quiz_responses', objectId: '018f8a78-7b8f-7c1d-a111-222233334444' }
        ]
        const excludedPolicy = JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })
        const excludedObjects = parentObjects.slice(2).map((object) => ({
            ...object,
            recordPolicyPresent: true,
            recordPolicyJson: excludedPolicy
        }))
        const tableNames = [
            ...parentObjects.map((object) => ({ tableName: object.tableName })),
            ...[quizChildTable, studentChildTable, attemptChildTable, responseChildTable].map((tableName) => ({ tableName }))
        ]
        const generatedIds = ['workspace-copy', 'membership-copy']
        const columnsByTable: Record<string, string[]> = {
            obj_quizzes: ['title'],
            obj_access_links: ['slug', 'target_id', 'pinned_quiz_id', 'shared_target_id', 'large_counter', 'use_count', 'empty_on_copy'],
            [quizChildTable]: ['label', 'sort_order', '_tp_parent_id', 'quiz_reference_id']
        }

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) return [{ id: 'owner-role' }]
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) return parentObjects
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [quizTableComponentId, studentTableComponentId, attemptTableComponentId, responseTableComponentId].map(
                    (componentId) => ({ componentId })
                )
            }
            if (sql.includes('FROM information_schema.tables')) return tableNames
            if (sql.includes('component.id AS "componentId"') && sql.includes('"parentTableName"')) {
                return [{ componentId: quizTableComponentId, parentTableName: 'obj_quizzes' }]
            }
            if (sql.includes("jsonb_exists(object_row.config, 'recordPolicy')")) {
                return parentObjects.map((object) => {
                    const excluded = excludedObjects.some(({ objectId }) => objectId === object.objectId)
                    return {
                        ...object,
                        recordPolicyPresent: excluded,
                        recordPolicyJson: excluded ? excludedPolicy : null
                    }
                })
            }
            if (sql.includes('component.object_id = ANY($1::uuid[])')) {
                return [studentTableComponentId, attemptTableComponentId, responseTableComponentId].map((componentId) => ({ componentId }))
            }
            if (sql.includes("jsonb_typeof(component.ui_config->'resetOnCopy')")) return []
            if (sql.includes("component.ui_config->'resetOnCopy'") && sql.includes('object_row.table_name')) {
                return [
                    { tableName: 'obj_access_links', parentComponentId: null, columnName: 'use_count', defaultValue: '0' },
                    {
                        tableName: 'obj_access_links',
                        parentComponentId: null,
                        columnName: 'pinned_quiz_id',
                        defaultValue: JSON.stringify(configuredQuizId)
                    },
                    {
                        tableName: 'obj_access_links',
                        parentComponentId: null,
                        columnName: 'large_counter',
                        defaultValue: '9007199254740993'
                    },
                    { tableName: 'obj_access_links', parentComponentId: null, columnName: 'empty_on_copy' },
                    { tableName: 'obj_quizzes', parentComponentId: quizTableComponentId, columnName: 'sort_order', defaultValue: '0' },
                    {
                        tableName: 'obj_quizzes',
                        parentComponentId: quizTableComponentId,
                        columnName: 'quiz_reference_id',
                        defaultValue: JSON.stringify(configuredQuizId)
                    }
                ]
            }
            if (sql.includes('source_object.table_name')) {
                return [
                    {
                        sourceTableName: 'obj_access_links',
                        parentComponentId: null,
                        columnName: 'target_id',
                        targetTableName: 'obj_quizzes',
                        isRequired: true
                    },
                    {
                        sourceTableName: 'obj_access_links',
                        parentComponentId: null,
                        columnName: 'pinned_quiz_id',
                        targetTableName: 'obj_quizzes',
                        isRequired: true,
                        isResetOnCopy: true,
                        defaultValueJson: JSON.stringify(configuredQuizId)
                    },
                    {
                        sourceTableName: 'obj_access_links',
                        parentComponentId: null,
                        columnName: 'shared_target_id',
                        targetTableName: 'cfg_global_targets',
                        isRequired: true
                    },
                    {
                        sourceTableName: 'obj_quizzes',
                        parentComponentId: quizTableComponentId,
                        columnName: 'quiz_reference_id',
                        targetTableName: 'obj_quizzes',
                        isRequired: true,
                        isResetOnCopy: true,
                        defaultValueJson: JSON.stringify(configuredQuizId)
                    }
                ]
            }
            if (sql.includes('udt_name AS "udtName"')) {
                return [
                    { tableName: 'obj_quizzes', columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_access_links', columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_access_links', columnName: 'target_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_access_links', columnName: 'pinned_quiz_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_access_links', columnName: 'shared_target_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'cfg_global_targets', columnName: 'id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: quizChildTable, columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: quizChildTable, columnName: '_tp_parent_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: quizChildTable, columnName: 'quiz_reference_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_students', columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: studentChildTable, columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' }
                ]
            }
            if (sql.includes('COUNT(*)::text AS "unresolvedCount"')) return [{ unresolvedCount: '0' }]
            if (sql.includes("column_name NOT IN ('id', 'workspace_id')")) {
                return (columnsByTable[String(params[1])] ?? []).map((column_name) => ({ column_name }))
            }
            if (sql.includes("udt_name = 'uuid'")) {
                if (params[1] === 'obj_access_links')
                    return [{ column_name: 'target_id' }, { column_name: 'pinned_quiz_id' }, { column_name: 'shared_target_id' }]
                if (params[1] === quizChildTable) return [{ column_name: '_tp_parent_id' }, { column_name: 'quiz_reference_id' }]
            }
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                actorUserId: 'user-1'
            })
        ).resolves.toEqual({ id: 'workspace-copy' })

        const policyLookupCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes("jsonb_exists(object_row.config, 'recordPolicy')")
        )
        expect(policyLookupCall).toBeDefined()
        expect(() => convertPgBindings(String(policyLookupCall?.[0]), policyLookupCall?.[1])).not.toThrow()

        const sourceSnapshotCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes('INSERT INTO workspace_copy_source_rows')
        )
        const sourceSnapshotTables = (sourceSnapshotCall?.[1] ?? []).slice(1)
        expect(String(sourceSnapshotCall?.[0])).toContain('UNION ALL')
        expect(sourceSnapshotTables).toEqual(expect.arrayContaining(['obj_quizzes', 'obj_access_links', quizChildTable]))
        expect(sourceSnapshotTables).not.toEqual(expect.arrayContaining(['obj_students', 'obj_quiz_attempts', 'obj_quiz_responses']))
        expect(sourceSnapshotTables).not.toEqual(expect.arrayContaining([studentChildTable, attemptChildTable, responseChildTable]))

        const idMapCalls = txExecutor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO workspace_copy_id_map'))
        expect(idMapCalls).toHaveLength(1)
        expect(String(idMapCalls[0]?.[0])).toContain('(source_table_name, old_id, new_id)')
        expect(String(idMapCalls[0]?.[0])).toContain('FROM workspace_copy_source_rows')

        const copyInsertCalls = txExecutor.query.mock.calls.filter(([sql]) => {
            const text = String(sql)
            return new RegExp(`INSERT INTO "${schemaName}"\\."(?:obj_|tbl_)`).test(text)
        })
        const copyInsertIndexes = txExecutor.query.mock.calls.flatMap(([sql], index) =>
            new RegExp(`INSERT INTO "${schemaName}"\\."(?:obj_|tbl_)`).test(String(sql)) ? [index] : []
        )
        const insertedTableNames = copyInsertCalls.map(([sql]) => String(sql).match(/INSERT INTO "[^"]+"\."([^"]+)"/)?.[1])
        expect(insertedTableNames).toEqual(expect.arrayContaining(['obj_quizzes', 'obj_access_links', quizChildTable]))
        expect(insertedTableNames).toHaveLength(3)
        expect(insertedTableNames).not.toEqual(expect.arrayContaining(['obj_students', 'obj_quiz_attempts', 'obj_quiz_responses']))
        expect(insertedTableNames).not.toEqual(expect.arrayContaining([studentChildTable, attemptChildTable, responseChildTable]))

        const accessLinkInsert = copyInsertCalls.find(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_access_links"`))
        expect(accessLinkInsert?.[0]).toContain('source."slug"')
        expect(accessLinkInsert?.[0]).toContain('source."target_id"')
        expect(accessLinkInsert?.[0]).toContain('source."shared_target_id"')
        expect(accessLinkInsert?.[0]).not.toContain('source."use_count"')
        expect(accessLinkInsert?.[0]).not.toContain('source."pinned_quiz_id"')
        expect(accessLinkInsert?.[0]).toContain('CASE')
        expect(accessLinkInsert?.[0]).toContain('THEN $')
        expect(accessLinkInsert?.[0]).toContain("ELSE 'null'::jsonb")
        expect(accessLinkInsert?.[0]).toContain('LOWER(id_map.old_id::text) = LOWER($')
        expect(accessLinkInsert?.[0]).toContain('id_map.source_table_name = $')
        expect(accessLinkInsert?.[0]).not.toContain('to_jsonb(id_map.new_id::text)')
        expect(accessLinkInsert?.[0]).not.toContain('source."large_counter"')
        expect(accessLinkInsert?.[0]).toContain(`jsonb_populate_record(NULL::"${schemaName}"."obj_access_links"`)
        const resetFieldMappings = getResetFieldBindings(accessLinkInsert)
        expect(resetFieldMappings.map(({ columnName }) => columnName)).toEqual([
            'pinned_quiz_id',
            'large_counter',
            'use_count',
            'empty_on_copy'
        ])
        const resetValuesByColumn = new Map([
            ['pinned_quiz_id', JSON.stringify(configuredQuizId)],
            ['large_counter', '9007199254740993'],
            ['use_count', '0'],
            ['empty_on_copy', 'null']
        ])
        for (const { fieldParameterValue, defaultParameterValue, columnName } of resetFieldMappings) {
            expect(fieldParameterValue).toBe(columnName)
            expect(defaultParameterValue).toBe(resetValuesByColumn.get(columnName ?? ''))
        }

        const childInsert = copyInsertCalls.find(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."${quizChildTable}"`))
        expect(childInsert?.[0]).toContain('source."label"')
        expect(childInsert?.[0]).not.toContain('source."sort_order"')
        expect(childInsert?.[0]).toContain(`jsonb_populate_record(NULL::"${schemaName}"."${quizChildTable}"`)
        expect(childInsert?.[0]).toContain('CASE')
        expect(childInsert?.[0]).toContain("ELSE 'null'::jsonb")
        expect(childInsert?.[0]).not.toContain('to_jsonb(id_map.new_id::text)')
        const childResetFieldMappings = getResetFieldBindings(childInsert)
        expect(childResetFieldMappings.map(({ columnName }) => columnName)).toEqual(['sort_order', 'quiz_reference_id'])
        const childResetValuesByColumn = new Map([
            ['sort_order', '0'],
            ['quiz_reference_id', JSON.stringify(configuredQuizId)]
        ])
        for (const { fieldParameterValue, defaultParameterValue, columnName } of childResetFieldMappings) {
            expect(fieldParameterValue).toBe(columnName)
            expect(defaultParameterValue).toBe(childResetValuesByColumn.get(columnName ?? ''))
        }

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('target."target_id" = id_map.old_id'), [
            'workspace-copy',
            'obj_quizzes'
        ])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('target."pinned_quiz_id" = id_map.old_id'), [
            'workspace-copy',
            'obj_quizzes'
        ])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('target."quiz_reference_id" = id_map.old_id'), [
            'workspace-copy',
            'obj_quizzes'
        ])
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('id_map.new_id = source."pinned_quiz_id"'))).toBe(true)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('id_map.new_id = source."quiz_reference_id"'))).toBe(true)
        const lastCopyInsertIndex = Math.max(...copyInsertIndexes)
        const pinnedQuizRemapIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('target."pinned_quiz_id" = id_map.old_id')
        )
        const childQuizRemapIndex = txExecutor.query.mock.calls.findIndex(([sql]) =>
            String(sql).includes('target."quiz_reference_id" = id_map.old_id')
        )
        expect(pinnedQuizRemapIndex).toBeGreaterThan(lastCopyInsertIndex)
        expect(childQuizRemapIndex).toBeGreaterThan(lastCopyInsertIndex)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('target."shared_target_id"'))).toBe(false)
        const sourceDataMutations = txExecutor.query.mock.calls.filter(([sql, queryParams]) => {
            const statement = String(sql)
            return /^\s*(UPDATE|DELETE FROM) "[^"]+"\."(obj_|tbl_)/i.test(statement) && queryParams?.includes('workspace-source')
        })
        expect(sourceDataMutations).toEqual([])

        const referenceMetadataCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('source_object.table_name'))
        expect(referenceMetadataCall?.[1]).toEqual([expect.arrayContaining(['obj_quizzes', 'obj_access_links', quizChildTable])])
        expect(String(referenceMetadataCall?.[0])).toContain('"isResetOnCopy"')
        expect(String(referenceMetadataCall?.[0])).toContain('"defaultValueJson"')
        expect(String(referenceMetadataCall?.[0])).not.toContain('IS DISTINCT FROM')
        expect(referenceMetadataCall?.[1]?.[0]).not.toEqual(
            expect.arrayContaining([
                'obj_students',
                'obj_quiz_attempts',
                'obj_quiz_responses',
                studentChildTable,
                attemptChildTable,
                responseChildTable
            ])
        )
    })

    it('fails closed before creating a workspace when excluded Materials are attached to copied TableTemplates', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const tableComponentId = '018f8a78-7b8f-7c1d-a111-222233334470'
        const templateChildTable = `tbl_${tableComponentId.replaceAll('-', '')}`
        const discoveredTables = ['obj_materials', 'obj_table_templates', templateChildTable]
        const excludedMaterialPolicy = JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('FOR SHARE')) return [{ id: 'workspace-source' }]
            if (sql.includes("c.column_name = 'workspace_id'")) {
                return [
                    { tableName: 'obj_materials', objectId: 'material-object' },
                    { tableName: 'obj_table_templates', objectId: 'template-object' }
                ]
            }
            if (sql.includes('SELECT DISTINCT c.id AS "componentId"')) return [{ componentId: tableComponentId }]
            if (sql.includes('FROM information_schema.tables')) return discoveredTables.map((tableName) => ({ tableName }))
            if (sql.includes("jsonb_exists(object_row.config, 'recordPolicy')")) {
                return [
                    {
                        objectId: 'material-object',
                        codename: 'material',
                        tableName: 'obj_materials',
                        recordPolicyPresent: true,
                        recordPolicyJson: excludedMaterialPolicy
                    },
                    {
                        objectId: 'template-object',
                        codename: 'tabletemplate',
                        tableName: 'obj_table_templates',
                        recordPolicyPresent: false,
                        recordPolicyJson: null
                    }
                ]
            }
            if (sql.includes('component.object_id = ANY($1::uuid[])')) return []
            if (sql.includes('AS "parentTableName"')) {
                return [{ componentId: tableComponentId, parentTableName: 'obj_table_templates' }]
            }
            if (sql.includes('component.column_name AS "ownerColumnName"')) return []
            if (sql.includes('ANY($2::text[])') && sql.includes('object_row.codename')) {
                return [
                    {
                        objectId: 'template-object',
                        codename: 'tabletemplate',
                        tableName: 'obj_table_templates',
                        recordPolicyPresent: false,
                        recordPolicyJson: null
                    },
                    {
                        objectId: 'material-object',
                        codename: 'material',
                        tableName: 'obj_materials',
                        recordPolicyPresent: true,
                        recordPolicyJson: excludedMaterialPolicy
                    }
                ]
            }
            if (sql.includes('materialRefColumnName')) {
                return [
                    {
                        templateTableName: 'obj_table_templates',
                        tableComponentId,
                        materialRefColumnName: 'material_ref',
                        materialTargetObjectId: 'material-object'
                    }
                ]
            }
            if (sql.includes('workspace_copy_source_rows template_row')) return [{ hasMaterialReference: true }]
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
            message: 'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
        })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('CREATE TEMP TABLE workspace_copy_id_map'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(
            false
        )
    })

    it('fails closed on an invalid persisted workspace-copy policy before building the id map', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [{ tableName: 'obj_students', objectId: 'student-object' }]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) return []
            if (sql.includes('FROM information_schema.tables')) return [{ tableName: 'obj_students' }]
            if (sql.includes("jsonb_exists(object_row.config, 'recordPolicy')")) {
                return [
                    {
                        objectId: 'student-object',
                        tableName: 'obj_students',
                        recordPolicyPresent: true,
                        recordPolicyJson: JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'excldue' })
                    }
                ]
            }
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1'
            })
        ).rejects.toThrow('Invalid EntityRecordPolicy metadata; workspace copy aborted')

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('CREATE TEMP TABLE workspace_copy_id_map'))).toBe(false)
    })

    it('nulls an optional REF when its target table is missing physically', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: 'workspace-copy' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [{ tableName: 'obj_source', objectId: 'source-object' }]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return []
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_source' }]
            }
            if (sql.includes('source_object.table_name')) {
                return [
                    {
                        sourceTableName: 'obj_source',
                        parentComponentId: null,
                        columnName: 'related_id',
                        targetTableName: 'obj_missing',
                        isRequired: false
                    }
                ]
            }
            if (sql.includes('udt_name AS')) {
                return [
                    { tableName: 'obj_source', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'obj_source', columnName: 'related_id', udtName: 'uuid' }
                ]
            }
            if (sql.includes('column_name NOT IN')) {
                return [{ column_name: 'related_id' }]
            }
            if (sql.includes("udt_name = 'uuid'")) {
                return [{ column_name: 'related_id' }]
            }
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                actorUserId: 'user-1'
            })
        ).resolves.toEqual({ id: 'workspace-copy' })

        const clearReferenceCall = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes(`UPDATE "${schemaName}"."obj_source" target`) && String(sql).includes('SET "related_id" = NULL')
        )
        expect(clearReferenceCall).toBeDefined()
    })

    it('validates tabular parent links and clears omitted ledger reversals without REF metadata', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-copy', 'relation-copy']

        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [{ tableName: 'obj_parent', objectId: 'parent-object' }]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334471' }]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_parent' }, { tableName: 'tbl_018f8a787b8f7c1da111222233334471' }]
            }
            if (sql.includes('component.id AS "componentId"') && sql.includes('"parentTableName"')) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334471', parentTableName: 'obj_parent' }]
            }
            if (sql.includes('source_object.table_name')) {
                return []
            }
            if (sql.includes('udt_name AS')) {
                return [
                    { tableName: 'obj_parent', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'obj_parent', columnName: '_app_reversal_of_fact_id', udtName: 'uuid' },
                    { tableName: 'tbl_018f8a787b8f7c1da111222233334471', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'tbl_018f8a787b8f7c1da111222233334471', columnName: '_tp_parent_id', udtName: 'uuid' }
                ]
            }
            if (sql.includes('COUNT(*)::text AS "unresolvedCount"')) {
                return [{ unresolvedCount: '0' }]
            }
            if (sql.includes('column_name NOT IN')) {
                return params[1] === 'obj_parent' ? [{ column_name: '_app_reversal_of_fact_id' }] : [{ column_name: '_tp_parent_id' }]
            }
            if (sql.includes("udt_name = 'uuid'")) {
                return params[1] === 'obj_parent' ? [{ column_name: '_app_reversal_of_fact_id' }] : [{ column_name: '_tp_parent_id' }]
            }
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                actorUserId: 'user-1'
            })
        ).resolves.toEqual({ id: 'workspace-copy' })

        const parentValidationCall = txExecutor.query.mock.calls.find(
            ([sql]) =>
                String(sql).includes('COUNT(*)::text AS "unresolvedCount"') && String(sql).includes('tbl_018f8a787b8f7c1da111222233334471')
        )
        expect(parentValidationCall).toBeDefined()

        const clearReversalCall = txExecutor.query.mock.calls.find(
            ([sql]) =>
                String(sql).includes(`UPDATE "${schemaName}"."obj_parent" target`) &&
                String(sql).includes('SET "_app_reversal_of_fact_id" = NULL')
        )
        expect(clearReversalCall).toBeDefined()

        const childInsertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."tbl_018f8a787b8f7c1da111222233334471"`)
        )
        expect(String(childInsertCall?.[0])).not.toContain('SELECT ref_map.new_id')
    })

    it('copies widget overrides only for current application layout scopes and drops stale owners', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-copy', 'relation-copy']
        const sourceLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344bc'
        const staleSourceLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344be'
        const scopedSourceLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344bf'
        const scopedEntityId = '018f8a78-7b8f-7c1d-a111-2222333344c1'
        const widgetSettingKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        const widgetTarget = { kind: 'widget', instanceKey: 'matrix-main' }

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }

            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }

            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                return [{ id: generatedIds.shift() }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_layouts" layout_row`)) {
                return [
                    { layoutId: sourceLayoutId, scopeEntityId: null, instanceKey: 'matrix-main' },
                    { layoutId: scopedSourceLayoutId, scopeEntityId: scopedEntityId, instanceKey: 'matrix-main' }
                ]
            }

            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return []
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                const settings = JSON.parse(String(params?.[0] ?? '[]')) as unknown[]
                return settings.map((_, index) => ({ id: `setting-copy-${index}` }))
            }

            if (sql.includes('FROM workspace_copy_source_settings')) {
                return [
                    {
                        key: 'sectionLinksEnabled',
                        targetKind: 'global',
                        targetOwnerId: 'workspace-source',
                        targetKey: '',
                        value: false
                    },
                    {
                        key: 'dashboardDefaultMode',
                        targetKind: 'global',
                        targetOwnerId: 'workspace-source',
                        targetKey: '',
                        value: 'first-menu-item'
                    },
                    {
                        key: 'unknownSetting',
                        targetKind: 'global',
                        targetOwnerId: 'workspace-source',
                        targetKey: '',
                        value: true
                    },
                    {
                        key: widgetSettingKey,
                        targetKind: 'widget',
                        targetOwnerId: sourceLayoutId,
                        targetKey: 'matrix-main',
                        value: true
                    },
                    {
                        key: widgetSettingKey,
                        targetKind: 'widget',
                        targetOwnerId: scopedSourceLayoutId,
                        targetKey: 'matrix-main',
                        value: false
                    },
                    {
                        key: widgetSettingKey,
                        targetKind: 'widget',
                        targetOwnerId: staleSourceLayoutId,
                        targetKey: 'matrix-main',
                        value: false
                    }
                ]
            }

            return []
        })

        await copyWorkspace(executor, {
            schemaName,
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
            sourceWorkspaceId: 'workspace-source',
            name: vlc('Workspace copy'),
            description: vlc('Workspace copy description'),
            userId: 'user-1',
            applicationSettings: {
                sectionLinksEnabled: true,
                dashboardDefaultMode: 'layout-default',
                workspaceOverrides: {
                    allowedAddresses: [
                        { key: 'sectionLinksEnabled', target: { kind: 'global' } },
                        { key: widgetSettingKey, target: widgetTarget }
                    ],
                    lockedAddresses: [{ key: 'dashboardDefaultMode', target: { kind: 'global' } }]
                }
            },
            actorUserId: 'user-1'
        })

        const workspaceSettingInsertCalls = txExecutor.query.mock.calls.filter(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)
        )
        expect(workspaceSettingInsertCalls).toHaveLength(1)
        expect(
            txExecutor.query.mock.calls.filter(([sql]) => String(sql).includes(`FROM "${schemaName}"."_app_layouts" layout_row`))
        ).toHaveLength(1)
        expect(String(workspaceSettingInsertCalls[0]?.[0])).toContain('jsonb_to_recordset($1::jsonb)')
        expect(JSON.parse(String(workspaceSettingInsertCalls[0]?.[1]?.[0]))).toEqual([
            {
                target_kind: 'global',
                target_owner_id: 'workspace-copy',
                target_key: '',
                key: 'sectionLinksEnabled',
                value: false
            },
            {
                target_kind: 'widget',
                target_owner_id: sourceLayoutId,
                target_key: 'matrix-main',
                key: widgetSettingKey,
                value: true
            },
            {
                target_kind: 'widget',
                target_owner_id: scopedSourceLayoutId,
                target_key: 'matrix-main',
                key: widgetSettingKey,
                value: false
            }
        ])
        expect(workspaceSettingInsertCalls[0]?.[1]?.slice(1)).toEqual(['workspace-copy', 'user-1'])
    })

    it('fails closed before copying when the source workspace is no longer active', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValue([])

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                actorUserId: 'user-1'
            })
        ).rejects.toThrow('Workspace not found')

        expect(txExecutor.query).toHaveBeenCalledTimes(4)
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual([schemaName])
        expect(txExecutor.query.mock.calls[0]?.[0]).toEqual(expect.stringContaining('pg_advisory_xact_lock('))
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual([`workspace-baseline:${schemaName}:018f8a78-7b8f-7c1d-a111-222233334444`])
        expect(txExecutor.query.mock.calls[1]?.[0]).toEqual(expect.stringContaining('pg_advisory_xact_lock_shared'))
        expect(txExecutor.query.mock.calls[2]?.[1]).toEqual([`personal-workspace:${schemaName}:user-1`])
        expect(txExecutor.query.mock.calls[2]?.[0]).toEqual(expect.stringContaining('pg_advisory_xact_lock('))
        expect(txExecutor.query.mock.calls[3]?.[0]).toEqual(expect.stringContaining('FOR SHARE'))
    })
})
