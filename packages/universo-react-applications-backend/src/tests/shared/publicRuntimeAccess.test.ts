import {
    listActivePublicWorkspaceIds,
    loadPublicRuntimeRecord,
    loadPublicTableRows,
    resolvePublicRuntimeObject,
    resolvePublicRuntimeSchema
} from '../../shared/publicRuntimeAccess'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('publicRuntimeAccess helpers', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334440'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('rejects non-public applications when resolving the runtime schema', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ id: 'app-1', schemaName, isPublic: false }])

        const status = jest.fn().mockReturnThis()
        const json = jest.fn()

        const result = await resolvePublicRuntimeSchema(() => executor, '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b', {
            status,
            json
        } as never)

        expect(result).toBeNull()
        expect(status).toHaveBeenCalledWith(403)
        expect(json).toHaveBeenCalledWith({ error: 'Application does not allow public runtime access' })
    })

    it('exposes active non-personal workspace candidates to guest runtime helpers without relying on a seeded codename', async () => {
        const { executor } = createMockDbExecutor()
        const mainWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const sharedWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334442'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            expect(sql).toContain('COALESCE(status,')
            expect(sql).toContain("workspace_type <> 'personal'")
            expect(sql).toContain('personal_user_id IS NULL')
            expect(sql).toContain('ORDER BY workspace_type ASC, _upl_created_at ASC, id ASC')
            expect(sql).not.toContain('codename = $1')
            expect(sql).not.toContain('LIMIT 1')
            expect(params).toEqual([])
            return [{ id: mainWorkspaceId }, { id: sharedWorkspaceId }, { id: 'not-a-uuid' }]
        })

        await expect(listActivePublicWorkspaceIds(executor, schemaName)).resolves.toEqual([mainWorkspaceId, sharedWorkspaceId])
    })

    it('loads a public runtime object definition and exposes top-level components', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    {
                        id: 'object-1',
                        codename: { locales: { en: { content: 'LearningResources' } } },
                        kind: 'object',
                        table_name: 'learning_resources_table'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        id: 'attr-title',
                        codename: { locales: { en: { content: 'Title' } } },
                        column_name: 'title',
                        data_type: 'STRING',
                        parent_component_id: null,
                        target_object_id: null,
                        target_object_kind: null
                    },
                    {
                        id: 'attr-content',
                        codename: { locales: { en: { content: 'ContentItems' } } },
                        column_name: 'content_items',
                        data_type: 'TABLE',
                        parent_component_id: null,
                        target_object_id: null,
                        target_object_kind: null
                    }
                ]
            }

            return []
        })

        const binding = await resolvePublicRuntimeObject(executor, schemaName, 'LearningResources')

        expect(binding).toMatchObject({
            id: 'object-1',
            kind: 'object',
            tableName: 'learning_resources_table'
        })
        expect(binding?.attrs).toHaveLength(2)
    })

    it('loads top-level records and child table rows for public learning resource content', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                return [
                    {
                        id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
                        title: 'Demo learning resource',
                        description: 'Intro lesson'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                expect(sql).toContain('WHERE _tp_parent_id = $1')
                expect(sql).toContain('ORDER BY COALESCE("_tp_sort_order", 0) ASC, id ASC')

                return [
                    {
                        id: 'row-1',
                        _tp_parent_id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
                        _tp_sort_order: 0,
                        item_type: 'text',
                        item_title: 'Welcome',
                        item_content: 'Hello students'
                    }
                ]
            }

            return []
        })

        const record = await loadPublicRuntimeRecord(
            executor,
            schemaName,
            {
                id: 'object-1',
                codename: 'LearningResources',
                kind: 'object',
                tableName: 'learning_resources_table',
                attrs: [
                    { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_component_id: null },
                    {
                        id: 'attr-description',
                        codename: 'Description',
                        column_name: 'description',
                        data_type: 'STRING',
                        parent_component_id: null
                    }
                ]
            },
            '8f1c1880-2b67-4d79-b02b-a53db0a85453'
        )

        const childRows = await loadPublicTableRows(
            executor,
            schemaName,
            {
                id: 'attr-content',
                codename: 'ContentItems',
                column_name: 'content_items',
                data_type: 'TABLE',
                parent_component_id: null
            },
            [
                {
                    id: 'child-type',
                    codename: 'ItemType',
                    column_name: 'item_type',
                    data_type: 'STRING',
                    parent_component_id: 'attr-content'
                },
                {
                    id: 'child-title',
                    codename: 'ItemTitle',
                    column_name: 'item_title',
                    data_type: 'STRING',
                    parent_component_id: 'attr-content'
                },
                {
                    id: 'child-content',
                    codename: 'ItemContent',
                    column_name: 'item_content',
                    data_type: 'STRING',
                    parent_component_id: 'attr-content'
                }
            ],
            '8f1c1880-2b67-4d79-b02b-a53db0a85453'
        )

        expect(record).toMatchObject({
            id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
            title: 'Demo learning resource'
        })
        expect(childRows).toEqual([
            expect.objectContaining({
                item_type: 'text',
                item_title: 'Welcome'
            })
        ])
    })

    it('loads public child table rows using canonical runtime parent and sort columns', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                expect(sql).toContain('SELECT id, "item_type", "item_title"')
                expect(sql).toContain('WHERE _tp_parent_id = $1')
                expect(sql).toContain('ORDER BY COALESCE("_tp_sort_order", 0) ASC, id ASC')
                expect(params).toEqual(['8f1c1880-2b67-4d79-b02b-a53db0a85453'])

                return [
                    {
                        id: 'row-1',
                        _tp_parent_id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
                        _tp_sort_order: 0,
                        item_type: 'text',
                        item_title: 'Welcome'
                    }
                ]
            }

            return []
        })

        const childRows = await loadPublicTableRows(
            executor,
            schemaName,
            {
                id: 'attr-content',
                codename: 'ContentItems',
                column_name: 'content_items',
                data_type: 'TABLE',
                parent_component_id: null
            },
            [
                {
                    id: 'child-type',
                    codename: 'ItemType',
                    column_name: 'item_type',
                    data_type: 'STRING',
                    parent_component_id: 'attr-content'
                },
                {
                    id: 'child-title',
                    codename: 'ItemTitle',
                    column_name: 'item_title',
                    data_type: 'STRING',
                    parent_component_id: 'attr-content'
                }
            ],
            '8f1c1880-2b67-4d79-b02b-a53db0a85453'
        )

        expect(childRows).toEqual([
            expect.objectContaining({
                id: 'row-1',
                item_type: 'text',
                item_title: 'Welcome'
            })
        ])
    })

    it('loads childless TABLE row identities when the optional physical child table exists', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('to_regclass')) return [{ table_exists: true }]
            if (sql.includes('SELECT id')) return [{ id: 'row-1' }]
            return []
        })
        const childRows = await loadPublicTableRows(
            executor,
            schemaName,
            {
                id: 'attr-content',
                codename: 'ContentItems',
                column_name: 'content_items',
                data_type: 'TABLE',
                parent_component_id: null
            },
            [],
            '018f8a78-7b8f-7c1d-a111-222233334444'
        )

        expect(childRows).toEqual([{ id: 'row-1' }])
        expect(executor.query).toHaveBeenNthCalledWith(1, expect.stringContaining("to_regclass(format('%I.%I', $1::text, $2::text))"), [
            schemaName,
            'content_items'
        ])
        expect(executor.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT id'), ['018f8a78-7b8f-7c1d-a111-222233334444'])
    })

    it('omits an absent optional physical child table only when no child fields are declared', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ table_exists: false }])
        const childRows = await loadPublicTableRows(
            executor,
            schemaName,
            {
                id: 'attr-content',
                codename: 'ContentItems',
                column_name: 'content_items',
                data_type: 'TABLE',
                parent_component_id: null
            },
            [],
            '018f8a78-7b8f-7c1d-a111-222233334444'
        )

        expect(childRows).toEqual([])
        expect(executor.query).toHaveBeenCalledTimes(1)
        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining("to_regclass(format('%I.%I', $1::text, $2::text))"), [
            schemaName,
            'content_items'
        ])
    })

    it('propagates errors while checking an optional child table instead of treating them as absence', async () => {
        const { executor } = createMockDbExecutor()
        const lookupError = Object.assign(new Error('permission denied'), { code: '42501' })
        executor.query.mockRejectedValue(lookupError)

        await expect(
            loadPublicTableRows(
                executor,
                schemaName,
                {
                    id: 'attr-content',
                    codename: 'ContentItems',
                    column_name: 'content_items',
                    data_type: 'TABLE',
                    parent_component_id: null
                },
                [],
                '018f8a78-7b8f-7c1d-a111-222233334444'
            )
        ).rejects.toBe(lookupError)

        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it('surfaces a missing child table when child fields are declared', async () => {
        const { executor } = createMockDbExecutor()
        const missingTableError = Object.assign(new Error('relation does not exist'), { code: '42P01' })
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT id')) throw missingTableError
            return []
        })

        await expect(
            loadPublicTableRows(
                executor,
                schemaName,
                {
                    id: 'attr-content',
                    codename: 'ContentItems',
                    column_name: 'content_items',
                    data_type: 'TABLE',
                    parent_component_id: null
                },
                [
                    {
                        id: 'child-title',
                        codename: 'ItemTitle',
                        column_name: 'item_title',
                        data_type: 'STRING',
                        parent_component_id: 'attr-content'
                    }
                ],
                '018f8a78-7b8f-7c1d-a111-222233334444'
            )
        ).rejects.toBe(missingTableError)
    })

    it('does not select TABLE components as parent-table columns when loading a public runtime record', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                expect(sql).toContain('SELECT id, "title", "description"')
                expect(sql).not.toContain('"content_items"')

                return [
                    {
                        id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
                        title: 'Demo learning resource',
                        description: 'Intro lesson'
                    }
                ]
            }

            return []
        })

        const record = await loadPublicRuntimeRecord(
            executor,
            schemaName,
            {
                id: 'object-1',
                codename: 'LearningResources',
                kind: 'object',
                tableName: 'learning_resources_table',
                attrs: [
                    { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_component_id: null },
                    {
                        id: 'attr-description',
                        codename: 'Description',
                        column_name: 'description',
                        data_type: 'STRING',
                        parent_component_id: null
                    },
                    {
                        id: 'attr-content',
                        codename: 'ContentItems',
                        column_name: 'content_items',
                        data_type: 'TABLE',
                        parent_component_id: null
                    }
                ]
            },
            '8f1c1880-2b67-4d79-b02b-a53db0a85453'
        )

        expect(record).toMatchObject({
            id: '8f1c1880-2b67-4d79-b02b-a53db0a85453',
            title: 'Demo learning resource',
            description: 'Intro lesson'
        })
    })
})
