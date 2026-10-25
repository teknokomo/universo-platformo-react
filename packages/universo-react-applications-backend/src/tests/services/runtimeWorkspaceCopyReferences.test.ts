import { copyWorkspace } from '../../services/runtimeWorkspaceService'
import { copyWorkspaceOperation } from '../../services/runtimeWorkspaceCopyService'
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

describe('runtimeWorkspaceCopyReferences', () => {
    it('fails closed before inserting when a required workspace-local reference is not copied', async () => {
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
                return [
                    { id: sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`) ? 'relation-copy' : 'workspace-copy' }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: 'role-owner' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [
                    { tableName: 'obj_source', objectId: 'source-object' },
                    { tableName: 'obj_target', objectId: 'target-object' }
                ]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return []
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_source' }, { tableName: 'obj_target' }]
            }
            if (sql.includes('source_object.table_name')) {
                return [
                    {
                        sourceTableName: 'obj_source',
                        parentComponentId: null,
                        columnName: 'related_id',
                        targetTableName: 'obj_target',
                        isRequired: true
                    }
                ]
            }
            if (sql.includes('udt_name AS')) {
                return [
                    { tableName: 'obj_source', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'obj_source', columnName: 'related_id', udtName: 'uuid' },
                    { tableName: 'obj_target', columnName: 'workspace_id', udtName: 'uuid' }
                ]
            }
            if (sql.includes('COUNT(*)::text AS "unresolvedCount"')) {
                return [{ unresolvedCount: '1' }]
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
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains a required reference to a row that was not copied'
        })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_source"`))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_target"`))).toBe(false)
        const validationCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('COUNT(*)::text AS "unresolvedCount"'))
        expect(String(validationCall?.[0])).toContain('source."related_id" IS NULL')
        expect(String(validationCall?.[0])).toContain('FROM workspace_copy_source_rows source_snapshot')
        expect(String(validationCall?.[0])).toContain('source_snapshot.source_table_name = $2')
        expect(validationCall?.[1]).toEqual(['workspace-source', 'obj_source', 'obj_target'])
    })

    it('fails closed when a required REF target table is missing physically', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
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
                        isRequired: true
                    }
                ]
            }
            if (sql.includes('udt_name AS')) {
                return [
                    { tableName: 'obj_source', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'obj_source', columnName: 'related_id', udtName: 'uuid' }
                ]
            }
            if (sql.includes('COUNT(*)::text AS "unresolvedCount"')) {
                return [{ unresolvedCount: '1' }]
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
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains a required reference to a row that was not copied'
        })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_source"`))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(
            false
        )
    })

    it('fails before workspace creation when a required resetOnCopy TABLE REF default is not in the copy map', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const childComponentId = '018f8a78-7b8f-7c1d-a111-222233334470'
        const childTableName = 'tbl_018f8a787b8f7c1da111222233334470'
        const unresolvedDefaultId = '018f8a78-7b8f-7c1d-a111-222233334499'
        const createWorkspace = jest.fn(async () => ({ id: 'workspace-copy' }))

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
                return [
                    { tableName: 'obj_source', objectId: 'source-object' },
                    { tableName: 'obj_target', objectId: 'target-object' }
                ]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: childComponentId }]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_source' }, { tableName: 'obj_target' }, { tableName: childTableName }]
            }
            if (sql.includes("jsonb_exists(object_row.config, 'recordPolicy')")) return []
            if (sql.includes("jsonb_typeof(component.ui_config->'resetOnCopy')")) return []
            if (sql.includes("component.ui_config->'resetOnCopy' = 'true'::jsonb") && sql.includes('object_row.table_name')) {
                return [
                    {
                        tableName: 'obj_source',
                        parentComponentId: childComponentId,
                        columnName: 'related_id',
                        defaultValue: JSON.stringify(unresolvedDefaultId)
                    }
                ]
            }
            if (sql.includes('source_object.table_name')) {
                return [
                    {
                        sourceTableName: 'obj_source',
                        parentComponentId: childComponentId,
                        columnName: 'related_id',
                        targetTableName: 'obj_target',
                        isRequired: true,
                        isResetOnCopy: true,
                        defaultValueJson: JSON.stringify(unresolvedDefaultId)
                    }
                ]
            }
            if (sql.includes('udt_name AS "udtName"')) {
                return [
                    { tableName: 'obj_source', columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: 'obj_target', columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: childTableName, columnName: 'workspace_id', udtName: 'uuid', isNullable: 'NO' },
                    { tableName: childTableName, columnName: 'related_id', udtName: 'uuid', isNullable: 'NO' }
                ]
            }
            if (sql.includes('COUNT(*)::text AS "unresolvedCount"')) return [{ unresolvedCount: '1' }]
            return []
        })

        await expect(
            copyWorkspaceOperation(
                executor,
                {
                    schemaName,
                    applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                    sourceWorkspaceId: 'workspace-source',
                    name: vlc('Workspace copy'),
                    description: vlc('Workspace copy description'),
                    userId: 'user-1'
                },
                {
                    createWorkspace,
                    createError: (code, message) => Object.assign(new Error(message), { code })
                }
            )
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains a required reference to a row that was not copied'
        })

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('id_map.source_table_name = $2'), [
            unresolvedDefaultId,
            'obj_target'
        ])
        expect(createWorkspace).not.toHaveBeenCalled()
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."${childTableName}"`))).toBe(
            false
        )
    })

    it('nulls optional workspace-local references that point to rows omitted from the copy map', async () => {
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
                return [
                    { tableName: 'obj_source', objectId: 'source-object' },
                    { tableName: 'obj_target', objectId: 'target-object' }
                ]
            }
            if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return []
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_source' }, { tableName: 'obj_target' }]
            }
            if (sql.includes('source_object.table_name')) {
                return [
                    {
                        sourceTableName: 'obj_source',
                        parentComponentId: null,
                        columnName: 'related_id',
                        targetTableName: 'obj_target',
                        isRequired: false
                    }
                ]
            }
            if (sql.includes('udt_name AS')) {
                return [
                    { tableName: 'obj_source', columnName: 'workspace_id', udtName: 'uuid' },
                    { tableName: 'obj_source', columnName: 'related_id', udtName: 'uuid' },
                    { tableName: 'obj_target', columnName: 'workspace_id', udtName: 'uuid' }
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
        expect(String(clearReferenceCall?.[0])).not.toContain('id_map.old_id = target."related_id"')
        expect(String(clearReferenceCall?.[0])).toContain('id_map.new_id = target."related_id"')
        expect(clearReferenceCall?.[1]).toEqual(['workspace-copy', 'obj_target'])
    })
})
