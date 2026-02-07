import type { Knex } from 'knex'
import { SchemaCloner, cloneSchemaWithExecutor } from '../SchemaCloner'

const SOURCE_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
const TARGET_SCHEMA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b2'

describe('SchemaCloner', () => {
    it('keeps PostgreSQL-style placeholders for generic executor usage', async () => {
        const calls: Array<{ sql: string; params: unknown[] }> = []

        await cloneSchemaWithExecutor(
            {
                query: async <T>(sql: string, params: unknown[] = []) => {
                    calls.push({ sql, params })

                    if (sql.includes('information_schema.tables')) {
                        return [] as T[]
                    }

                    if (sql.includes("con.contype = 'f'")) {
                        return [] as T[]
                    }

                    return [] as T[]
                }
            },
            {
                sourceSchema: SOURCE_SCHEMA,
                targetSchema: TARGET_SCHEMA,
                dropTargetSchemaIfExists: true,
                createTargetSchema: true,
                copyData: true
            }
        )

        const tablesCall = calls.find((call) => call.sql.includes('information_schema.tables'))
        expect(tablesCall).toBeDefined()
        expect(tablesCall?.sql).toContain('$1')
        expect(tablesCall?.params).toEqual([SOURCE_SCHEMA])
    })

    it('maps PostgreSQL placeholders to knex positional bindings for raw execution', async () => {
        const raw = jest.fn(async (sql: string, _params: unknown[] = []) => {
            if (sql.includes('information_schema.tables')) {
                return { rows: [{ table_name: 'cat_a1' }] }
            }

            if (sql.includes("con.contype = 'f'")) {
                return {
                    rows: [
                        {
                            table_name: 'cat_a1',
                            constraint_name: 'fk_cat_a1_parent',
                            constraint_definition: `FOREIGN KEY (parent_id) REFERENCES "${SOURCE_SCHEMA}"."cat_a1"(id)`
                        }
                    ]
                }
            }

            if (sql.includes('SELECT EXISTS')) {
                return { rows: [{ exists: false }] }
            }

            return { rows: [] }
        })

        const cloner = new SchemaCloner({ raw } as unknown as Knex)
        await cloner.clone({
            sourceSchema: SOURCE_SCHEMA,
            targetSchema: TARGET_SCHEMA,
            dropTargetSchemaIfExists: true,
            createTargetSchema: true,
            copyData: true
        })

        const tablesCall = raw.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('information_schema.tables'))
        expect(tablesCall).toBeDefined()
        expect(tablesCall?.[0]).toContain('?')
        expect(tablesCall?.[0]).not.toContain('$1')
        expect(tablesCall?.[1]).toEqual([SOURCE_SCHEMA])

        const existsCall = raw.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('SELECT EXISTS'))
        expect(existsCall).toBeDefined()
        expect(existsCall?.[0]).toContain('?')
        expect(existsCall?.[0]).not.toContain('$1')
        expect(existsCall?.[1]).toEqual([TARGET_SCHEMA, 'cat_a1', 'fk_cat_a1_parent'])

        const hasRewrittenReference = raw.mock.calls.some(
            ([sql]) => typeof sql === 'string' && sql.includes(`REFERENCES "${TARGET_SCHEMA}".`)
        )
        expect(hasRewrittenReference).toBe(true)
    })

    it('rewrites unquoted schema-qualified FK references without producing nested schema prefixes', async () => {
        const raw = jest.fn(async (sql: string, _params: unknown[] = []) => {
            if (sql.includes('information_schema.tables')) {
                return { rows: [{ table_name: '_mhb_attributes' }] }
            }

            if (sql.includes("con.contype = 'f'")) {
                return {
                    rows: [
                        {
                            table_name: '_mhb_attributes',
                            constraint_name: '_mhb_attributes_object_id_foreign',
                            constraint_definition: `FOREIGN KEY (object_id) REFERENCES ${SOURCE_SCHEMA}._mhb_objects(id) ON DELETE CASCADE`
                        }
                    ]
                }
            }

            if (sql.includes('SELECT EXISTS')) {
                return { rows: [{ exists: false }] }
            }

            return { rows: [] }
        })

        const cloner = new SchemaCloner({ raw } as unknown as Knex)
        await cloner.clone({
            sourceSchema: SOURCE_SCHEMA,
            targetSchema: TARGET_SCHEMA,
            dropTargetSchemaIfExists: true,
            createTargetSchema: true,
            copyData: true
        })

        const alterStatement = raw.mock.calls.find(
            ([sql]) => typeof sql === 'string' && sql.includes('ADD CONSTRAINT "_mhb_attributes_object_id_foreign"')
        )?.[0]

        expect(alterStatement).toBeDefined()
        expect(alterStatement).toContain(`REFERENCES "${TARGET_SCHEMA}"._mhb_objects`)
        expect(alterStatement).not.toContain(`"${TARGET_SCHEMA}".${SOURCE_SCHEMA}._mhb_objects`)
    })
})
