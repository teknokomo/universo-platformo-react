import { MetahubObjectsService } from '../../domains/metahubs/services/MetahubObjectsService'
import { MetahubNotFoundError } from '../../domains/shared/domainErrors'

describe('MetahubObjectsService mutation fail-closed behavior', () => {
    type MockExecutor = {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const mockEnsureSchema = jest.fn()
    const mockQuery = jest.fn()
    const mockExec: MockExecutor = {
        query: mockQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as unknown as ConstructorParameters<typeof MetahubObjectsService>[1]

    const service = new MetahubObjectsService(mockExec as unknown as ConstructorParameters<typeof MetahubObjectsService>[0], schemaService)

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockQuery.mockResolvedValue([{ id: 'object-1' }])
        mockExec.transaction.mockImplementation(async (callback: (tx: MockExecutor) => Promise<unknown>) => callback(mockExec))
    })

    it('assigns custom physical-table prefixes for custom runtime entity kinds on create', async () => {
        mockQuery
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ max_sort_order: 0 }])
            .mockResolvedValueOnce([
                {
                    id: 'object-custom-1',
                    kind: 'customer_registry',
                    codename: {
                        _schema: '1',
                        _primary: 'en',
                        locales: { en: { content: 'customer_registry' } }
                    },
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    config: { sortOrder: 1 }
                }
            ])
            .mockResolvedValueOnce([
                {
                    capabilities: {
                        dataSchema: { enabled: true },
                        records: false,
                        treeAssignment: false,
                        optionValues: false,
                        constants: false,
                        hierarchy: false,
                        nestedCollections: false,
                        relations: false,
                        actions: false,
                        events: false,
                        modules: false,
                        layoutConfig: false,
                        runtimeBehavior: { enabled: true },
                        physicalTable: { enabled: true, prefix: 'cust' }
                    }
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'object-custom-1', config: { sortOrder: 1 } }])
            .mockResolvedValueOnce([
                {
                    id: 'object-custom-1',
                    kind: 'customer_registry',
                    codename: {
                        _schema: '1',
                        _primary: 'en',
                        locales: { en: { content: 'customer_registry' } }
                    },
                    table_name: 'cust_objectcustom1',
                    presentation: { name: { en: 'Customer Registry' }, description: {} },
                    config: { sortOrder: 1 }
                }
            ])

        await service.createObject(
            'metahub-1',
            'customer_registry',
            {
                id: 'object-custom-1',
                codename: {
                    _schema: '1',
                    _primary: 'en',
                    locales: { en: { content: 'customer_registry' } }
                },
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: { en: { content: 'Customer Registry' } }
                },
                description: {
                    _schema: '1',
                    _primary: 'en',
                    locales: { en: { content: 'Runtime customer registry' } }
                },
                config: {}
            },
            'user-1'
        )

        expect(mockQuery.mock.calls).toEqual(
            expect.arrayContaining([
                expect.arrayContaining([
                    expect.stringContaining('INSERT INTO "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"'),
                    expect.arrayContaining(['object-custom-1', 'customer_registry'])
                ]),
                expect.arrayContaining([
                    expect.stringContaining('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects" SET table_name = $1'),
                    ['cust_objectcustom1', 'object-custom-1']
                ])
            ])
        )
    })

    it('soft-deletes only active metahub object rows', async () => {
        await service.delete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[1]
        expect(sql).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('SET _mhb_deleted = TRUE')
        expect(sql).toContain('WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false')
        expect(sql).toContain('RETURNING id')
        expect(params[1]).toBe('user-1')
        expect(params[2]).toBe('object-1')
    })

    it('fails closed when soft delete touches no active rows', async () => {
        mockQuery.mockResolvedValueOnce([{ id: 'missing-object', kind: 'object' }]).mockResolvedValueOnce([])

        await expect(service.delete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
    })

    it('restores only metahub object rows that are currently in trash', async () => {
        await service.restore('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('SET _mhb_deleted = FALSE')
        expect(sql).toContain('WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = true')
        expect(sql).toContain('RETURNING id')
        expect(params[1]).toBe('user-1')
        expect(params[2]).toBe('object-1')
    })

    it('fails closed when restore touches no deleted rows', async () => {
        mockQuery.mockResolvedValueOnce([])

        await expect(service.restore('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
    })

    it('permanently deletes only rows that still exist in the metahub schema', async () => {
        await service.permanentDelete('metahub-1', 'object-1', 'user-1')

        const [sql, params] = mockQuery.mock.calls[1]
        expect(sql).toContain('DELETE FROM "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(sql).toContain('WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = true')
        expect(sql).toContain('RETURNING id')
        expect(params).toEqual(['object-1'])
    })

    it('fails closed when permanent delete touches no rows', async () => {
        mockQuery.mockResolvedValueOnce([{ id: 'missing-object', kind: 'object' }]).mockResolvedValueOnce([])

        await expect(service.permanentDelete('metahub-1', 'missing-object', 'user-1')).rejects.toThrow(MetahubNotFoundError)
    })

    it('omits undefined presentation and config fields when updating a generic object row', async () => {
        const localizedName = {
            _schema: 'v1',
            _primary: 'en',
            locales: { en: { content: 'Products updated' } }
        }

        jest.spyOn(service, 'findById').mockResolvedValue({
            id: 'object-1',
            kind: 'object',
            codename: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'Products' } }
            },
            presentation: {
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Products' } }
                },
                description: undefined
            },
            config: {
                hubs: [],
                isSingleHub: false,
                isRequiredHub: false,
                runtimeConfig: undefined
            }
        } as never)

        mockQuery.mockResolvedValueOnce([{ id: 'object-1' }])

        await service.updateObject(
            'metahub-1',
            'object-1',
            'object',
            {
                name: localizedName,
                config: {
                    hubs: [],
                    isSingleHub: false,
                    isRequiredHub: false,
                    sortOrder: 3,
                    runtimeConfig: undefined
                },
                updatedBy: 'user-1'
            },
            'user-1'
        )

        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).toContain('UPDATE "mhb_a1b2c3d4e5f67890abcdef1234567890_b1"."_mhb_objects"')
        expect(JSON.parse(params[2])).toEqual({ name: localizedName })
        expect(JSON.parse(params[3])).toEqual({ hubs: [], isSingleHub: false, isRequiredHub: false, sortOrder: 3 })
    })

    it('clears a project binding when config.projectBinding is null but keeps it when the key is absent', async () => {
        const existing = {
            id: 'inst-1',
            kind: 'project',
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'World' } } },
            presentation: {},
            config: {
                sortOrder: 7,
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: 'proj-1' }
            }
        } as never

        // The persisted config is the only JSON-object string bind-param for these
        // calls (no name/codename are sent), so locate it by parsing.
        const persistedConfig = (callIndex: number): Record<string, unknown> => {
            const params = mockQuery.mock.calls[callIndex][1] as unknown[]
            for (const param of params) {
                if (typeof param !== 'string') continue
                try {
                    const parsed = JSON.parse(param)
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
                } catch {
                    // Non-JSON bind param (id, user id, …) — skip.
                }
            }
            throw new Error('config bind-param not found')
        }

        // Unbind path: an explicit `null` survives the shallow-merge + strip
        // (only `undefined` is stripped), so the stored binding is overwritten.
        jest.spyOn(service, 'findById').mockResolvedValue(existing)
        mockQuery.mockResolvedValueOnce([{ id: 'inst-1' }])
        await service.updateObject('metahub-1', 'inst-1', 'project', { config: { projectBinding: null }, updatedBy: 'user-1' }, 'user-1')
        expect(persistedConfig(0)).toEqual({ sortOrder: 7, projectBinding: null })

        // Absent key path (the original bug): shallow-merge leaves the binding in
        // place, which is why the unbind must send `null` rather than omit the key.
        jest.spyOn(service, 'findById').mockResolvedValue(existing)
        mockQuery.mockResolvedValueOnce([{ id: 'inst-1' }])
        await service.updateObject('metahub-1', 'inst-1', 'project', { config: { sortOrder: 9 }, updatedBy: 'user-1' }, 'user-1')
        expect(persistedConfig(1)).toEqual({
            sortOrder: 9,
            projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: 'proj-1' }
        })
    })

    it('filters virtual shared containers out of standard object lists and counts', async () => {
        mockQuery.mockResolvedValueOnce([
            { id: 'object-1', kind: 'object', codename: { _primary: 'en', locales: { en: { content: 'object' } } } }
        ])

        await service.findAllByKind('metahub-1', 'object', 'user-1')
        await service.countByKind('metahub-1', 'object', 'user-1')

        expect(mockQuery.mock.calls[0][0]).toContain("COALESCE((config->>'isVirtualContainer')::boolean, false) = false")
        expect(mockQuery.mock.calls[1][0]).toContain("COALESCE((config->>'isVirtualContainer')::boolean, false) = false")
    })

    it('counts active instances bound to a PlayCanvas project by codename, excluding one instance', async () => {
        mockQuery.mockResolvedValueOnce([{ count: '2' }])

        const count = await service.countActiveProjectBindingsByCodename('metahub-1', 'mmoomm_world', 'inst-1', 'user-1')

        expect(count).toBe(2)
        const [sql, params] = mockQuery.mock.calls[0]
        // Filters on the JSONB binding codename, excludes the given id, and only
        // counts ACTIVE rows (not soft-deleted) so a deleted sibling cannot keep
        // a shared project alive.
        expect(sql).toContain("config->'projectBinding'->>'projectCodename' = $1")
        expect(sql).toContain('id <> $2')
        expect(sql).toContain('_mhb_deleted = FALSE')
        expect(sql).toContain('_upl_deleted = FALSE')
        expect(params).toEqual(['mmoomm_world', 'inst-1'])
    })

    it('omits the id-exclusion clause when no instance id is excluded', async () => {
        mockQuery.mockResolvedValueOnce([{ count: '0' }])

        const count = await service.countActiveProjectBindingsByCodename('metahub-1', 'mmoomm_world')

        expect(count).toBe(0)
        const [sql, params] = mockQuery.mock.calls[0]
        expect(sql).not.toContain('id <> $2')
        expect(params).toEqual(['mmoomm_world'])
    })
})
