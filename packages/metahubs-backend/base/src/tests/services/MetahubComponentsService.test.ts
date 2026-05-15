const mockEnsureSchema = jest.fn()

import { MetahubComponentsService } from '../../domains/metahubs/services/MetahubComponentsService'
import { codenamePrimaryTextSql } from '../../domains/shared/codename'

describe('MetahubComponentsService active-row filtering', () => {
    const schemaService = {
        ensureSchema: mockEnsureSchema
    } as any

    const mockExecQuery = jest.fn()
    const mockExec = {
        query: mockExecQuery,
        transaction: jest.fn(),
        isReleased: () => false
    }

    const service = new MetahubComponentsService(mockExec as any, schemaService)
    const isUpdateStatement = (sql: unknown) => /^\s*UPDATE\b/.test(String(sql))
    const configurablePlatformPolicyRows = [
        { key: 'platformSystemComponentsConfigurable', value: { _value: true } },
        { key: 'platformSystemComponentsRequired', value: { _value: true } },
        { key: 'platformSystemComponentsIgnoreMetahubSettings', value: { _value: false } }
    ]

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockExecQuery.mockResolvedValue([])
        mockExec.transaction.mockImplementation(async (callback: (tx: typeof mockExec) => Promise<unknown>) => callback(mockExec as any))
    })

    it('adds branch active-row predicates to batch count reads', async () => {
        await service.countByObjectIds('metahub-1', ['object-1'], 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][1]).toEqual([['object-1']])
    })

    it('adds branch active-row predicates to child batch reads', async () => {
        await service.findChildComponentsByParentIds('metahub-1', ['parent-1'], 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][1]).toEqual([['parent-1']])
    })

    it('maps child components without losing service context', async () => {
        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'child-1',
                object_id: 'object-1',
                codename: 'childCode',
                presentation: { name: { en: 'Child field' } },
                data_type: 'STRING',
                is_required: false,
                is_display_component: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_component_id: 'parent-1',
                sort_order: 1,
                validation_rules: null,
                ui_config: null,
                is_system: true,
                system_key: 'app.deleted',
                is_system_managed: true,
                is_system_enabled: true,
                _upl_version: 2,
                _upl_created_at: '2026-03-21T00:00:00.000Z',
                _upl_updated_at: '2026-03-21T00:00:00.000Z'
            }
        ])

        const result = await service.findChildComponents('metahub-1', 'parent-1', 'user-1')

        expect(result).toEqual([
            expect.objectContaining({
                id: 'child-1',
                parentComponentId: 'parent-1',
                codename: 'childCode',
                system: expect.objectContaining({
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                })
            })
        ])
    })

    it('adds branch active-row predicates to component lookup by id', async () => {
        await service.findById('metahub-1', 'attr-1', 'user-1')

        expect(mockExecQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['attr-1'])
        expect(mockExecQuery.mock.calls[0][0]).toContain('AND _upl_deleted = false AND _mhb_deleted = false')
    })

    it('uses primary codename text when matching enum value blockers against element data keys', async () => {
        await service.findElementEnumValueBlockers('metahub-1', 'enum-1', 'value-1', 'user-1', ['enumeration', 'custom.option-list'])

        expect(mockExecQuery).toHaveBeenCalled()
        expect(mockExecQuery.mock.calls[0][0]).toContain('cmp.target_object_kind = ANY($3::text[])')
        expect(mockExecQuery.mock.calls[0][0]).toContain(`el.data ->> (${codenamePrimaryTextSql('cmp.codename')}) = $2`)
        expect(mockExecQuery.mock.calls[0][1]).toEqual(['enum-1', 'value-1', ['enumeration', 'custom.option-list']])
    })

    it('matches compatible target kinds when finding reference blockers by target', async () => {
        await service.findReferenceBlockersByTarget('metahub-1', 'enum-1', ['enumeration', 'custom.option-list'], 'user-1')

        expect(mockExecQuery).toHaveBeenCalled()
        expect(mockExecQuery.mock.calls[0][0]).toContain('cmp.target_object_kind = ANY($2::text[])')
        expect(mockExecQuery.mock.calls[0][1]).toEqual(['enum-1', ['enumeration', 'custom.option-list']])
    })

    it('matches compatible enumeration target kinds when finding default enum value blockers', async () => {
        await service.findDefaultEnumValueBlockers('metahub-1', 'value-1', 'user-1', ['enumeration', 'custom.option-list'])

        expect(mockExecQuery).toHaveBeenCalled()
        expect(mockExecQuery.mock.calls[0][0]).toContain('cmp.target_object_kind = ANY($2::text[])')
        expect(mockExecQuery.mock.calls[0][1]).toEqual(['value-1', ['enumeration', 'custom.option-list']])
    })

    it('adds branch active-row predicates to getAllComponents reads', async () => {
        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'attr-1',
                object_id: 'object-1',
                codename: 'name',
                presentation: { name: { en: 'Name' } },
                data_type: 'STRING',
                is_required: true,
                is_display_component: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_component_id: null,
                sort_order: 1,
                validation_rules: null,
                ui_config: null,
                _upl_version: 1,
                _upl_created_at: '2026-03-13T00:00:00.000Z',
                _upl_updated_at: '2026-03-13T00:00:00.000Z'
            }
        ])

        const result = await service.getAllComponents('metahub-1', 'user-1')

        expect(mockExecQuery.mock.calls[0][0]).toContain('_upl_deleted = false AND _mhb_deleted = false')
        expect(mockExecQuery.mock.calls[0][0]).toContain('ORDER BY sort_order ASC')
        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'attr-1',
                    objectCollectionId: 'object-1',
                    codename: 'name'
                })
            ])
        )
    })

    it('preserves localized codename payloads for snapshot-oriented component reads', async () => {
        const localizedCodename = {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: { content: 'title', version: 1, isActive: true },
                ru: { content: 'название', version: 1, isActive: true }
            }
        }

        mockExecQuery.mockResolvedValueOnce([
            {
                id: 'attr-1',
                object_id: 'object-1',
                codename: localizedCodename,
                presentation: { name: { en: 'Title' } },
                data_type: 'STRING',
                is_required: true,
                is_display_component: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_component_id: null,
                sort_order: 1,
                validation_rules: null,
                ui_config: null,
                _upl_version: 1,
                _upl_created_at: '2026-03-13T00:00:00.000Z',
                _upl_updated_at: '2026-03-13T00:00:00.000Z'
            }
        ])

        const result = await service.findAllFlatForSnapshot('metahub-1', 'object-1', 'user-1', 'all')

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'attr-1',
                    objectCollectionId: 'object-1',
                    codename: localizedCodename
                })
            ])
        )
    })

    it('rejects reserved managed-system codenames for business components', async () => {
        await expect(
            service.create('metahub-1', {
                objectCollectionId: 'object-1',
                codename: '_app_deleted',
                dataType: 'STRING',
                name: { version: 1, locales: { en: { content: 'Business field' } } },
                validationRules: {},
                uiConfig: {}
            })
        ).rejects.toThrow('Codename _app_deleted is reserved for managed system components')

        expect(mockExecQuery).not.toHaveBeenCalled()
    })

    it('rejects platform system toggles when global platform defaults are enforced', async () => {
        const platformField = {
            id: 'attr-upl-deleted',
            object_id: 'object-1',
            codename: '_upl_deleted',
            presentation: { name: { en: 'Deleted' } },
            data_type: 'BOOLEAN',
            is_required: false,
            is_display_component: false,
            target_object_id: null,
            target_object_kind: null,
            target_constant_id: null,
            parent_component_id: null,
            sort_order: 1,
            validation_rules: {},
            ui_config: {},
            is_system: true,
            system_key: 'upl.deleted',
            is_system_managed: true,
            is_system_enabled: true,
            _upl_version: 3,
            _upl_created_at: '2026-03-16T00:00:00.000Z',
            _upl_updated_at: '2026-03-16T00:00:00.000Z'
        }

        mockExecQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM admin.cfg_settings')) {
                return [
                    { key: 'platformSystemComponentsConfigurable', value: { _value: false } },
                    { key: 'platformSystemComponentsRequired', value: { _value: true } },
                    { key: 'platformSystemComponentsIgnoreMetahubSettings', value: { _value: true } }
                ]
            }
            if (sql.includes('WHERE id = $1') && sql.includes('LIMIT 1')) {
                return [platformField]
            }
            return []
        })

        await expect(service.update('metahub-1', 'attr-upl-deleted', { isEnabled: false }, 'user-1')).rejects.toThrow(
            'Platform system component upl.deleted cannot be changed while platform system component configuration is disabled'
        )

        expect(mockExecQuery.mock.calls.some((call) => isUpdateStatement(call[0]))).toBe(false)
    })

    it('rejects disabling a platform root system component while dependent components remain enabled', async () => {
        const protectedField = {
            id: 'attr-upl-deleted',
            object_id: 'object-1',
            codename: '_upl_deleted',
            presentation: { name: { en: 'Deleted' } },
            data_type: 'BOOLEAN',
            is_required: false,
            is_display_component: false,
            target_object_id: null,
            target_object_kind: null,
            target_constant_id: null,
            parent_component_id: null,
            sort_order: 1,
            validation_rules: {},
            ui_config: {},
            is_system: true,
            system_key: 'upl.deleted',
            is_system_managed: true,
            is_system_enabled: true,
            _upl_version: 3,
            _upl_created_at: '2026-03-16T00:00:00.000Z',
            _upl_updated_at: '2026-03-16T00:00:00.000Z'
        }

        mockExecQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM admin.cfg_settings')) {
                return configurablePlatformPolicyRows
            }
            if (sql.includes('WHERE id = $1') && sql.includes('LIMIT 1')) {
                return [protectedField]
            }
            if (sql.includes('WHERE id = $1') && sql.includes('FOR UPDATE')) {
                return [protectedField]
            }
            if (sql.includes('WHERE object_id = $1 AND is_system = true')) {
                return [protectedField]
            }
            return []
        })

        await expect(service.update('metahub-1', 'attr-upl-deleted', { isEnabled: false }, 'user-1')).rejects.toThrow(
            'System field upl.deleted_at requires upl.deleted; System field upl.deleted_by requires upl.deleted'
        )

        expect(mockExecQuery.mock.calls.some((call) => isUpdateStatement(call[0]))).toBe(false)
    })

    it('cascades dependent system fields when soft-delete root flag is disabled', async () => {
        const rows = new Map<string, Record<string, unknown>>([
            [
                'attr-app-deleted',
                {
                    id: 'attr-app-deleted',
                    object_id: 'object-1',
                    codename: '_app_deleted',
                    presentation: { name: { en: 'Deleted' } },
                    data_type: 'BOOLEAN',
                    is_required: false,
                    is_display_component: false,
                    target_object_id: null,
                    target_object_kind: null,
                    target_constant_id: null,
                    parent_component_id: null,
                    sort_order: 1,
                    validation_rules: {},
                    ui_config: {},
                    is_system: true,
                    system_key: 'app.deleted',
                    is_system_managed: true,
                    is_system_enabled: true,
                    _upl_version: 4,
                    _upl_created_at: '2026-03-16T00:00:00.000Z',
                    _upl_updated_at: '2026-03-16T00:00:00.000Z'
                }
            ],
            [
                'attr-app-deleted-at',
                {
                    id: 'attr-app-deleted-at',
                    object_id: 'object-1',
                    codename: '_app_deleted_at',
                    presentation: { name: { en: 'Deleted at' } },
                    data_type: 'DATE',
                    is_required: false,
                    is_display_component: false,
                    target_object_id: null,
                    target_object_kind: null,
                    target_constant_id: null,
                    parent_component_id: null,
                    sort_order: 2,
                    validation_rules: {},
                    ui_config: {},
                    is_system: true,
                    system_key: 'app.deleted_at',
                    is_system_managed: true,
                    is_system_enabled: true,
                    _upl_version: 2,
                    _upl_created_at: '2026-03-16T00:00:00.000Z',
                    _upl_updated_at: '2026-03-16T00:00:00.000Z'
                }
            ],
            [
                'attr-app-deleted-by',
                {
                    id: 'attr-app-deleted-by',
                    object_id: 'object-1',
                    codename: '_app_deleted_by',
                    presentation: { name: { en: 'Deleted by' } },
                    data_type: 'STRING',
                    is_required: false,
                    is_display_component: false,
                    target_object_id: null,
                    target_object_kind: null,
                    target_constant_id: null,
                    parent_component_id: null,
                    sort_order: 3,
                    validation_rules: {},
                    ui_config: {},
                    is_system: true,
                    system_key: 'app.deleted_by',
                    is_system_managed: true,
                    is_system_enabled: true,
                    _upl_version: 2,
                    _upl_created_at: '2026-03-16T00:00:00.000Z',
                    _upl_updated_at: '2026-03-16T00:00:00.000Z'
                }
            ]
        ])

        mockExecQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('WHERE id = $1') && sql.includes('LIMIT 1')) {
                return [rows.get(String(params?.[0]))]
            }
            if (sql.includes('WHERE id = $1') && sql.includes('FOR UPDATE')) {
                return [rows.get(String(params?.[0]))]
            }
            if (sql.includes('WHERE object_id = $1 AND is_system = true')) {
                return Array.from(rows.values())
            }
            if (sql.includes('UPDATE') && sql.includes('RETURNING *')) {
                const rowId = String(params?.[params.length - 1])
                const currentRow = rows.get(rowId)
                if (!currentRow) return []
                const nextRow = {
                    ...currentRow,
                    _upl_version: Number(currentRow._upl_version ?? 1) + 1,
                    _upl_updated_at: params?.[0],
                    _upl_updated_by: params?.[1] ?? null,
                    ...(params?.length === 4 ? { is_system_enabled: params?.[2] } : {})
                }
                rows.set(rowId, nextRow)
                return [nextRow]
            }
            return []
        })

        const updated = await service.update('metahub-1', 'attr-app-deleted', { isEnabled: false, updatedBy: 'user-1' }, 'user-1')

        expect(updated?.system?.isEnabled).toBe(false)
        expect(rows.get('attr-app-deleted-at')?.is_system_enabled).toBe(false)
        expect(rows.get('attr-app-deleted-by')?.is_system_enabled).toBe(false)
        expect(mockExecQuery.mock.calls.filter((call) => isUpdateStatement(call[0])).length).toBe(3)
    })

    it('seeds disabled system-field states when explicit object states are provided', async () => {
        mockExecQuery.mockImplementation(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('WHERE object_id = $1 AND is_system = true')) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return []
            }
            return []
        })

        await service.ensureObjectSystemComponents('metahub-1', 'object-1', 'user-1', undefined, [{ key: 'app.deleted', enabled: false }])

        const deletedInsertCall = mockExecQuery.mock.calls.find(
            (call) => String(call[0]).includes('INSERT INTO') && Array.isArray(call[1]) && call[1][5] === 'app.deleted'
        )

        expect(deletedInsertCall).toBeDefined()
        expect(deletedInsertCall?.[1][6]).toBe(false)
    })

    it('reads system rows back through the provided transaction runner', async () => {
        const trxQuery = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1 AND is_system = true') && !sql.includes('parent_component_id IS NULL')) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return []
            }
            if (sql.includes('parent_component_id IS NULL') && sql.includes('is_system = true')) {
                return [
                    {
                        id: 'attr-app-published',
                        object_id: 'object-1',
                        codename: '_app_published',
                        presentation: { name: { en: 'Published' } },
                        data_type: 'BOOLEAN',
                        is_required: false,
                        is_display_component: false,
                        target_object_id: null,
                        target_object_kind: null,
                        target_constant_id: null,
                        parent_component_id: null,
                        sort_order: 1,
                        validation_rules: {},
                        ui_config: {},
                        is_system: true,
                        system_key: 'app.published',
                        is_system_managed: true,
                        is_system_enabled: true,
                        _upl_version: 1,
                        _upl_created_at: '2026-03-17T00:00:00.000Z',
                        _upl_updated_at: '2026-03-17T00:00:00.000Z'
                    }
                ]
            }
            return []
        })

        mockExecQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('parent_component_id IS NULL') && sql.includes('is_system = true')) {
                throw new Error('Final system-row read should stay on the transaction runner')
            }
            return []
        })

        const result = await service.ensureObjectSystemComponents('metahub-1', 'object-1', 'user-1', { query: trxQuery } as any)

        expect(result).toEqual([
            expect.objectContaining({
                id: 'attr-app-published',
                codename: '_app_published',
                system: expect.objectContaining({
                    isSystem: true,
                    systemKey: 'app.published',
                    isEnabled: true
                })
            })
        ])
        expect(trxQuery).toHaveBeenCalledWith(expect.stringContaining('parent_component_id IS NULL'), ['object-1'])
    })

    it('supports the object-scoped system component adapter with the provided transaction runner', async () => {
        const trxQuery = jest.fn(async (sql: string) => {
            if (sql.includes('WHERE object_id = $1 AND is_system = true') && !sql.includes('parent_component_id IS NULL')) {
                return []
            }
            if (sql.includes('INSERT INTO')) {
                return []
            }
            if (sql.includes('parent_component_id IS NULL') && sql.includes('is_system = true')) {
                return [
                    {
                        id: 'attr-app-published',
                        object_id: 'object-1',
                        codename: '_app_published',
                        presentation: { name: { en: 'Published' } },
                        data_type: 'BOOLEAN',
                        is_required: false,
                        is_display_component: false,
                        target_object_id: null,
                        target_object_kind: null,
                        target_constant_id: null,
                        parent_component_id: null,
                        sort_order: 1,
                        validation_rules: {},
                        ui_config: {},
                        is_system: true,
                        system_key: 'app.published',
                        is_system_managed: true,
                        is_system_enabled: true,
                        _upl_version: 1,
                        _upl_created_at: '2026-03-17T00:00:00.000Z',
                        _upl_updated_at: '2026-03-17T00:00:00.000Z'
                    }
                ]
            }
            return []
        })

        mockExecQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('parent_component_id IS NULL') && sql.includes('is_system = true')) {
                throw new Error('Final system-row read should stay on the transaction runner')
            }
            return []
        })

        const result = await service.ensureObjectSystemComponents('metahub-1', 'object-1', 'user-1', { query: trxQuery } as any)

        expect(result).toEqual([
            expect.objectContaining({
                id: 'attr-app-published',
                codename: '_app_published',
                system: expect.objectContaining({
                    isSystem: true,
                    systemKey: 'app.published',
                    isEnabled: true
                })
            })
        ])
        expect(trxQuery).toHaveBeenCalledWith(expect.stringContaining('parent_component_id IS NULL'), ['object-1'])
    })

    it('keeps legacy object wrappers aligned with object-scoped system component reads', async () => {
        const sharedSystemRow = {
            id: 'attr-app-deleted',
            object_id: 'object-1',
            codename: '_app_deleted',
            presentation: { name: { en: 'Deleted' } },
            data_type: 'BOOLEAN',
            is_required: false,
            is_display_component: false,
            target_object_id: null,
            target_object_kind: null,
            target_constant_id: null,
            parent_component_id: null,
            sort_order: 1,
            validation_rules: {},
            ui_config: {},
            is_system: true,
            system_key: 'app.deleted',
            is_system_managed: true,
            is_system_enabled: true,
            _upl_version: 1,
            _upl_created_at: '2026-04-09T00:00:00.000Z',
            _upl_updated_at: '2026-04-09T00:00:00.000Z'
        }

        mockExecQuery.mockResolvedValue([sharedSystemRow])

        const objectScoped = await service.listObjectSystemComponents('metahub-1', 'object-1', 'user-1')
        const legacyCatalogScoped = await service.listObjectSystemComponents('metahub-1', 'object-1', 'user-1')
        const objectSnapshot = await service.getObjectSystemFieldsSnapshot('metahub-1', 'object-1', 'user-1')
        const legacyCatalogSnapshot = await service.getObjectSystemFieldsSnapshot('metahub-1', 'object-1', 'user-1')

        expect(objectScoped).toEqual(legacyCatalogScoped)
        expect(objectSnapshot).toEqual(legacyCatalogSnapshot)
        expect(objectSnapshot.fields).toEqual(expect.arrayContaining([{ key: 'app.deleted', enabled: true }]))
        expect(objectSnapshot.lifecycleContract).toMatchObject({
            delete: expect.objectContaining({ mode: 'soft' })
        })
        expect(mockExecQuery).toHaveBeenCalledWith(expect.stringContaining('parent_component_id IS NULL'), ['object-1'])
    })
})
