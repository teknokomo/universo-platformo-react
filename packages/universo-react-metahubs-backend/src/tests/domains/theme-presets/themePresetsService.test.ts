import type { DbExecutor, SqlQueryable } from '@universo-react/utils'
import { THEME_PRESET_CODENAME_REGEX, themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset } from '@universo-react/theme'

import { MetahubThemePresetsService } from '../../../domains/theme-presets/themePresetsService'
import {
    ThemePresetCodenameConflictError,
    ThemePresetLimitReachedError,
    findThemePresetUsageLayoutIds
} from '../../../domains/theme-presets/themePresetsStore'
import type { MetahubSchemaService } from '../../../domains/metahubs/services/MetahubSchemaService'

const preset = findFileThemePreset('universo-default')!
const validTokens = themeTokensSchema.parse(preset.tokens)

const metahubId = '0190a9b5-0000-7000-8000-000000000002'
const userId = '0190a9b5-0000-7000-8000-000000000003'

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

const createSchemaServiceStub = (schemaName = 'mhb_schema_x'): MetahubSchemaService =>
    ({ ensureSchema: jest.fn(async () => schemaName) } as unknown as MetahubSchemaService)

/** Mock executor variant that records every SQL string it sees (including inside transactions). */
const createSqlCapturingExecutor = (handlers: Record<string, QueryHandler>): { executor: DbExecutor; sqls: string[] } => {
    const sqls: string[] = []
    const base = createMockExecutor(handlers)
    const executor = {
        query: <T>(sql: string, params?: unknown[]): Promise<T[]> => {
            sqls.push(sql)
            return base.query<T>(sql, params)
        },
        transaction: async <T>(work: (tx: SqlQueryable) => Promise<T>): Promise<T> => work(executor as unknown as SqlQueryable)
    }
    return { executor: executor as unknown as DbExecutor, sqls }
}

const makePresetRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: '0190a9b5-0000-7000-8000-000000000001',
    metahubId,
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
    updatedAt: new Date(),
    ...overrides
})

// Store SQL needles (distinct substrings of the themePresetsStore statements).
const GET_BY_ID = 'AND p.id = $2'
const COUNT = 'COUNT(*)::int AS count'
const INSERT = 'INSERT INTO metahubs.obj_theme_presets'
const AUDIT = 'rel_theme_preset_audits'

// Layout-appearance SQL needles (themePresetsService statements on _mhb_layouts).
const UPDATE_APPEARANCE = 'SET config = jsonb_set'
const RESET_APPEARANCE = "SET config = l.config - 'appearance'"
const READ_APPEARANCE = "SELECT l.config->'appearance' AS appearance"

describe('MetahubThemePresetsService.createPreset', () => {
    it('creates a preset, writes the audit row, and returns the record', async () => {
        const auditWrites: unknown[][] = []
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 3 }],
            [INSERT]: () => [makePresetRecord()],
            [AUDIT]: (_sql: string, params?: unknown[]) => {
                auditWrites.push(params ?? [])
                return [{ id: 'audit-1' }]
            }
        })

        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())
        const created = await service.createPreset(metahubId, { codename: 'corp-brand', name: { en: 'Corp' }, tokens: validTokens }, userId)

        expect(created.codename).toBe('corp-brand')
        expect(auditWrites).toHaveLength(1)
        expect(auditWrites[0]?.[2]).toBe('theme_preset_created')
    })

    it('refuses creation when the metahub scope limit is reached (TZ §13)', async () => {
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 100 }],
            [INSERT]: () => []
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        const rejection = service.createPreset(metahubId, { codename: 'one-too-many', name: { en: 'X' }, tokens: validTokens }, userId)
        await expect(rejection).rejects.toBeInstanceOf(ThemePresetLimitReachedError)
        await expect(rejection).rejects.toMatchObject({ code: 'THEME_PRESET_LIMIT_REACHED', statusCode: 409 })
    })

    it('rejects codenames reserved by file presets (FR-048)', async () => {
        const executor = createMockExecutor({ [COUNT]: () => [{ count: 0 }] })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        await expect(
            service.createPreset(metahubId, { codename: 'universo-default', name: { en: 'Imposter' }, tokens: validTokens }, userId)
        ).rejects.toMatchObject({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: { reason: 'codename-reserved-by-file-preset', codename: 'universo-default' }
        })
    })

    it('translates a unique-index violation (23505) into a codename conflict error', async () => {
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: () => {
                const violation = new Error('duplicate key value violates unique constraint')
                ;(violation as { code?: string }).code = '23505'
                throw violation
            }
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        await expect(
            service.createPreset(metahubId, { codename: 'taken', name: { en: 'X' }, tokens: validTokens }, userId)
        ).rejects.toThrow(ThemePresetCodenameConflictError)
    })

    it('blocks text pairs below 4.5:1 before touching the database', async () => {
        const executor = createMockExecutor({ [COUNT]: () => [{ count: 0 }] })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())
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
        const rejection = service.createPreset(
            metahubId,
            { codename: 'low-contrast', name: { en: 'X' }, tokens: lowContrastTokens },
            userId
        )

        await expect(rejection).rejects.toThrow(/WCAG text contrast/)
        await expect(rejection).rejects.toMatchObject({ statusCode: 422 })
    })
})

describe('MetahubThemePresetsService.copyPreset', () => {
    it('derives a regex-valid truncated `-copy` codename for a near-64-char source codename', async () => {
        const auditWrites: unknown[][] = []
        // Exactly 64 chars: the longest codename the TZ regex accepts.
        const longCodename = `a${'b'.repeat(63)}`
        expect(THEME_PRESET_CODENAME_REGEX.test(longCodename)).toBe(true)

        const executor = createMockExecutor({
            [GET_BY_ID]: () => [makePresetRecord({ codename: longCodename, name: { en: 'Long' }, version: 2 })],
            [COUNT]: () => [{ count: 4 }],
            [INSERT]: (_sql: string, params?: unknown[]) => {
                const [scopeId, codename, nameJson] = params ?? []
                return [
                    makePresetRecord({
                        id: '0190a9b5-0000-7000-8000-000000000004',
                        metahubId: scopeId as string,
                        codename: codename as string,
                        name: JSON.parse(String(nameJson)) as Record<string, string>
                    })
                ]
            },
            [AUDIT]: (_sql: string, params?: unknown[]) => {
                auditWrites.push(params ?? [])
                return [{ id: 'audit-copy' }]
            }
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        const created = await service.copyPreset(metahubId, { presetId: '0190a9b5-0000-7000-8000-000000000001' }, userId)

        // `${source.slice(0, 59)}-copy`: truncated base plus the 5-char suffix, stripping trailing dashes.
        const expectedCodename = `${longCodename.slice(0, 64 - '-copy'.length)}-copy`
        expect(created.codename).toBe(expectedCodename)
        expect(created.codename.endsWith('-copy')).toBe(true)
        expect(created.codename).toHaveLength(64)
        expect(THEME_PRESET_CODENAME_REGEX.test(created.codename)).toBe(true)
        expect(created.name).toEqual({ en: 'Long (copy)' })
        expect(auditWrites).toHaveLength(1)
        expect(auditWrites[0]?.[2]).toBe('theme_preset_copied')
    })

    it('records both id and codename origin when copying a DB preset (twin parity with applications)', async () => {
        const insertParams: unknown[] | undefined = []
        const source = makePresetRecord({ codename: 'source-preset', version: 2 })
        const executor = createMockExecutor({
            [GET_BY_ID]: () => [source],
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: (_sql: string, params?: unknown[]) => {
                insertParams.push(...(params ?? []))
                return [makePresetRecord({ codename: 'source-preset-copy' })]
            },
            [AUDIT]: () => [{ id: 'audit-copy' }]
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        const created = await service.copyPreset(metahubId, { presetId: source.id as string }, userId)

        // Twin parity with the applications copyPreset: DB-source copies carry
        // both the FK and the codename provenance.
        expect(insertParams).toContain(source.id)
        expect(insertParams).toContain('source-preset')
        expect(created.basePresetId).toBeNull() // canned row is static; params are the assertion surface
        expect(created.codename).toBe('source-preset-copy')
    })
})

describe('MetahubThemePresetsService.exportPreset', () => {
    it('rejects an invalid codename override with 400 THEME_PRESET_INVALID before envelope validation (twin parity)', async () => {
        // TWIN PARITY (2026-11-08): the metahubs twin now mirrors the
        // applications-backend 400 guard that precedes envelope validation.
        const executor = createMockExecutor({
            [GET_BY_ID]: () => [makePresetRecord({ codename: 'valid-preset' })]
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub())

        const rejection = service.exportPreset(metahubId, '0190a9b5-0000-7000-8000-000000000001', 'Not a Valid Codename!', userId)
        await expect(rejection).rejects.toThrow(/codename override must match the preset codename format/)
        await expect(rejection).rejects.toMatchObject({ statusCode: 400, code: 'THEME_PRESET_INVALID' })
    })
})

describe('MetahubThemePresetsService layout appearance SQL soft-delete guards', () => {
    // Branch layout rows carry two soft-delete flags: `_upl_deleted` (platform
    // row lifecycle) and `_mhb_deleted` (branch deletion). Every appearance SQL
    // path must exclude branch-deleted layouts alongside `_upl_deleted`
    // (precedent: snapshotLayouts.ts reads layouts with both guards).
    const layoutId = '0190a9b5-0000-7000-8000-000000000009'
    // Canonical branch schema names — `qSchemaTable` rejects anything else.
    const branchSchemaA = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1'
    const branchSchemaB = 'mhb_a1b2c3d4e5f67890abcdef1234567890_b2'
    const appearanceDraft = {
        mode: 'system' as const,
        preset: { source: 'file' as const, id: preset.id, version: preset.version },
        overrides: {}
    }

    const expectBothDeleteGuards = (sql: string | undefined): void => {
        expect(sql).toBeDefined()
        expect(sql).toContain('l._upl_deleted = false')
        expect(sql).toContain('l._mhb_deleted = false')
    }

    it('updateLayoutAppearance refuses to write appearance into a branch-deleted layout', async () => {
        const { executor, sqls } = createSqlCapturingExecutor({
            [UPDATE_APPEARANCE]: () => [{ id: layoutId, version: 2 }],
            [AUDIT]: () => [{ id: 'audit-1' }]
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub(branchSchemaA))

        await service.applyLayoutAppearance(metahubId, layoutId, { appearance: appearanceDraft, expectedVersion: 1 }, userId)

        expectBothDeleteGuards(sqls.find((sql) => sql.includes(UPDATE_APPEARANCE)))
    })

    it('resetLayoutAppearance refuses to reset a branch-deleted layout', async () => {
        const { executor, sqls } = createSqlCapturingExecutor({
            [RESET_APPEARANCE]: () => [{ id: layoutId }],
            [AUDIT]: () => [{ id: 'audit-1' }]
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub(branchSchemaA))

        await service.resetLayoutAppearance(metahubId, layoutId, 1, userId)

        expectBothDeleteGuards(sqls.find((sql) => sql.includes(RESET_APPEARANCE)))
    })

    it('readLayoutAppearance does not read appearance from a branch-deleted layout', async () => {
        const { executor, sqls } = createSqlCapturingExecutor({
            [READ_APPEARANCE]: () => [{ appearance: { ...appearanceDraft } }],
            [UPDATE_APPEARANCE]: () => [{ id: layoutId, version: 2 }],
            [AUDIT]: () => [{ id: 'audit-1' }]
        })
        const service = new MetahubThemePresetsService(executor, createSchemaServiceStub(branchSchemaA))

        await service.applyLatestLayoutAppearance(metahubId, layoutId, 1, userId)

        expectBothDeleteGuards(sqls.find((sql) => sql.includes(READ_APPEARANCE)))
    })

    it('findThemePresetUsageLayoutIds scans only live branch layouts', async () => {
        const { executor, sqls } = createSqlCapturingExecutor({})

        const ids = await findThemePresetUsageLayoutIds(executor, [branchSchemaA, branchSchemaB], '0190a9b5-0000-7000-8000-000000000001')

        expect(ids).toEqual([])
        const scanSql = sqls[0]
        expect(scanSql).toContain('UNION ALL')
        expect(scanSql).toContain('l._upl_deleted = false AND l._mhb_deleted = false')
        expect(scanSql.match(/l\._mhb_deleted = false/g)).toHaveLength(2)
    })
})
