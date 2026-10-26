import { copyWorkspace } from '../../services/runtimeWorkspaceService'
import {
    hasValidWorkspaceCopyAccessLinkIntakePolicies,
    hasWorkspaceCopyTemplateMaterialsExcluded,
    remapWorkspaceCopyMaterialInterpretations
} from '../../services/runtimeWorkspaceCopyPolicy'
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
        if (sql.includes('FROM workspace_copy_source_rows')) return [{ rowData: input.sourceRow }]
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

    it('validates AccessLinks rows from the materialized workspace copy snapshot', async () => {
        const sourceRow = policyCodenames.reduce<Record<string, boolean>>((row, _codename, index) => {
            row[`col_policy_${index}`] = index === 0 || index === 1
            return row
        }, {})
        const { txExecutor } = createAccessLinkCopyExecutor({ defaultCount: 0, sourceRow })

        await expect(
            hasValidWorkspaceCopyAccessLinkIntakePolicies(txExecutor, schemaName, 'workspace-source', ['obj_access_links'], new Map(), {
                sourceSnapshot: true
            })
        ).resolves.toBe(true)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('FROM workspace_copy_source_rows'), [
            'obj_access_links',
            'workspace-source'
        ])
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes(`FROM "${schemaName}"."obj_access_links"`))).toBe(false)
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
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
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
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
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
                    applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
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

describe('workspace copy TableTemplate aggregate integrity', () => {
    const tableComponentId = '018f8a78-7b8f-7c1d-a111-222233334471'
    const childTableName = `tbl_${tableComponentId.replaceAll('-', '')}`
    const discoveredTables = ['obj_materials', 'obj_table_templates', childTableName]
    const scopedTables = ['obj_table_templates', childTableName]

    it('detects included TableTemplate Materials when Material is excluded from workspace copy', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"_app_objects"') && sql.includes('ANY($2::text[])')) {
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
                        recordPolicyJson: JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })
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
            if (sql.includes('child_row.row_data ->>')) return [{ hasMaterialReference: true }]
            return []
        })

        await expect(
            hasWorkspaceCopyTemplateMaterialsExcluded(txExecutor, schemaName, 'workspace-source', discoveredTables, scopedTables)
        ).resolves.toBe(true)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('object_row.table_name = ANY($1::text[])'), [
            discoveredTables,
            ['material', 'tabletemplate']
        ])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('object_row.table_name = ANY($1::text[])'), [
            ['obj_table_templates']
        ])
        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('child_row.row_data ->> $4::text IS NOT NULL'), [
            'workspace-source',
            'obj_table_templates',
            childTableName,
            'material_ref'
        ])
    })

    it('allows the copy policy check when Material remains in the copy scope', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValue([
            {
                objectId: 'material-object',
                codename: 'material',
                tableName: 'obj_materials',
                recordPolicyPresent: true,
                recordPolicyJson: JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })
            },
            {
                objectId: 'template-object',
                codename: 'tabletemplate',
                tableName: 'obj_table_templates',
                recordPolicyPresent: false,
                recordPolicyJson: null
            }
        ])

        await expect(
            hasWorkspaceCopyTemplateMaterialsExcluded(txExecutor, schemaName, 'workspace-source', discoveredTables, discoveredTables)
        ).resolves.toBe(false)
        expect(txExecutor.query).toHaveBeenCalledTimes(3)
    })

    it('rejects an included Material whose TemplateOwnerId points to an excluded TableTemplate', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"_app_objects"') && sql.includes('ANY($2::text[])')) {
                return [
                    {
                        objectId: 'template-object',
                        codename: 'tabletemplate',
                        tableName: 'obj_table_templates',
                        recordPolicyPresent: true,
                        recordPolicyJson: JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })
                    },
                    {
                        objectId: 'material-object',
                        codename: 'material',
                        tableName: 'obj_materials',
                        recordPolicyPresent: false,
                        recordPolicyJson: null
                    }
                ]
            }
            if (sql.includes('workspace_copy_template_material_owners')) {
                return [{ hasTemplateOwnerReference: false, hasIncludedMaterialExcludedTemplateReference: true }]
            }
            return []
        })

        await expect(
            hasWorkspaceCopyTemplateMaterialsExcluded(txExecutor, schemaName, 'workspace-source', discoveredTables, ['obj_materials'])
        ).resolves.toBe(true)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('workspace_copy_excluded_template_ids'), [
            'workspace-source',
            []
        ])
    })

    it('rejects an excluded Material whose TemplateOwnerId points to a copied TableTemplate', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM') && sql.includes('"_app_objects"') && sql.includes('ANY($2::text[])')) {
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
                        recordPolicyJson: JSON.stringify({ version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' })
                    }
                ]
            }
            if (sql.includes('workspace_copy_template_material_owners')) {
                return [{ hasTemplateOwnerReference: true, hasIncludedMaterialExcludedTemplateReference: false }]
            }
            return []
        })

        await expect(
            hasWorkspaceCopyTemplateMaterialsExcluded(txExecutor, schemaName, 'workspace-source', discoveredTables, ['obj_table_templates'])
        ).resolves.toBe(true)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('material_owner.material_included = false'), [
            'workspace-source',
            ['obj_table_templates']
        ])
    })
})

describe('workspace copy Material InterpretationId remapping', () => {
    const materialTableName = 'obj_materials'
    const interpretationTableName = 'obj_interpretations'
    const metadataRow = {
        materialTableName,
        interpretationIdColumnName: 'interpretation_id',
        interpretationTableNames: [interpretationTableName]
    }

    it('remaps the server-owned string reference through the copied Interpretation ID map', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('ARRAY_AGG(DISTINCT interpretation.table_name')) return [metadataRow]
            if (sql.includes('UPDATE') && sql.includes('workspace_copy_id_map')) return []
            if (sql.includes('hasUnresolvedReferences')) return [{ hasUnresolvedReferences: false }]
            return []
        })

        await expect(
            remapWorkspaceCopyMaterialInterpretations(txExecutor, schemaName, 'workspace-copy', (code, message) =>
                Object.assign(new Error(message), { code })
            )
        ).resolves.toBeUndefined()

        const metadataQuery = txExecutor.query.mock.calls[0]?.[0]
        expect(metadataQuery).toContain("= 'interpretationid'")
        expect(metadataQuery).toContain("interpretation_id_component.data_type = 'STRING'")
        expect(metadataQuery).toContain("= 'material'")

        const updateCall = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE'))
        expect(updateCall?.[0]).toContain('LOWER(BTRIM(material."interpretation_id")) = LOWER(id_map.old_id::text)')
        expect(updateCall?.[0]).toContain('id_map.source_table_name = $2::text')
        expect(updateCall?.[1]).toEqual(['workspace-copy', interpretationTableName])
    })

    it('fails closed with the structured unresolved-reference error when a non-empty string is unmapped', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('ARRAY_AGG(DISTINCT interpretation.table_name')) return [metadataRow]
            if (sql.includes('UPDATE') && sql.includes('workspace_copy_id_map')) return []
            if (sql.includes('hasUnresolvedReferences')) return [{ hasUnresolvedReferences: true }]
            return []
        })
        const createError = jest.fn((code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED', message: string) =>
            Object.assign(new Error(message), { code })
        )

        await expect(
            remapWorkspaceCopyMaterialInterpretations(txExecutor, schemaName, 'workspace-copy', createError)
        ).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains a Material InterpretationId reference that cannot be resolved'
        })

        expect(createError).toHaveBeenCalledTimes(1)
        expect(createError).toHaveBeenCalledWith(
            'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            'Workspace copy contains a Material InterpretationId reference that cannot be resolved'
        )
    })

    it('allows empty references when Interpretation metadata is absent', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('ARRAY_AGG(DISTINCT interpretation.table_name')) {
                return [{ ...metadataRow, interpretationTableNames: [] }]
            }
            if (sql.includes('hasReferences')) return [{ hasReferences: false }]
            return []
        })

        await expect(
            remapWorkspaceCopyMaterialInterpretations(txExecutor, schemaName, 'workspace-copy', (code, message) =>
                Object.assign(new Error(message), { code })
            )
        ).resolves.toBeUndefined()
    })
})
