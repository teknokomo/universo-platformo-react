import {
    persistWorkspaceSeedTemplate,
    resetWorkspaceSeededElements,
    syncWorkspaceSeededElements
} from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334880'
const objectId = '018f8a78-7b8f-7c1d-a111-222233334890'
const accessLinkTable = 'obj_018f8a787b8f7c1da111222233334890'
const sectionsComponentId = '018f8a78-7b8f-7c1d-a111-222233335010'
const sectionsTable = 'tbl_018f8a787b8f7c1da111222233335010'
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
const policyComponents = [
    {
        objectId,
        componentId: sectionsComponentId,
        parentComponentId: null,
        codename: 'Sections',
        columnName: 'col_sections',
        dataType: 'TABLE',
        isRequired: false,
        uiConfig: null,
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335011',
        parentComponentId: sectionsComponentId,
        codename: 'SectionOrder',
        columnName: 'col_section_order',
        dataType: 'NUMBER',
        isRequired: true,
        uiConfig: { serverOwned: true, defaultValue: 0 },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335012',
        parentComponentId: sectionsComponentId,
        codename: 'SectionCourseId',
        columnName: 'col_section_course_id',
        dataType: 'STRING',
        isRequired: true,
        uiConfig: { serverOwned: true },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335013',
        parentComponentId: sectionsComponentId,
        codename: 'RuntimeMarker',
        columnName: 'col_runtime_marker',
        dataType: 'STRING',
        isRequired: false,
        uiConfig: { serverOwned: true },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335014',
        parentComponentId: null,
        codename: 'TargetType',
        columnName: 'col_target_type',
        dataType: 'STRING',
        isRequired: true,
        uiConfig: { serverOwned: true, defaultValue: 'quiz' },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    ...policyCodenames.map((codename, index) => ({
        objectId,
        componentId: `018f8a78-7b8f-7c1d-a111-2222333349${String(index).padStart(2, '0')}`,
        parentComponentId: null,
        codename,
        columnName: `col_policy_${index}`,
        dataType: 'BOOLEAN',
        isRequired: false,
        uiConfig: { defaultValue: index < 4 },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    })),
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233334999',
        parentComponentId: null,
        codename: 'UseCount',
        columnName: 'col_use_count',
        dataType: 'NUMBER',
        isRequired: false,
        uiConfig: { serverOwned: true, resetOnCopy: true, defaultValue: 0 },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335000',
        parentComponentId: null,
        codename: 'CourseId',
        columnName: 'col_course_id',
        dataType: 'STRING',
        isRequired: true,
        uiConfig: { serverOwned: true },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    },
    {
        objectId,
        componentId: '018f8a78-7b8f-7c1d-a111-222233335001',
        parentComponentId: null,
        codename: 'OptionalRuntimeToken',
        columnName: 'col_optional_runtime_token',
        dataType: 'STRING',
        isRequired: false,
        uiConfig: { serverOwned: true },
        validationRules: null,
        targetObjectId: null,
        targetObjectKind: null
    }
]

const getAccessLinkSeedMetadataRows = (sql: string): unknown[] | null => {
    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
        return [{ objectId, codename: 'AccessLinks', tableName: accessLinkTable }]
    }
    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) return policyComponents
    if (sql.includes('FROM information_schema.columns c')) {
        return policyComponents
            .filter((component) => component.dataType !== 'TABLE')
            .map((component) => ({
                tableName: component.parentComponentId ? sectionsTable : accessLinkTable,
                columnName: component.columnName,
                udtName: component.dataType === 'NUMBER' ? 'int4' : component.dataType === 'BOOLEAN' ? 'bool' : 'text'
            }))
    }
    return null
}

const configureAccessLinkWorkspaceSeed = (
    executor: ReturnType<typeof createMockDbExecutor>['executor'],
    data: Record<string, unknown>,
    options: { workspaceId?: string; existingSeedRow?: boolean; includeChildBusinessTable?: boolean } = {}
) => {
    const seedData = { CourseId: 'trusted-course-source-id', ...data }
    executor.query.mockImplementation(async (sql: string) => {
        if (sql.includes('information_schema.columns c') && sql.includes("c.column_name = 'workspace_id'")) {
            return [{ tableName: accessLinkTable, objectId }]
        }
        if (sql.includes('FROM information_schema.tables')) {
            return [{ tableName: accessLinkTable }, ...(options.includeChildBusinessTable ? [{ tableName: sectionsTable }] : [])]
        }
        if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
            return options.workspaceId ? [{ id: options.workspaceId }] : []
        }
        const metadataRows = getAccessLinkSeedMetadataRows(sql)
        if (metadataRows !== null) return metadataRows
        if (sql.includes("jsonb_exists(config, 'recordPolicy')")) return []
        if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
            return [
                {
                    value: {
                        version: 1,
                        elements: {
                            [objectId]: [{ id: 'access-link-seed-row', data: seedData }]
                        }
                    }
                }
            ]
        }
        if (sql.includes('SELECT DISTINCT c.id AS "componentId"')) return []
        if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
            if (sql.includes(`"${sectionsTable}"`)) {
                return options.existingSeedRow
                    ? [
                          {
                              id: 'existing-section-row',
                              seedSourceKey: `access-link-seed-row:${sectionsComponentId}:0`,
                              seedSourceOwned: true
                          }
                      ]
                    : []
            }
            return options.existingSeedRow
                ? [{ id: 'existing-access-link', seedSourceKey: 'access-link-seed-row', seedSourceOwned: true }]
                : []
        }
        if (sql.includes(`UPDATE "${schemaName}"."${accessLinkTable}"`)) return [{ id: 'existing-access-link' }]
        if (sql.includes(`UPDATE "${schemaName}"."${sectionsTable}"`)) return [{ id: 'existing-section-row' }]
        if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_operation_audit"`)) {
            return [{ id: '018f8a78-7b8f-7c1d-a111-222233334896' }]
        }
        if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
            return [{ id: `018f8a78-7b8f-7c1d-a111-22223333489${executor.query.mock.calls.length % 10}` }]
        }
        return []
    })
}

const configureWorkspaceSeedTemplatePersistence = (
    executor: ReturnType<typeof createMockDbExecutor>['executor'],
    options: { existingTemplate?: boolean } = {}
) => {
    executor.query.mockImplementation(async (sql: string) => {
        const metadataRows = getAccessLinkSeedMetadataRows(sql)
        if (metadataRows !== null) return metadataRows
        if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
            return options.existingTemplate ? [{ id: '019a0000-0000-7000-8000-000000000003' }] : []
        }
        if (sql.includes('SELECT public.uuid_generate_v7() AS id')) return [{ id: '019a0000-0000-7000-8000-000000000001' }]
        return []
    })
}

describe('applicationWorkspaces AccessLinks intake seeding', () => {
    it('rejects missing trusted values for required server-owned fields before writing a workspace seed template', async () => {
        const { executor } = createMockDbExecutor()
        configureWorkspaceSeedTemplatePersistence(executor, { existingTemplate: true })

        await expect(
            persistWorkspaceSeedTemplate(executor, {
                schemaName,
                elements: {
                    [objectId]: [{ id: '019a0000-0000-7000-8000-000000000002', data: {} }]
                }
            })
        ).rejects.toThrow('Required server-owned workspace seed field has no trusted value: CourseId')

        const settingsWrites = executor.query.mock.calls.filter(([sql]) => {
            const query = String(sql)
            return query.includes(`"${schemaName}"."_app_settings"`) && /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/iu.test(query)
        })
        expect(settingsWrites).toHaveLength(0)
    })

    it('rejects invalid AccessLinks intake before writing a workspace seed template', async () => {
        const { executor } = createMockDbExecutor()
        configureWorkspaceSeedTemplatePersistence(executor, { existingTemplate: true })

        await expect(
            persistWorkspaceSeedTemplate(executor, {
                schemaName,
                elements: {
                    [objectId]: [
                        {
                            id: '019a0000-0000-7000-8000-000000000002',
                            data: { CourseId: 'trusted-course-source-id', ShowFirstName: false, RequireFirstName: true }
                        }
                    ]
                }
            })
        ).rejects.toThrow('Invalid guest access-link intake policy in workspace seed')

        const settingsWrites = executor.query.mock.calls.filter(([sql]) => {
            const query = String(sql)
            return query.includes(`"${schemaName}"."_app_settings"`) && /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/iu.test(query)
        })
        expect(settingsWrites).toHaveLength(0)
    })

    it('persists AccessLinks snapshot seeds with validated intake and metadata defaults normalized', async () => {
        const { executor } = createMockDbExecutor()
        configureWorkspaceSeedTemplatePersistence(executor)

        await persistWorkspaceSeedTemplate(executor, {
            schemaName,
            elements: {
                [objectId]: [{ id: '019a0000-0000-7000-8000-000000000002', data: { CourseId: 'trusted-course-source-id' } }]
            }
        })

        const insert = executor.query.mock.calls.find(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_settings"`))
        expect(insert).toBeDefined()
        const persistedTemplate = JSON.parse(String(insert?.[1]?.[2])) as {
            version: number
            elements: Record<string, Array<{ id: string; data: Record<string, unknown> }>>
        }
        const persistedData = persistedTemplate.elements[objectId]?.[0]?.data

        expect(persistedTemplate.version).toBe(1)
        expect(persistedData).toMatchObject({
            CourseId: 'trusted-course-source-id',
            TargetType: 'quiz',
            UseCount: 0,
            ShowFirstName: true,
            RequireFirstName: true,
            ShowLastName: true,
            RequireLastName: true,
            ShowEmail: false,
            RequireEmail: false,
            ShowPhone: false,
            RequirePhone: false,
            CaptchaEnabled: false
        })
    })

    it('normalizes defaults and preserves explicit intake policy when updating an existing workspace seed template', async () => {
        const { executor } = createMockDbExecutor()
        configureWorkspaceSeedTemplatePersistence(executor, { existingTemplate: true })

        await persistWorkspaceSeedTemplate(executor, {
            schemaName,
            elements: {
                [objectId]: [
                    {
                        id: '019a0000-0000-7000-8000-000000000002',
                        data: {
                            CourseId: 'trusted-course-source-id',
                            ShowFirstName: false,
                            RequireFirstName: false,
                            ShowEmail: true,
                            RequireEmail: true,
                            CaptchaEnabled: true
                        }
                    }
                ]
            }
        })

        const update = executor.query.mock.calls.find(([sql]) => String(sql).includes(`UPDATE "${schemaName}"."_app_settings"`))
        expect(update?.[1]?.[0]).toBe('019a0000-0000-7000-8000-000000000003')
        const persistedTemplate = JSON.parse(String(update?.[1]?.[1])) as {
            version: number
            elements: Record<string, Array<{ data: Record<string, unknown> }>>
        }

        expect(persistedTemplate.version).toBe(1)
        expect(persistedTemplate.elements[objectId]?.[0]?.data).toMatchObject({
            CourseId: 'trusted-course-source-id',
            TargetType: 'quiz',
            UseCount: 0,
            ShowFirstName: false,
            RequireFirstName: false,
            ShowLastName: true,
            RequireLastName: true,
            ShowEmail: true,
            RequireEmail: true,
            ShowPhone: false,
            RequirePhone: false,
            CaptchaEnabled: true
        })
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."_app_settings"`))).toBe(false)
    })

    it('persists metadata defaults when workspace seed rows omit intake settings', async () => {
        const { executor } = createMockDbExecutor()
        configureAccessLinkWorkspaceSeed(executor, {
            UseCount: 99,
            CourseId: 'trusted-course-source-id',
            TargetType: 'content'
        })

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334898'
        })

        const insertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."${accessLinkTable}"`)
        )
        expect(insertCall).toBeDefined()
        expect(insertCall?.[1]).toEqual(expect.arrayContaining([true, true, true, true, false, false, false, false, false]))
        expect(insertCall?.[1]).toContain(0)
        expect(insertCall?.[1]).not.toContain(99)
        expect(insertCall?.[1]).toContain('content')
        expect(insertCall?.[1]).toContain('trusted-course-source-id')
        expect(String(insertCall?.[0])).not.toContain('"col_optional_runtime_token"')
    })

    it('rejects workspace seed rows that hide a required guest identity field before insert', async () => {
        const { executor } = createMockDbExecutor()
        configureAccessLinkWorkspaceSeed(executor, { ShowFirstName: false, RequireFirstName: true })

        await expect(
            syncWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId: '018f8a78-7b8f-7c1d-a111-222233334898'
            })
        ).rejects.toThrow('Invalid guest access-link intake policy in workspace seed')

        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."${accessLinkTable}"`))).toBe(
            false
        )
    })

    it('reapplies metadata defaults when an authorized workspace seed reset reconciles AccessLinks', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334898'
        configureAccessLinkWorkspaceSeed(txExecutor, {}, { workspaceId, existingSeedRow: true })

        await resetWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId,
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334897',
            currentUserId: '018f8a78-7b8f-7c1d-a111-222233334897'
        })

        const resetSeedUpdate = txExecutor.query.mock.calls.find(
            ([sql]) => String(sql).includes(`UPDATE "${schemaName}"."${accessLinkTable}"`) && String(sql).includes('col_policy_0')
        )
        const workspaceLock = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes(`FROM "${schemaName}"."_app_workspaces"`))
        expect(String(workspaceLock?.[0])).toMatch(/FOR UPDATE/i)
        const resetSeedSql = String(resetSeedUpdate?.[0] ?? '')
        const resetSeedParams = resetSeedUpdate?.[1] ?? []
        const policyBindings = Array.from(resetSeedSql.matchAll(/"(col_policy_\d+)"\s*=\s*\$(\d+)/gu))
        expect(policyBindings.map(([, column]) => column).sort()).toEqual(policyCodenames.map((_, index) => `col_policy_${index}`).sort())
        for (const [, column, parameterIndex] of policyBindings) {
            const policyIndex = Number(column?.slice('col_policy_'.length))
            const value = resetSeedParams[Number(parameterIndex) - 1]
            expect(value).toBe(policyIndex < 4)
        }
        expect(resetSeedUpdate?.[0]).toContain('_upl_deleted = false')
        expect(resetSeedUpdate?.[0]).toContain('_app_deleted = false')
        expect(resetSeedUpdate?.[0]).not.toContain('"col_use_count"')
        expect(resetSeedUpdate?.[1]).not.toContain(0)
    })

    it('rejects an invalid AccessLinks reset inside its savepoint before recording a success audit', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334898'
        const transactionalState = { accessLinkActive: true, softDeleteObserved: false }
        configureAccessLinkWorkspaceSeed(
            txExecutor,
            { ShowFirstName: false, RequireFirstName: true },
            { workspaceId, existingSeedRow: true }
        )
        const queryImplementation = txExecutor.query.getMockImplementation()
        expect(queryImplementation).toBeDefined()
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[]) => {
            if (sql.includes(`UPDATE "${schemaName}"."${accessLinkTable}"`) && sql.includes('_upl_deleted = true')) {
                transactionalState.accessLinkActive = false
                transactionalState.softDeleteObserved = true
            }
            return queryImplementation?.(sql, params) ?? []
        })
        txExecutor.transaction.mockImplementation(async (work: (transactionExecutor: typeof txExecutor) => Promise<unknown>) => {
            const stateBeforeSavepoint = transactionalState.accessLinkActive
            try {
                return await work(txExecutor)
            } catch (error) {
                transactionalState.accessLinkActive = stateBeforeSavepoint
                throw error
            }
        })

        await expect(
            resetWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId,
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334897',
                currentUserId: '018f8a78-7b8f-7c1d-a111-222233334897'
            })
        ).rejects.toThrow('Invalid guest access-link intake policy in workspace seed')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.transaction).toHaveBeenCalledTimes(1)
        expect(transactionalState.softDeleteObserved).toBe(true)
        expect(transactionalState.accessLinkActive).toBe(true)
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_operation_audit"`)
            )
        ).toBe(false)
    })

    it('uses metadata defaults and trusted values for TABLE child seeds and omits absent optional server-owned columns', async () => {
        const { executor } = createMockDbExecutor()
        configureAccessLinkWorkspaceSeed(executor, {
            Sections: [{ SectionOrder: 99, SectionCourseId: 'trusted-child-course' }]
        })

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334898'
        })

        const childInsert = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."${sectionsTable}"`)
        )
        expect(childInsert).toBeDefined()
        const insertSql = String(childInsert?.[0])
        const insertColumns = insertSql
            .slice(insertSql.indexOf('(') + 1, insertSql.indexOf(')'))
            .split(',')
            .map((column) => column.trim().replaceAll('"', ''))
        const insertValues = childInsert?.[1] ?? []

        expect(insertColumns).toContain('col_section_order')
        expect(insertColumns).toContain('col_section_course_id')
        expect(insertColumns).not.toContain('col_runtime_marker')
        expect(insertValues[insertColumns.indexOf('col_section_order')]).toBe(99)
        expect(insertValues[insertColumns.indexOf('col_section_course_id')]).toBe('trusted-child-course')
    })

    it('preserves server-owned TABLE child values during an authorized workspace seed reset', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334898'
        const actorUserId = '018f8a78-7b8f-7c1d-a111-222233334897'
        configureAccessLinkWorkspaceSeed(
            txExecutor,
            { Sections: [{ SectionOrder: 99, SectionCourseId: 'trusted-child-course' }] },
            { workspaceId, existingSeedRow: true, includeChildBusinessTable: true }
        )

        await resetWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId,
            actorUserId,
            currentUserId: actorUserId
        })

        const childUpdate = txExecutor.query.mock.calls.reduce<[string, unknown[]] | null>((latest, [sql, params]) => {
            const query = String(sql)
            return query.includes(`UPDATE "${schemaName}"."${sectionsTable}"`) &&
                (params as unknown[]).includes(`access-link-seed-row:${sectionsComponentId}:0`)
                ? [query, params as unknown[]]
                : latest
        }, null)
        expect(childUpdate).toBeDefined()
        const updateSql = childUpdate?.[0] ?? ''
        expect(updateSql).not.toContain('"col_section_order" =')
        expect(updateSql).not.toContain('"col_section_course_id" =')
        expect(updateSql).toContain('_upl_deleted = false')
        expect(updateSql).toContain('_app_deleted = false')
        expect(childUpdate?.[1]).toEqual([
            'existing-section-row',
            workspaceId,
            `access-link-seed-row:${sectionsComponentId}:0`,
            true,
            'existing-access-link',
            0,
            actorUserId
        ])
    })
})
