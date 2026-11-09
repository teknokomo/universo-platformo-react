import type { DbExecutor, SqlQueryable } from '@universo-react/utils'

import { ApplicationThemePresetsService } from '../../services/applicationThemePresetsService'
import { ThemePresetCodenameConflictError } from '../../persistence/themePresetsStore'
import { findFileThemePreset } from '@universo-react/theme'
import { themeTokensSchema } from '@universo-react/types'

const preset = findFileThemePreset('universo-default')!
const validTokens = themeTokensSchema.parse(preset.tokens)

type QueryHandler = (sql: string, params?: unknown[]) => unknown[]

/** Minimal DbExecutor stub: dispatches canned results by SQL substring. */
const createMockExecutor = (handlers: Record<string, QueryHandler>): DbExecutor => {
    const run = (sql: string, params?: unknown[]): unknown[] => {
        for (const [needle, handler] of Object.entries(handlers)) {
            if (sql.includes(needle)) return handler(sql, params)
        }
        return []
    }
    const executor = {
        query: <T>(sql: string, params?: unknown[]): Promise<T[]> => Promise.resolve(run(sql, params) as T[]),
        transaction: async <T>(work: (tx: SqlQueryable) => Promise<T>): Promise<T> => work(executor as unknown as SqlQueryable)
    }
    return executor as unknown as DbExecutor
}

const INSERT = 'INSERT INTO applications.obj_theme_presets'
const COUNT = 'COUNT(*)::int AS count'

describe('ApplicationThemePresetsService.createPreset', () => {
    it('creates a preset, writes the audit row, and returns the record', async () => {
        const auditWrites: unknown[][] = []
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 3 }],
            [INSERT]: () => [
                {
                    id: '0190a9b5-0000-7000-8000-000000000001',
                    applicationId: '0190a9b5-0000-7000-8000-000000000002',
                    codename: 'corp-brand',
                    name: { en: 'Corp' },
                    description: {},
                    tokens: validTokens,
                    basePresetId: null,
                    basePresetCodename: null,
                    schemaVersion: 1,
                    version: 1,
                    archived: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            rel_theme_preset_audits: (_sql: string, params?: unknown[]) => {
                auditWrites.push(params ?? [])
                return [{ id: 'audit-1' }]
            }
        })

        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')
        const created = await service.createPreset(
            '0190a9b5-0000-7000-8000-000000000002',
            { codename: 'corp-brand', name: { en: 'Corp' }, tokens: validTokens },
            'user-1'
        )

        expect(created.codename).toBe('corp-brand')
        expect(auditWrites).toHaveLength(1)
        expect(auditWrites[0]?.[2]).toBe('theme_preset_created')
    })

    it('threads basePresetCodename origin into the INSERT and the audit row (copy-to-application)', async () => {
        const auditWrites: unknown[][] = []
        const insertParams: unknown[] = []
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: (_sql: string, params?: unknown[]) => {
                insertParams.push(...(params ?? []))
                return [
                    {
                        id: '0190a9b5-0000-7000-8000-000000000001',
                        applicationId: '0190a9b5-0000-7000-8000-000000000002',
                        codename: 'layout-copy',
                        name: { en: 'Layout theme copy' },
                        description: {},
                        tokens: validTokens,
                        basePresetId: null,
                        basePresetCodename: 'metahub:0190a9b5-0000-7000-8000-000000000003',
                        schemaVersion: 1,
                        version: 1,
                        archived: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ]
            },
            rel_theme_preset_audits: (_sql: string, params?: unknown[]) => {
                auditWrites.push(params ?? [])
                return [{ id: 'audit-1' }]
            }
        })

        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')
        await service.createPreset(
            '0190a9b5-0000-7000-8000-000000000002',
            {
                codename: 'layout-copy',
                name: { en: 'Layout theme copy' },
                tokens: validTokens,
                basePresetCodename: 'metahub:0190a9b5-0000-7000-8000-000000000003'
            },
            'user-1'
        )

        // The origin rides in the INSERT bind params (the canned row is static)
        // and the audit row is written exactly once.
        expect(insertParams).toContain('metahub:0190a9b5-0000-7000-8000-000000000003')
        expect(auditWrites).toHaveLength(1)
        expect(auditWrites[0]?.[2]).toBe('theme_preset_created')
    })

    it('records both id and codename origin when copying a DB preset', async () => {
        const sourceRecord = {
            id: '0190a9b5-0000-7000-8000-000000000004',
            applicationId: '0190a9b5-0000-7000-8000-000000000002',
            codename: 'source-preset',
            name: { en: 'Source' },
            description: {},
            tokens: validTokens,
            basePresetId: null,
            basePresetCodename: null,
            schemaVersion: 1,
            version: 2,
            archived: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        const insertParams: unknown[] | undefined = []
        const dbExecutor = createMockExecutor({
            'AND p.id = $2': () => [sourceRecord],
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: (_sql: string, params?: unknown[]) => {
                insertParams.push(...(params ?? []))
                return [sourceRecord]
            },
            rel_theme_preset_audits: () => [{ id: 'audit-1' }]
        })
        const service = new ApplicationThemePresetsService(dbExecutor, async () => 'app_schema_x')
        await service.copyPreset('0190a9b5-0000-7000-8000-000000000002', { presetId: sourceRecord.id }, 'user-1')
        // The origin rides in the INSERT bind params; the canned return row is
        // static, so the params are the assertion surface here.
        expect(insertParams).toContain(sourceRecord.id)
        expect(insertParams).toContain('source-preset') // base_preset_codename
        expect(insertParams).toContain('source-preset-copy') // derived copy codename
    })

    it('refuses creation when the scope limit is reached (TZ §13)', async () => {
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 100 }],
            [INSERT]: () => []
        })
        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')

        await expect(
            service.createPreset(
                '0190a9b5-0000-7000-8000-000000000002',
                { codename: 'one-too-many', name: { en: 'X' }, tokens: validTokens },
                'user-1'
            )
        ).rejects.toMatchObject({ code: 'THEME_PRESET_LIMIT_REACHED', statusCode: 409 })
    })

    it('rejects codenames reserved by file presets (FR-048)', async () => {
        const executor = createMockExecutor({ [COUNT]: () => [{ count: 0 }] })
        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')

        await expect(
            service.createPreset(
                '0190a9b5-0000-7000-8000-000000000002',
                { codename: 'universo-default', name: { en: 'Imposter' }, tokens: validTokens },
                'user-1'
            )
        ).rejects.toThrow(/reserved by a built-in file preset/)
    })

    it('translates a unique-index violation into a codename conflict error', async () => {
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: () => {
                const violation = new Error('duplicate key value violates unique constraint')
                ;(violation as { code?: string }).code = '23505'
                throw violation
            }
        })
        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')

        await expect(
            service.createPreset(
                '0190a9b5-0000-7000-8000-000000000002',
                { codename: 'taken', name: { en: 'X' }, tokens: validTokens },
                'user-1'
            )
        ).rejects.toThrow(ThemePresetCodenameConflictError)
    })

    it('blocks text pairs below 4.5:1 before touching the database', async () => {
        const executor = createMockExecutor({ [COUNT]: () => [{ count: 0 }] })
        const service = new ApplicationThemePresetsService(executor, async () => 'app_schema_x')
        const lowContrastTokens = {
            ...validTokens,
            modes: {
                ...validTokens.modes,
                light: {
                    ...validTokens.modes.light,
                    text: { primary: '#959595', secondary: '#9a9a9a' }
                }
            }
        }

        await expect(
            service.createPreset(
                '0190a9b5-0000-7000-8000-000000000002',
                { codename: 'low-contrast', name: { en: 'X' }, tokens: lowContrastTokens },
                'user-1'
            )
        ).rejects.toThrow(/WCAG text contrast/)
    })
})
