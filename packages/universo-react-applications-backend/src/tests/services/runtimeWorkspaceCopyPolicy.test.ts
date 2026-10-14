import { copyWorkspace } from '../../services/runtimeWorkspaceService'
import { hasValidWorkspaceCopyAccessLinkIntakePolicies } from '../../services/runtimeWorkspaceCopyPolicy'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334441'
const policyCodenames = [
    'ShowFirstName',
    'RequireFirstName',
    'ShowLastName',
    'RequireLastName',
    'ShowEmail',
    'RequireEmail',
    'ShowPhone',
    'RequirePhone',
    'CaptchaEnabled'
]

const vlc = (content: string) => ({
    _schema: '1',
    _primary: 'en',
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

function createAccessLinkCopyExecutor(input: {
    defaultCount: number
    sourceRow: Record<string, boolean>
    resetFirstNameDefault?: boolean
    invalidResetOnCopyType?: string
}) {
    const { executor, txExecutor } = createMockDbExecutor()
    const fields = policyCodenames.map((codename, index) => ({
        tableName: 'obj_access_links',
        codename,
        columnName: `col_policy_${index}`,
        dataType: 'BOOLEAN',
        uiConfig: { defaultValue: index < input.defaultCount }
    }))

    txExecutor.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
            return [{ id: 'workspace-source' }]
        }
        if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) {
            return [{ tableName: 'obj_access_links', objectId: 'access-links-object' }]
        }
        if (sql.includes('SELECT DISTINCT c.id') && sql.includes(`FROM "${schemaName}"."_app_components"`)) return []
        if (sql.includes('FROM information_schema.tables')) return [{ tableName: 'obj_access_links' }]
        if (sql.includes("jsonb_exists(object_row.config, 'recordPolicy')")) {
            return [{ objectId: 'access-links-object', tableName: 'obj_access_links', recordPolicyPresent: false, recordPolicyJson: null }]
        }
        if (sql.includes("jsonb_typeof(component.ui_config->'resetOnCopy')")) {
            return input.invalidResetOnCopyType
                ? [{ tableName: 'obj_access_links', columnName: 'col_policy_0', valueType: input.invalidResetOnCopyType }]
                : []
        }
        if (sql.includes("component.ui_config->'resetOnCopy'")) {
            return input.resetFirstNameDefault
                ? [{ tableName: 'obj_access_links', parentComponentId: null, columnName: 'col_policy_0', defaultValue: 'false' }]
                : []
        }
        if (sql.includes('component.column_name AS "columnName"') && sql.includes('LOWER(')) return fields
        if (sql.includes('SELECT *') && sql.includes(`FROM "${schemaName}"."obj_access_links"`)) return [input.sourceRow]
        return []
    })

    return { executor, txExecutor }
}

describe('workspace copy AccessLinks intake validation', () => {
    it('accepts a valid persisted AccessLinks intake policy', async () => {
        const sourceRow = policyCodenames.reduce<Record<string, boolean>>((row, _codename, index) => {
            row[`col_policy_${index}`] = index === 0 || index === 1
            return row
        }, {})
        const { txExecutor } = createAccessLinkCopyExecutor({ defaultCount: 0, sourceRow })

        await expect(
            hasValidWorkspaceCopyAccessLinkIntakePolicies(txExecutor, schemaName, 'workspace-source', ['obj_access_links'], new Map())
        ).resolves.toBe(true)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('component.column_name AS "columnName"'), [
            ['obj_access_links']
        ])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining(`FROM "${schemaName}"."obj_access_links"`), [
            'workspace-source'
        ])
    })

    it('rejects invalid source intake before allocating the copy id map', async () => {
        const invalidSourceRow = policyCodenames.reduce<Record<string, boolean>>((row, _codename, index) => {
            row[`col_policy_${index}`] = index === 1
            return row
        }, {})
        const { executor, txExecutor } = createAccessLinkCopyExecutor({ defaultCount: 4, sourceRow: invalidSourceRow })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID',
            message: 'Workspace copy contains an invalid guest intake configuration'
        })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('CREATE TEMP TABLE workspace_copy_id_map'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(
            false
        )
        const resetMetadataSql = txExecutor.query.mock.calls
            .map(([sql]) => String(sql))
            .find((sql) => sql.includes("jsonb_typeof(component.ui_config->'resetOnCopy')"))
        expect(resetMetadataSql).toContain("jsonb_exists(component.ui_config, 'resetOnCopy')")
    })

    it('validates intake after applying resetOnCopy defaults before creating the destination workspace', async () => {
        const validSourceRow = policyCodenames.reduce<Record<string, boolean>>((row, _codename, index) => {
            row[`col_policy_${index}`] = index === 0 || index === 1
            return row
        }, {})
        const { executor, txExecutor } = createAccessLinkCopyExecutor({
            defaultCount: 2,
            sourceRow: validSourceRow,
            resetFirstNameDefault: true
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID',
            message: 'Workspace copy contains an invalid guest intake configuration'
        })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('CREATE TEMP TABLE workspace_copy_id_map'))).toBe(false)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(
            false
        )
    })

    it.each(['string', 'number', 'null', 'array', 'object'])(
        'fails closed when resetOnCopy metadata has JSON type %s',
        async (valueType) => {
            const validSourceRow = policyCodenames.reduce<Record<string, boolean>>((row, _codename, index) => {
                row[`col_policy_${index}`] = index === 0 || index === 1
                return row
            }, {})
            const { executor, txExecutor } = createAccessLinkCopyExecutor({
                defaultCount: 2,
                sourceRow: validSourceRow,
                invalidResetOnCopyType: valueType
            })

            await expect(
                copyWorkspace(executor, {
                    schemaName,
                    sourceWorkspaceId: 'workspace-source',
                    name: vlc('Workspace copy'),
                    description: vlc('Workspace copy description'),
                    userId: 'user-1'
                })
            ).rejects.toThrow('Invalid resetOnCopy metadata; workspace copy aborted')

            expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('CREATE TEMP TABLE workspace_copy_id_map'))).toBe(false)
            expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(
                false
            )
        }
    )
})
