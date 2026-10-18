import { ComponentDefinitionDataType } from '@universo-react/types'
import { createService, metahubId, objectCollectionId, recordId } from './MetahubRecordsService.testSupport'

describe('MetahubRecordsService design-time record integrity', () => {
    describe('sibling TABLE row references', () => {
        const siblingComponents = [
            {
                id: 'blocks-table',
                codename: 'Blocks',
                dataType: ComponentDefinitionDataType.TABLE,
                isRequired: false,
                parentComponentId: null,
                validationRules: {}
            },
            {
                id: 'block-key',
                codename: 'BlockKey',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                parentComponentId: 'blocks-table',
                uiConfig: { generateUuidV7: true, siblingRowSelectKey: true },
                validationRules: {}
            },
            {
                id: 'block-title',
                codename: 'Title',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                parentComponentId: 'blocks-table',
                validationRules: {}
            },
            {
                id: 'questions-table',
                codename: 'Questions',
                dataType: ComponentDefinitionDataType.TABLE,
                isRequired: false,
                parentComponentId: null,
                validationRules: {}
            },
            {
                id: 'question-prompt',
                codename: 'Prompt',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: true,
                parentComponentId: 'questions-table',
                validationRules: {}
            },
            {
                id: 'question-block-key',
                codename: 'BlockKey',
                dataType: ComponentDefinitionDataType.STRING,
                isRequired: false,
                parentComponentId: 'questions-table',
                uiConfig: {
                    siblingRowSelect: {
                        tableCodename: 'Blocks',
                        valueFieldCodename: 'BlockKey',
                        labelFieldCodename: 'Title',
                        requiredWithRows: true
                    }
                },
                validationRules: {}
            }
        ]
        const validBlockKey = '018f8a78-7b8f-7c1d-a111-222233334563'
        const validData = {
            Blocks: [{ BlockKey: validBlockKey, Title: 'Block One' }],
            Questions: [{ Prompt: 'Question?', BlockKey: validBlockKey }]
        }

        it('creates a record when each sibling selector resolves to a unique semantic key', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const createdRow = { id: 'record-new', object_id: objectCollectionId, data: validData, sort_order: 1, _upl_version: 1 }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO')) return [createdRow]
                if (sql.includes('SELECT id, sort_order')) return []
                if (sql.includes('SELECT * FROM')) return [createdRow]
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: validData }, 'user-1')).resolves.toMatchObject({
                id: 'record-new',
                data: validData
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(true)
        })

        it('rejects a sibling selector value that does not exist in the target table', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const missingBlockKey = '018f8a78-7b8f-7c1d-a111-222233334564'
            const invalidData = { ...validData, Questions: [{ Prompt: 'Question?', BlockKey: missingBlockKey }] }

            await expect(service.create(metahubId, objectCollectionId, { data: invalidData }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_REF_TARGET_MISSING',
                statusCode: 400,
                details: { keyField: 'BlockKey', keyValue: missingBlockKey }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('rejects duplicate target keys even when those groups have no source rows', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const data = {
                Blocks: [
                    { BlockKey: validBlockKey, Title: 'Block One' },
                    { BlockKey: validBlockKey, Title: 'Duplicate block' }
                ],
                Questions: []
            }

            await expect(service.create(metahubId, objectCollectionId, { data }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_SIBLING_TARGET_KEY_DUPLICATE',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'duplicate_target_key' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('compares generated UUIDv7 sibling keys without case sensitivity', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const duplicateData = {
                Blocks: [
                    { BlockKey: validBlockKey, Title: 'Block One' },
                    { BlockKey: validBlockKey.toUpperCase(), Title: 'Duplicate block' }
                ],
                Questions: []
            }

            await expect(service.create(metahubId, objectCollectionId, { data: duplicateData }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_SIBLING_TARGET_KEY_DUPLICATE',
                details: { componentCodename: 'BlockKey', reason: 'duplicate_target_key' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('resolves generated UUIDv7 sibling references regardless of hexadecimal case', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const caseVariantData = {
                ...validData,
                Questions: [{ Prompt: 'Question?', BlockKey: validBlockKey.toUpperCase() }]
            }
            const createdRow = { id: 'record-new', object_id: objectCollectionId, data: caseVariantData, sort_order: 1, _upl_version: 1 }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO')) return [createdRow]
                if (sql.includes('SELECT id, sort_order')) return []
                if (sql.includes('SELECT * FROM')) return [createdRow]
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: caseVariantData }, 'user-1')).resolves.toMatchObject({
                id: 'record-new'
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(true)
        })

        it('rejects a parent save when a required target row has no source row', async () => {
            const strictComponents = siblingComponents.map((component) =>
                component.id === 'question-block-key'
                    ? {
                          ...component,
                          uiConfig: {
                              siblingRowSelect: {
                                  tableCodename: 'Blocks',
                                  valueFieldCodename: 'BlockKey',
                                  labelFieldCodename: 'Title',
                                  requiredWithRows: true,
                                  requireEachTargetReferenced: true
                              }
                          }
                      }
                    : component
            )
            const { executor, service } = createService({ components: strictComponents })
            const validBlockKey = '018f8a78-7b8f-7c1d-a111-222233334563'
            const unreferencedBlockKey = '018f8a78-7b8f-7c1d-a111-222233334564'
            const data = {
                Blocks: [
                    { BlockKey: validBlockKey, Title: 'Block One' },
                    { BlockKey: unreferencedBlockKey, Title: 'Block Two' }
                ],
                Questions: [{ Prompt: 'Question?', BlockKey: validBlockKey }]
            }

            await expect(service.create(metahubId, objectCollectionId, { data }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_SIBLING_TARGET_UNREFERENCED',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'unreferenced_target' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('validates every required target even when the source TABLE is omitted', async () => {
            const strictComponents = siblingComponents.map((component) =>
                component.id === 'question-block-key'
                    ? {
                          ...component,
                          uiConfig: {
                              siblingRowSelect: {
                                  tableCodename: 'Blocks',
                                  valueFieldCodename: 'BlockKey',
                                  labelFieldCodename: 'Title',
                                  requiredWithRows: true,
                                  requireEachTargetReferenced: true
                              }
                          }
                      }
                    : component
            )
            const { executor, service } = createService({ components: strictComponents })
            const data = { Blocks: [{ BlockKey: validBlockKey, Title: 'Block One' }] }

            await expect(service.create(metahubId, objectCollectionId, { data }, 'user-1')).rejects.toMatchObject({
                code: 'RECORD_SIBLING_TARGET_UNREFERENCED',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'unreferenced_target' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('allows an empty selector when requiredWithRows is explicitly disabled', async () => {
            const optionalComponents = siblingComponents.map((component) =>
                component.id === 'question-block-key'
                    ? {
                          ...component,
                          uiConfig: {
                              siblingRowSelect: {
                                  tableCodename: 'Blocks',
                                  valueFieldCodename: 'BlockKey',
                                  labelFieldCodename: 'Title',
                                  requiredWithRows: false
                              }
                          }
                      }
                    : component
            )
            const optionalData = { ...validData, Questions: [{ Prompt: 'Optional group?', BlockKey: null }] }
            const { executor, service } = createService({ components: optionalComponents })
            const createdRow = { id: 'record-optional', object_id: objectCollectionId, data: optionalData, sort_order: 1, _upl_version: 1 }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO')) return [createdRow]
                if (sql.includes('SELECT id, sort_order')) return []
                if (sql.includes('SELECT * FROM')) return [createdRow]
                return []
            })

            await expect(service.create(metahubId, objectCollectionId, { data: optionalData }, 'user-1')).resolves.toMatchObject({
                id: 'record-optional',
                data: optionalData
            })
        })

        it('requires question block membership when blocks exist and accepts an unblocked flat quiz', async () => {
            const blocked = createService({ components: siblingComponents })
            const invalidData = { ...validData, Questions: [{ Prompt: 'Question?', BlockKey: null }] }

            await expect(blocked.service.create(metahubId, objectCollectionId, { data: invalidData }, 'user-1')).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'required_with_targets' }
            })
            expect((blocked.executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)

            const flat = createService({ components: siblingComponents })
            const flatData = { Blocks: [], Questions: [{ Prompt: 'Flat question?', BlockKey: null }] }
            const createdRow = { id: 'record-flat', object_id: objectCollectionId, data: flatData, sort_order: 1, _upl_version: 1 }
            ;(flat.executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT MAX(sort_order)')) return [{ max: 0 }]
                if (sql.includes('INSERT INTO')) return [createdRow]
                if (sql.includes('SELECT id, sort_order')) return []
                if (sql.includes('SELECT * FROM')) return [createdRow]
                return []
            })

            await expect(flat.service.create(metahubId, objectCollectionId, { data: flatData }, 'user-1')).resolves.toMatchObject({
                id: 'record-flat',
                data: flatData
            })
        })

        it('rejects a non-UUID-v7 key when the selector target metadata generates UUID v7 values', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const invalidData = { ...validData, Blocks: [{ BlockKey: 'block-one', Title: 'Block One' }] }

            await expect(service.create(metahubId, objectCollectionId, { data: invalidData }, 'user-1')).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'invalid_target_key' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it.each([
            ['missing sibling table', { tableCodename: 'Missing', valueFieldCodename: 'BlockKey', labelFieldCodename: 'Title' }],
            ['missing semantic key field', { tableCodename: 'Blocks', valueFieldCodename: 'Missing', labelFieldCodename: 'Title' }],
            ['missing label field', { tableCodename: 'Blocks', valueFieldCodename: 'BlockKey', labelFieldCodename: 'Missing' }]
        ])('rejects invalid selector metadata (%s) before insertion', async (_label, siblingRowSelect) => {
            const invalidComponents = siblingComponents.map((component) =>
                component.id === 'question-block-key' ? { ...component, uiConfig: { siblingRowSelect } } : component
            )
            const { executor, service } = createService({ components: invalidComponents })

            await expect(service.create(metahubId, objectCollectionId, { data: validData }, 'user-1')).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('rejects an invalid semantic-key field type even when the payload contains string values', async () => {
            const invalidComponents = siblingComponents.map((component) =>
                component.id === 'block-key' ? { ...component, validationRules: { localized: true } } : component
            )
            const { executor, service } = createService({ components: invalidComponents })

            await expect(service.create(metahubId, objectCollectionId, { data: validData }, 'user-1')).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'invalid_target_value_field' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        })

        it('rejects updates when the configured target field no longer exists', async () => {
            const invalidComponents = siblingComponents.map((component) =>
                component.id === 'question-block-key'
                    ? {
                          ...component,
                          uiConfig: {
                              siblingRowSelect: {
                                  tableCodename: 'Blocks',
                                  valueFieldCodename: 'Missing',
                                  labelFieldCodename: 'Title'
                              }
                          }
                      }
                    : component
            )
            const { executor, service } = createService({ components: invalidComponents })
            const existingRow = {
                id: recordId,
                object_id: objectCollectionId,
                data: validData,
                sort_order: 1,
                _upl_version: 1
            }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT * FROM') || sql.includes('FOR UPDATE')) return [existingRow]
                return []
            })

            await expect(
                service.update(
                    metahubId,
                    objectCollectionId,
                    recordId,
                    { data: { Questions: validData.Questions }, expectedVersion: 1 },
                    'user-1'
                )
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                details: { componentCodename: 'BlockKey', reason: 'invalid_target_field' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).trimStart().startsWith('UPDATE'))).toBe(false)
        })

        it('rejects removing a block while question rows still reference its semantic key', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const existingRow = {
                id: recordId,
                object_id: objectCollectionId,
                data: validData,
                sort_order: 1,
                _upl_version: 1
            }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT * FROM') || sql.includes('FOR UPDATE')) return [existingRow]
                return []
            })

            await expect(
                service.update(metahubId, objectCollectionId, recordId, { data: { Blocks: [] }, expectedVersion: 1 }, 'user-1')
            ).rejects.toMatchObject({
                code: 'RECORD_REFERENCED',
                statusCode: 409,
                details: { componentCodename: 'BlockKey' }
            })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).trimStart().startsWith('UPDATE'))).toBe(false)
        })

        it('allows an atomic update that removes both the block and its referring question', async () => {
            const { executor, service } = createService({ components: siblingComponents })
            const existingRow = {
                id: recordId,
                object_id: objectCollectionId,
                data: validData,
                sort_order: 1,
                _upl_version: 1
            }
            const updatedRow = { ...existingRow, data: { Blocks: [], Questions: [] }, _upl_version: 2 }
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.trimStart().startsWith('UPDATE')) return [updatedRow]
                if (sql.includes('SELECT * FROM') || sql.includes('FOR UPDATE')) return [existingRow]
                return []
            })

            await expect(
                service.update(
                    metahubId,
                    objectCollectionId,
                    recordId,
                    { data: { Blocks: [], Questions: [] }, expectedVersion: 1 },
                    'user-1'
                )
            ).resolves.toMatchObject({ data: { Blocks: [], Questions: [] }, version: 2 })
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).trimStart().startsWith('UPDATE'))).toBe(true)
        })

        it('deletes the owning record as one unit when it contains sibling tables', async () => {
            const { executor, service } = createService({ components: siblingComponents, allComponents: siblingComponents })
            ;(executor.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('SELECT id, data FROM')) return [{ id: recordId, data: validData }]
                if (sql.includes('SET _upl_deleted = true')) return [{ id: recordId }]
                if (sql.includes('SELECT id, sort_order')) return []
                return []
            })

            await expect(service.delete(metahubId, objectCollectionId, recordId, 'user-1')).resolves.toBeUndefined()
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('SET _upl_deleted = true'))).toBe(true)
            expect((executor.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('e.data ->>'))).toBe(false)
        })
    })
})
