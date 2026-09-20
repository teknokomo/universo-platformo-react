import { ComponentDefinitionDataType } from '@universo-react/types'
import { MetahubRecordsService } from '../../domains/metahubs/services/MetahubRecordsService'
import { MetahubValidationError } from '../../domains/shared/domainErrors'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('MetahubRecordsService design-time record integrity', () => {
    const metahubId = '018f8a78-7b8f-7c1d-a111-222233334560'
    const objectCollectionId = '018f8a78-7b8f-7c1d-a111-222233334561'
    const schemaName = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
    const recordId = '018f8a78-7b8f-7c1d-a111-222233334562'

    const tierComponents = [
        {
            id: 'tier-key-component',
            codename: 'TierKey',
            dataType: ComponentDefinitionDataType.STRING,
            isRequired: false,
            parentComponentId: null,
            validationRules: { maxLength: 64, unique: true }
        },
        {
            id: 'tier-title-component',
            codename: 'Title',
            dataType: ComponentDefinitionDataType.STRING,
            isRequired: false,
            parentComponentId: null,
            validationRules: { maxLength: 255 }
        }
    ]

    const createService = (overrides: { components?: unknown[]; allComponents?: unknown[] } = {}) => {
        const executor = createMockDbExecutor()
        const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
        const objectsService = { findById: jest.fn().mockResolvedValue({ id: objectCollectionId }) }
        const componentsService = {
            findAllFlat: jest.fn().mockResolvedValue(overrides.components ?? tierComponents),
            getAllComponents: jest.fn().mockResolvedValue(overrides.allComponents ?? [])
        }
        const service = new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)

        return { executor, service }
    }

    it('canonicalizes hex table child values before inserting the serialized design-time record', async () => {
        const executor = createMockDbExecutor()
        const schemaService = { ensureSchema: jest.fn().mockResolvedValue(schemaName) }
        const objectsService = { findById: jest.fn().mockResolvedValue({ id: objectCollectionId }) }
        const componentsService = {
            findAllFlat: jest.fn().mockResolvedValue([
                {
                    id: 'matrix-component',
                    codename: 'InterpretationMatrix',
                    dataType: ComponentDefinitionDataType.TABLE,
                    isRequired: false,
                    parentComponentId: null,
                    validationRules: {}
                },
                {
                    id: 'fill-colour-component',
                    codename: 'CellFillColor',
                    dataType: ComponentDefinitionDataType.STRING,
                    isRequired: false,
                    parentComponentId: 'matrix-component',
                    validationRules: { format: 'hexColor', pattern: '[unsafe' }
                }
            ])
        }
        const service = new MetahubRecordsService(executor, schemaService as never, objectsService as never, componentsService as never)
        ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
            if (sql.includes('INSERT INTO'))
                return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
            if (sql.includes('SELECT id, sort_order')) return []
            if (sql.includes('SELECT * FROM')) {
                return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
            }
            return []
        })

        await service.create(metahubId, objectCollectionId, { data: { InterpretationMatrix: [{ CellFillColor: '#abc' }] } }, 'user-1')

        const insertCall = (executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'))
        expect(insertCall?.[1]?.[1]).toBe(JSON.stringify({ InterpretationMatrix: [{ CellFillColor: '#AABBCC' }] }))
    })

    describe('unique semantic keys', () => {
        it('rejects creating a record with a key that already exists in the object', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('e.data ->>')) return [{ id: 'existing-record' }]
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: { TierKey: 'pre-seed' } }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_KEY_DUPLICATE',
                statusCode: 409
            })
        })

        it('allows creating a record with a free key', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('e.data ->>')) return []
                if (sql.includes('INSERT INTO'))
                    return [{ id: 'record-1', object_id: objectCollectionId, data: { TierKey: 'seed' }, sort_order: 1, _upl_version: 1 }]
                if (sql.includes('SELECT * FROM')) {
                    return [{ id: 'record-1', object_id: objectCollectionId, data: { TierKey: 'seed' }, sort_order: 1, _upl_version: 1 }]
                }
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: { TierKey: 'seed' } }, 'user-1')).resolves.toMatchObject({
                id: 'record-1'
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(true)
        })

        it('rejects updating a record to a key that already exists in the object', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FOR UPDATE') || sql.includes('SELECT * FROM')) {
                    return [{ id: recordId, object_id: objectCollectionId, data: { TierKey: 'seed' }, sort_order: 1, _upl_version: 1 }]
                }
                if (sql.includes('SET ')) {
                    return [{ id: recordId, object_id: objectCollectionId, data: { TierKey: 'pre-seed' }, sort_order: 1, _upl_version: 2 }]
                }
                if (sql.includes('e.data ->>')) return [{ id: 'other-record' }]
                return []
            })

            await expect(
                service.update(metahubId, objectCollectionId, recordId, { data: { TierKey: 'pre-seed' } }, 'user-1')
            ).rejects.toMatchObject({ code: 'RECORD_KEY_DUPLICATE' })
            // The conflict is detected before any write: the only UPDATE-like SQL
            // is the version-locking SELECT ... FOR UPDATE.
            expect(
                (executor.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).trimStart().startsWith('UPDATE') || String(sql).includes('_upl_version = _upl_version + 1')
                )
            ).toBe(false)
        })

        it('skips suffix candidates that violate the component pattern and fails closed when none fit', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('AS value')) return [{ value: 'pre-seed' }]
                return []
            })

            await expect(
                service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'pre-seed', 'user-1', {
                    pattern: '^[a-z0-9]+$'
                })
            ).rejects.toBeInstanceOf(MetahubValidationError)

            await expect(
                service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'pre-seed', 'user-1', {
                    pattern: '^[a-z0-9-]+$'
                })
            ).resolves.toBe('pre-seed-copy')
        })

        it('keeps the suggested copy suffix inside the component maxLength', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('AS value')) return [{ value: 'pre-seed-123456' }, { value: 'pre-seed-123-cop' }]
                return []
            })

            await expect(
                service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'pre-seed-123456', 'user-1', {
                    maxLength: 14
                })
            ).resolves.toBe('pre-seed-copy')
            await expect(
                service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'pre-seed', 'user-1', {
                    maxLength: 64
                })
            ).resolves.toBe('pre-seed')
        })

        it('suggests a copy suffix when the key is already taken', async () => {
            const { executor, service } = createService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('AS value')) return [{ value: 'pre-seed' }, { value: 'seed' }]
                return []
            })

            await expect(service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'pre-seed', 'user-1')).resolves.toBe(
                'pre-seed-copy'
            )
            await expect(service.suggestUniqueComponentValue(metahubId, objectCollectionId, 'TierKey', 'growth', 'user-1')).resolves.toBe(
                'growth'
            )
        })
    })

    describe('REF target validation', () => {
        const targetEntityId = '018f8a78-7b8f-7c1d-a111-222233334599'
        const refComponents = [
            {
                id: 'title-component',
                codename: 'Title',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: false,
                parentComponentId: null,
                validationRules: {}
            },
            {
                id: 'tier-ref-component',
                codename: 'TierRef',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: false,
                parentComponentId: null,
                targetEntityId,
                validationRules: {}
            },
            {
                id: 'benefits-table-component',
                codename: 'Benefits',
                dataType: ComponentDefinitionDataType.TABLE,
                isRequired: false,
                parentComponentId: null,
                validationRules: {}
            },
            {
                id: 'benefit-tier-ref-component',
                codename: 'TierRef',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: false,
                parentComponentId: 'benefits-table-component',
                targetEntityId,
                validationRules: {}
            }
        ]

        it('rejects creating a record whose REF points at a missing target record', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('id = ANY(')) return []
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: { TierRef: recordId } }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_REF_TARGET_MISSING',
                statusCode: 400
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('accepts creating a record whose REF targets exist', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('id = ANY(')) return [{ id: recordId }]
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO')) {
                    return [
                        { id: 'record-new', object_id: objectCollectionId, data: { TierRef: recordId }, sort_order: 1, _upl_version: 1 }
                    ]
                }
                if (sql.includes('SELECT * FROM')) {
                    return [
                        { id: 'record-new', object_id: objectCollectionId, data: { TierRef: recordId }, sort_order: 1, _upl_version: 1 }
                    ]
                }
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: { TierRef: recordId } }, 'user-1')).resolves.toMatchObject({
                id: 'record-new'
            })

            const probe = (executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('id = ANY('))
            expect(probe?.[1]).toEqual([targetEntityId, [recordId]])
            // The existence probe holds the referenced rows with FOR KEY SHARE
            // so a concurrent delete of a target serializes against this write.
            expect(String(probe?.[0])).toContain('FOR KEY SHARE')
        })

        it('rejects updating a record when the REF target disappeared', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FOR UPDATE') || sql.includes('SELECT * FROM')) {
                    return [{ id: recordId, object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
                }
                if (sql.includes('SET ')) {
                    return [{ id: recordId, object_id: objectCollectionId, data: { TierRef: recordId }, sort_order: 1, _upl_version: 2 }]
                }
                if (sql.includes('id = ANY(')) return []
                return []
            })

            await expect(
                service.update(metahubId, objectCollectionId, recordId, { data: { TierRef: recordId } }, 'user-1')
            ).rejects.toMatchObject({
                code: 'RECORD_REF_TARGET_MISSING',
                statusCode: 400
            })
        })

        it('rejects a dangling REF inside a TABLE child row', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('id = ANY(')) return []
                return []
            })

            await expect(
                service.create(
                    metahubId,
                    objectCollectionId,
                    { data: { Benefits: [{ TierRef: '018f8a78-7b8f-7c1d-a111-222233334577' }] } },
                    'user-1'
                )
            ).rejects.toMatchObject({ code: 'RECORD_REF_TARGET_MISSING' })
        })

        it('rejects a non-UUID REF format instead of letting PostgreSQL fail', async () => {
            const { executor, service } = createService({ components: refComponents })

            await expect(
                service.create(metahubId, objectCollectionId, { data: { TierRef: 'not-a-uuid' } }, 'user-1')
            ).rejects.toMatchObject({ statusCode: 400 })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('id = ANY('))).toBe(false)
        })

        it('probes only the patched REF fields during updates', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FOR UPDATE') || sql.includes('SELECT * FROM')) {
                    return [
                        {
                            id: recordId,
                            object_id: objectCollectionId,
                            data: { TierRef: '018f8a78-7b8f-7c1d-a111-222233334577' },
                            sort_order: 1,
                            _upl_version: 1
                        }
                    ]
                }
                if (sql.includes('SET ')) {
                    return [
                        {
                            id: recordId,
                            object_id: objectCollectionId,
                            data: { TierRef: '018f8a78-7b8f-7c1d-a111-222233334577', Title: 'Renamed' },
                            sort_order: 1,
                            _upl_version: 2
                        }
                    ]
                }
                if (sql.includes('id = ANY(')) return []
                return []
            })

            await expect(
                service.update(metahubId, objectCollectionId, recordId, { data: { Title: 'Renamed' } }, 'user-1')
            ).resolves.toMatchObject({ data: { Title: 'Renamed' } })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('id = ANY('))).toBe(false)
        })

        it('skips the probe when no REF value is provided', async () => {
            const { executor, service } = createService({ components: refComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO'))
                    return [{ id: 'record-new', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
                if (sql.includes('SELECT * FROM')) {
                    return [{ id: 'record-new', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
                }
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: {} }, 'user-1')).resolves.toBeDefined()
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('id = ANY('))).toBe(false)
        })
    })

    describe('record reorder synchronizes the SortOrder component', () => {
        const reorderComponents = [
            {
                id: 'sort-order-component',
                codename: 'SortOrder',
                dataType: ComponentDefinitionDataType.NUMBER,
                isRequired: false,
                parentComponentId: null,
                validationRules: { min: 0, max: 100 }
            }
        ]

        const createReorderService = () => createService({ components: reorderComponents })

        it('mirrors the row order into data.SortOrder for both move and reorder flows', async () => {
            const { executor, service } = createReorderService()
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT * FROM') && sql.includes('LIMIT 1')) {
                    return [
                        {
                            id: recordId,
                            object_id: objectCollectionId,
                            data: { SortOrder: 1 },
                            sort_order: 1,
                            _upl_version: 1
                        }
                    ]
                }
                if (sql.includes('COUNT(id)')) return [{ count: 2 }]
                if (sql.includes('ORDER BY sort_order')) return []
                return []
            })

            await service.moveRecord(metahubId, objectCollectionId, recordId, 'down', 'user-1')
            await service.reorderRecord(metahubId, objectCollectionId, recordId, 2, 'user-1')

            const syncCalls = (executor.query as jest.Mock).mock.calls.filter(([sql]) =>
                String(sql).includes("jsonb_set(data, ARRAY['SortOrder']")
            )
            expect(syncCalls).toHaveLength(2)
            for (const [sql] of syncCalls) {
                expect(String(sql)).toContain("jsonb_exists(data, 'SortOrder')")
                expect(String(sql)).toContain('object_id = $1')
                // Rewriting the SortOrder JSON must invalidate optimistic
                // readers that still hold the pre-reorder version.
                expect(String(sql)).toContain('_upl_version = COALESCE(_upl_version, 1) + 1')
            }
        })
    })

    describe('referenced record delete guard', () => {
        const owningObjectId = '018f8a78-7b8f-7c1d-a111-222233334590'
        const referencingComponents = [
            {
                id: 'benefit-tier-ref-component',
                codename: 'TierRef',
                dataType: ComponentDefinitionDataType.REF,
                isRequired: true,
                parentComponentId: null,
                objectCollectionId: owningObjectId,
                targetEntityId: objectCollectionId,
                validationRules: {}
            }
        ]

        it('refuses to delete a record that other records reference', async () => {
            const { executor, service } = createService({ allComponents: referencingComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT id FROM') && sql.includes('_mhb_elements')) return [{ id: recordId }]
                if (sql.includes('e.data ->>')) return [{ id: 'benefit-1' }]
                return []
            })

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_REFERENCED',
                statusCode: 409
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('SET _upl_deleted = true'))).toBe(false)
        })

        it('deletes an unreferenced record with the object scope in the predicate', async () => {
            const { executor, service } = createService({ allComponents: referencingComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT id FROM') && sql.includes('_mhb_elements')) return [{ id: recordId }]
                if (sql.includes('e.data ->>')) return []
                if (sql.includes('SET _upl_deleted = true')) return [{ id: recordId }]
                if (sql.includes('SELECT id, sort_order')) return []
                return []
            })

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).resolves.toBeUndefined()
            const deleteCall = (executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('SET _upl_deleted = true'))
            expect(String(deleteCall?.[0])).toContain('object_id = $2')
            expect(deleteCall?.[1]?.[1]).toBe(objectCollectionId)
        })

        it('fails closed when the record does not belong to the object', async () => {
            const { executor, service } = createService({ allComponents: [] })
            ;(executor.query as jest.Mock).mockImplementation(async () => [])

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).rejects.toMatchObject({
                statusCode: 404
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('SET _upl_deleted = true'))).toBe(false)
        })

        it('scopes the reference scan to the object that declares the field', async () => {
            const { executor, service } = createService({ allComponents: referencingComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string, params: unknown[]) => {
                if (sql.includes('e.data ->>')) {
                    // Simulate the object scope: the foreign object's same-named
                    // field only matches when the scan is not scoped.
                    return params[3] === owningObjectId ? [] : [{ id: 'foreign-record' }]
                }
                if (sql.includes('SELECT id FROM') && sql.includes('_mhb_elements')) return [{ id: recordId }]
                if (sql.includes('SET _upl_deleted = true')) return [{ id: recordId }]
                if (sql.includes('SELECT id, sort_order')) return []
                return []
            })

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).resolves.toBeUndefined()
            const scan = (executor.query as jest.Mock).mock.calls.find(([sql]) => String(sql).includes('e.data ->>'))
            expect(String(scan?.[0])).toContain('($4::uuid IS NULL OR e.object_id = $4::uuid)')
            expect(scan?.[1]?.[3]).toBe(owningObjectId)
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('SET _upl_deleted = true'))).toBe(true)
        })

        it('locks the target row FOR UPDATE before scanning references', async () => {
            const { executor, service } = createService({ allComponents: [] })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT id FROM') && sql.includes('_mhb_elements')) return [{ id: recordId }]
                if (sql.includes('SET _upl_deleted = true')) return [{ id: recordId }]
                if (sql.includes('SELECT id, sort_order')) return []
                return []
            })

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).resolves.toBeUndefined()
            const lockCall = (executor.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('SELECT id FROM') && String(sql).includes('_mhb_elements')
            )
            expect(String(lockCall?.[0])).toContain('FOR UPDATE')
        })
    })

    describe('pattern validation value bounds', () => {
        const patternComponents = [
            {
                id: 'tier-key-component',
                codename: 'TierKey',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: false,
                parentComponentId: null,
                validationRules: { pattern: '^x+$' }
            }
        ]

        it('accepts a matching value inside the safe regex window', async () => {
            const { executor, service } = createService({ components: patternComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO'))
                    return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
                if (sql.includes('SELECT * FROM')) {
                    return [{ id: 'record-1', object_id: objectCollectionId, data: {}, sort_order: 1, _upl_version: 1 }]
                }
                return []
            })

            await expect(
                service.create(metahubId, objectCollectionId, { data: { TierKey: 'x'.repeat(4096) } }, 'user-1')
            ).resolves.toBeDefined()
        })

        it('fails closed when the value is too long to check against the pattern', async () => {
            const { executor, service } = createService({ components: patternComponents })

            await expect(
                service.create(metahubId, objectCollectionId, { data: { TierKey: 'x'.repeat(4097) } }, 'user-1')
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                message: expect.stringContaining('does not match pattern')
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('fails closed on patterns that are unsafe to execute regardless of value length', async () => {
            const unsafePatternComponents = [
                {
                    ...patternComponents[0],
                    validationRules: { pattern: '^(a+)+$' }
                }
            ]
            const { executor, service } = createService({ components: unsafePatternComponents })

            await expect(
                service.create(metahubId, objectCollectionId, { data: { TierKey: `${'a'.repeat(5000)}b` } }, 'user-1')
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                message: expect.stringContaining('does not match pattern')
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('fails closed on overlapping alternations under an unbounded quantifier', async () => {
            const unsafePatternComponents = [
                {
                    ...patternComponents[0],
                    validationRules: { pattern: '^(a|aa)+$' }
                }
            ]
            const { executor, service } = createService({ components: unsafePatternComponents })

            await expect(
                service.create(metahubId, objectCollectionId, { data: { TierKey: `${'a'.repeat(64)}b` } }, 'user-1')
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                message: expect.stringContaining('does not match pattern')
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })
    })
})
