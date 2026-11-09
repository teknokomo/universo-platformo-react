import type { DbExecutor } from '@universo-react/utils'
import { uuidV7Schema } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import {
    themeAppearanceDraftSchema,
    themeOverridesSchema,
    themeContrastIssues,
    themeFilePresetEnvelopeSchema,
    themeTokensSchema,
    THEME_PRESETS_MAX_PER_SCOPE,
    type ThemeAppearance,
    type ThemePresetRef,
    THEME_PRESET_CODENAME_REGEX
} from '@universo-react/types'
import { assertThemeTokensWithinLimit, findFileThemePreset, fileThemePresets, isFileThemePresetCodename } from '@universo-react/theme'
import { resolveThemeAppearance, ThemeAppearanceResolveError } from '@universo-react/theme/resolve'
import { z } from 'zod'

import { MetahubDomainError } from '../shared/domainErrors'
import { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import { createLogger } from '../../utils/logger'
import {
    archiveThemePresetInTransaction,
    countActiveThemePresets,
    countThemePresetUsages,
    createThemePresetInTransaction,
    deleteThemePresetInTransaction,
    getThemePreset,
    listThemePresets,
    recordThemePresetAuditInTransaction,
    ThemePresetLimitReachedError,
    findThemePresetUsageLayoutIds,
    ThemePresetNotFoundError,
    updateThemePresetInTransaction,
    type ThemePresetRecord
} from './themePresetsStore'

const PRESET_EXPORT_SCHEMA = 'https://universo-platformo.dev/schemas/theme-preset-file-v1.json'

const log = createLogger('themePresets')

export const createThemePresetInputSchema = z
    .object({
        codename: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
        name: z.record(z.string().min(2).max(8), z.string().min(1)),
        description: z.record(z.string().min(2).max(8), z.string().min(1)).optional(),
        tokens: themeTokensSchema
    })
    .strict()

export const copyThemePresetInputSchema = z
    .object({
        presetId: uuidV7Schema.optional(),
        filePresetId: z
            .string()
            .regex(/^[a-z][a-z0-9-]{2,63}$/)
            .optional(),
        codename: z
            .string()
            .regex(/^[a-z][a-z0-9-]{2,63}$/)
            .optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (Boolean(value.presetId) === Boolean(value.filePresetId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide exactly one of presetId or filePresetId.' })
        }
    })

export const updateThemePresetInputSchema = z
    .object({
        name: z.record(z.string().min(2).max(8), z.string().min(1)).optional(),
        description: z.record(z.string().min(2).max(8), z.string().min(1)).nullable().optional(),
        tokens: themeTokensSchema.optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const presetVersionMutationSchema = z.object({ expectedVersion: z.number().int().positive() }).strict()

export const layoutAppearanceMutationSchema = z
    .object({
        appearance: themeAppearanceDraftSchema,
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const layoutAppearanceResetSchema = z.object({ expectedVersion: z.number().int().positive() }).strict()

export interface ThemePresetExportEnvelope {
    $schema?: string
    schemaVersion: number
    id: string
    version: number
    name: Record<string, string>
    description?: Record<string, string>
    tokens: unknown
}

const PRESET_SOURCE_LABEL = 'metahub' as const

/** Default copy codename: `${source}-copy`, truncated to keep the TZ codename regex satisfied. */
const deriveCopyCodename = (sourceCodename: string): string => {
    const suffix = '-copy'
    const maxBase = 64 - suffix.length
    const base = sourceCodename.slice(0, Math.max(1, Math.min(sourceCodename.length, maxBase))).replace(/-+$/u, '')
    const codename = `${base}${suffix}`
    return THEME_PRESET_CODENAME_REGEX.test(codename) ? codename : 'preset-copy'
}

export class ThemePresetVersionConflictError extends MetahubDomainError {
    constructor(conflict: unknown) {
        super({
            message: 'Theme preset was modified by another user. Please refresh and try again.',
            statusCode: 409,
            code: 'THEME_PRESET_VERSION_CONFLICT',
            details: { conflict }
        })
    }
}

const mapDbPreset = (record: ThemePresetRecord) => ({
    id: record.id,
    codename: record.codename,
    source: PRESET_SOURCE_LABEL,
    version: record.version,
    name: record.name,
    description: record.description,
    archived: record.archived,
    usageCount: 0 as number
})

const assertCodenameAvailable = (codename: string): void => {
    if (isFileThemePresetCodename(codename)) {
        throw new MetahubDomainError({
            message: `Codename "${codename}" is reserved by a built-in file preset.`,
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: { reason: 'codename-reserved-by-file-preset', codename }
        })
    }
}

const collectContrastErrors = (tokens: unknown): void => {
    const parsed = themeTokensSchema.safeParse(tokens)
    if (!parsed.success) {
        throw new MetahubDomainError({
            message: 'Theme tokens failed validation.',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: parsed.error.flatten()
        })
    }
    const { errors } = themeContrastIssues(parsed.data)
    if (errors.length > 0) {
        throw new MetahubDomainError({
            message: 'Theme tokens fail WCAG text contrast requirements.',
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            details: { errors }
        })
    }
}

export class MetahubThemePresetsService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    async listPresets(metahubId: string, includeArchived = false): Promise<unknown> {
        const [dbPresets, branchSchemas] = await Promise.all([
            listThemePresets(this.exec, metahubId, includeArchived),
            this.listBranchSchemas(metahubId)
        ])
        const presets = await Promise.all(
            dbPresets.map(async (record) => ({
                ...mapDbPreset(record),
                usageCount: await countThemePresetUsages(this.exec, branchSchemas, record.id)
            }))
        )
        const filePresets = fileThemePresets.map((preset) => ({
            id: preset.id,
            codename: preset.id,
            source: 'file' as const,
            version: preset.version,
            name: preset.name,
            description: preset.description ?? {},
            archived: false,
            usageCount: null
        }))
        return { file: filePresets, presets }
    }

    async getPreset(metahubId: string, presetId: string): Promise<ThemePresetRecord | null> {
        return getThemePreset(this.exec, metahubId, presetId)
    }

    async createPreset(metahubId: string, input: z.infer<typeof createThemePresetInputSchema>, userId: string): Promise<ThemePresetRecord> {
        assertCodenameAvailable(input.codename)
        assertThemeTokensWithinLimit(input.tokens)
        collectContrastErrors(input.tokens)
        return this.exec.transaction(async (tx) => {
            const activeCount = await countActiveThemePresets(tx, metahubId)
            if (activeCount >= THEME_PRESETS_MAX_PER_SCOPE) {
                throw new ThemePresetLimitReachedError(THEME_PRESETS_MAX_PER_SCOPE)
            }
            const created = await createThemePresetInTransaction(tx, {
                metahubId,
                codename: input.codename,
                name: input.name,
                description: input.description ?? {},
                tokens: input.tokens,
                basePresetId: null,
                basePresetCodename: null,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                metahubId,
                presetId: created.id,
                eventType: 'theme_preset_created',
                changedFields: ['tokens'],
                previousVersion: null,
                newVersion: created.version,
                actor: userId
            })
            return created
        })
    }

    async copyPreset(metahubId: string, input: z.infer<typeof copyThemePresetInputSchema>, userId: string): Promise<ThemePresetRecord> {
        let sourceTokens: unknown
        let sourceName: Record<string, string> = {}
        let basePresetId: string | null = null
        let basePresetCodename: string | null = null
        let sourceCodename: string

        if (input.filePresetId) {
            const filePreset = findFileThemePreset(input.filePresetId)
            if (!filePreset) {
                throw new MetahubDomainError({ message: 'File theme preset was not found.', statusCode: 404, code: 'NOT_FOUND' })
            }
            sourceTokens = filePreset.tokens
            sourceCodename = filePreset.id
            sourceName = filePreset.name
            basePresetCodename = filePreset.id
        } else {
            const source = await getThemePreset(this.exec, metahubId, input.presetId!)
            if (!source) throw new ThemePresetNotFoundError()
            sourceTokens = source.tokens
            sourceCodename = source.codename
            sourceName = source.name
            basePresetId = source.id
            basePresetCodename = source.codename
        }

        const codename = input.codename ?? deriveCopyCodename(sourceCodename)
        assertCodenameAvailable(codename)
        const name: Record<string, string> = {}
        for (const [locale, label] of Object.entries(sourceName)) {
            name[locale] = `${label} (copy)`
        }
        if (Object.keys(name).length === 0) name.en = `${sourceCodename} (copy)`

        return this.exec.transaction(async (tx) => {
            const activeCount = await countActiveThemePresets(tx, metahubId)
            if (activeCount >= THEME_PRESETS_MAX_PER_SCOPE) {
                throw new ThemePresetLimitReachedError(THEME_PRESETS_MAX_PER_SCOPE)
            }
            const created = await createThemePresetInTransaction(tx, {
                metahubId,
                codename,
                name,
                description: {},
                tokens: sourceTokens,
                basePresetId,
                basePresetCodename,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                metahubId,
                presetId: created.id,
                eventType: 'theme_preset_copied',
                changedFields: ['tokens'],
                previousVersion: null,
                newVersion: created.version,
                actor: userId
            })
            return created
        })
    }

    async updatePreset(
        metahubId: string,
        presetId: string,
        input: z.infer<typeof updateThemePresetInputSchema>,
        userId: string
    ): Promise<ThemePresetRecord> {
        if (input.tokens) {
            assertThemeTokensWithinLimit(input.tokens)
            collectContrastErrors(input.tokens)
        }
        const name = input.name ?? undefined
        const description = input.description === undefined ? undefined : input.description ?? {}
        const updated = await this.exec.transaction(async (tx) => {
            const record = await updateThemePresetInTransaction(tx, {
                metahubId,
                presetId,
                expectedVersion: input.expectedVersion,
                name,
                description,
                tokens: input.tokens,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                metahubId,
                presetId,
                eventType: 'theme_preset_updated',
                changedFields: [
                    name !== undefined ? 'name' : null,
                    description !== undefined ? 'description' : null,
                    input.tokens ? 'tokens' : null
                ].filter((field): field is string => Boolean(field)),
                previousVersion: input.expectedVersion,
                newVersion: record.version,
                actor: userId
            })
            return record
        })
        return updated
    }

    async archivePreset(metahubId: string, presetId: string, expectedVersion: number, userId: string): Promise<ThemePresetRecord> {
        return this.exec.transaction(async (tx) => {
            const record = await archiveThemePresetInTransaction(tx, { metahubId, presetId, expectedVersion, actor: userId })
            await recordThemePresetAuditInTransaction(tx, {
                metahubId,
                presetId,
                eventType: 'theme_preset_archived',
                changedFields: ['archived'],
                previousVersion: expectedVersion,
                newVersion: record.version,
                actor: userId
            })
            return record
        })
    }

    async deletePreset(metahubId: string, presetId: string, expectedVersion: number, userId: string): Promise<ThemePresetRecord> {
        const branchSchemas = await this.listBranchSchemas(metahubId)
        return this.exec.transaction(async (tx) => {
            const usageLayoutIds = await findThemePresetUsageLayoutIds(tx, branchSchemas, presetId)
            if (usageLayoutIds.length > 0) {
                throw new MetahubDomainError({
                    message: 'Theme preset is used by layouts and cannot be deleted.',
                    statusCode: 409,
                    code: 'THEME_PRESET_IN_USE',
                    details: { usageCount: usageLayoutIds.length, usageLayoutIds, presetId }
                })
            }
            const record = await deleteThemePresetInTransaction(tx, { metahubId, presetId, expectedVersion, actor: userId })
            await recordThemePresetAuditInTransaction(tx, {
                metahubId,
                presetId: null,
                eventType: 'theme_preset_deleted',
                changedFields: [],
                previousVersion: expectedVersion,
                newVersion: null,
                actor: userId
            })
            return record
        })
    }

    async exportPreset(
        metahubId: string,
        presetId: string,
        codenameOverride: string | undefined,
        userId: string
    ): Promise<ThemePresetExportEnvelope> {
        const record = await getThemePreset(this.exec, metahubId, presetId)
        if (!record) throw new ThemePresetNotFoundError()
        if (codenameOverride !== undefined && !THEME_PRESET_CODENAME_REGEX.test(codenameOverride)) {
            throw new MetahubDomainError({
                message: 'Export codename override must match the preset codename format.',
                statusCode: 400,
                code: 'THEME_PRESET_INVALID',
                details: { reason: 'invalid-codename-override', codename: codenameOverride }
            })
        }
        const id = codenameOverride ?? record.codename
        const envelopeCandidate = {
            $schema: PRESET_EXPORT_SCHEMA,
            schemaVersion: 1,
            id,
            version: record.version,
            name: record.name,
            description: record.description,
            tokens: record.tokens
        }
        // FR-048: a DB codename colliding with a built-in file preset requires
        // an explicit new codename for the exported file.
        const parsed = themeFilePresetEnvelopeSchema.safeParse(envelopeCandidate)
        if (!parsed.success) {
            throw new MetahubDomainError({
                message: 'Exported theme preset failed envelope validation.',
                statusCode: 500,
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten()
            })
        }
        if (isFileThemePresetCodename(parsed.data.id)) {
            throw new MetahubDomainError({
                message: `Preset codename "${parsed.data.id}" is reserved by a built-in file preset; provide a new codename for the export.`,
                statusCode: 409,
                code: 'CONFLICT',
                details: { reason: 'codename-reserved-by-file-preset', codename: parsed.data.id }
            })
        }

        await recordThemePresetAuditInTransaction(this.exec, {
            metahubId,
            presetId: record.id,
            eventType: 'theme_preset_exported',
            changedFields: [],
            previousVersion: record.version,
            newVersion: record.version,
            actor: userId
        })
        return parsed.data
    }

    async applyLayoutAppearance(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof layoutAppearanceMutationSchema>,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const resolved = await this.resolveAppearanceDraft(metahubId, input.appearance)
        const updated = await this.updateLayoutAppearance(metahubId, layoutId, resolved, input.expectedVersion, userId)
        await recordThemePresetAuditInTransaction(this.exec, {
            metahubId,
            presetId: null,
            eventType: 'layout_appearance_applied',
            changedFields: ['appearance'],
            previousVersion: input.expectedVersion,
            newVersion: updated.version,
            actor: userId
        })
        return updated
    }

    async resetLayoutAppearance(
        metahubId: string,
        layoutId: string,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: null }> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        await this.exec.transaction(async (tx) => {
            const rows = await tx.query<{ id: string }>(
                `
                UPDATE ${lt} l
                SET config = l.config - 'appearance',
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(l._upl_version, 1) + 1
                WHERE l.id = $1
                  AND COALESCE(l._upl_version, 1) = $3
                  AND l._upl_deleted = false
                  AND l._mhb_deleted = false
                RETURNING l.id
                `,
                [layoutId, userId, expectedVersion]
            )
            if (!rows[0]) {
                throw new MetahubDomainError({
                    message: 'Layout was modified by another user or does not exist.',
                    statusCode: 409,
                    code: 'CONFLICT',
                    details: { layoutId }
                })
            }
        })
        // Observability (TH-18/G11): the reset removes the appearance, so there
        // is no hash to report.
        log.info('Layout appearance reset', { metahubId, layoutId })
        await recordThemePresetAuditInTransaction(this.exec, {
            metahubId,
            presetId: null,
            eventType: 'layout_appearance_reset',
            changedFields: ['appearance'],
            previousVersion: expectedVersion,
            newVersion: expectedVersion + 1,
            actor: userId
        })
        return { layoutId, version: expectedVersion + 1, appearance: null }
    }

    async applyLatestLayoutAppearance(
        metahubId: string,
        layoutId: string,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const current = await this.readLayoutAppearance(metahubId, layoutId, userId)
        if (!current) {
            throw new MetahubDomainError({ message: 'Layout has no appearance to refresh.', statusCode: 404, code: 'NOT_FOUND' })
        }
        const overrides = themeOverridesSchema.safeParse(current.overrides)
        const resolved = await this.resolveAppearanceDraft(metahubId, {
            mode: current.mode,
            preset: current.preset,
            overrides: overrides.success ? overrides.data : {}
        })
        const updated = await this.updateLayoutAppearance(metahubId, layoutId, resolved, expectedVersion, userId)
        await recordThemePresetAuditInTransaction(this.exec, {
            metahubId,
            presetId: null,
            eventType: 'layout_appearance_apply_latest',
            changedFields: ['appearance.resolved'],
            previousVersion: expectedVersion,
            newVersion: updated.version,
            actor: userId
        })
        return updated
    }

    private async readLayoutAppearance(
        metahubId: string,
        layoutId: string,
        userId: string
    ): Promise<{ mode: 'system' | 'light' | 'dark'; preset: ThemePresetRef; overrides: unknown } | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const rows = await this.exec.query<{ appearance: unknown }>(
            `SELECT l.config->'appearance' AS appearance FROM ${lt} l WHERE l.id = $1 AND l._upl_deleted = false AND l._mhb_deleted = false LIMIT 1`,
            [layoutId]
        )
        const raw = rows[0]?.appearance
        if (!raw || typeof raw !== 'object') return null
        const candidate = raw as { mode?: 'system' | 'light' | 'dark'; preset?: ThemePresetRef; overrides?: unknown }
        if (!candidate.preset) return null
        return {
            mode: candidate.mode ?? 'system',
            preset: candidate.preset,
            overrides: candidate.overrides ?? {}
        }
    }

    private async resolveAppearanceDraft(metahubId: string, draft: z.infer<typeof themeAppearanceDraftSchema>): Promise<ThemeAppearance> {
        let presetTokens: unknown
        let resolvedVersion = draft.preset.version

        if (draft.preset.source === 'file') {
            const filePreset = findFileThemePreset(draft.preset.id)
            if (!filePreset) {
                throw new MetahubDomainError({ message: 'File theme preset was not found.', statusCode: 404, code: 'NOT_FOUND' })
            }
            presetTokens = filePreset.tokens
            resolvedVersion = filePreset.version
        } else if (draft.preset.source === 'metahub') {
            const preset = await getThemePreset(this.exec, metahubId, draft.preset.id)
            if (!preset || preset.archived) {
                throw new MetahubDomainError({
                    message: 'Referenced theme preset is not available in this metahub.',
                    statusCode: 404,
                    code: 'NOT_FOUND',
                    details: { presetId: draft.preset.id }
                })
            }
            presetTokens = preset.tokens
            resolvedVersion = preset.version
        } else {
            throw new MetahubDomainError({
                message: 'Application-scoped presets cannot be referenced from a metahub layout.',
                statusCode: 403,
                code: 'VALIDATION_ERROR'
            })
        }

        try {
            const startedAt = Date.now()
            const resolved = resolveThemeAppearance({
                preset: { source: draft.preset.source, id: draft.preset.id, version: resolvedVersion },
                presetTokens: themeTokensSchema.parse(presetTokens),
                overrides: draft.overrides
            })
            const { errors: contrastErrors } = themeContrastIssues(resolved.tokens)
            if (contrastErrors.length > 0) {
                throw new MetahubDomainError({
                    message: 'Theme tokens fail WCAG text contrast requirements.',
                    statusCode: 422,
                    code: 'THEME_APPEARANCE_RESOLVE_FAILED',
                    details: { errors: contrastErrors }
                })
            }
            // Observability (TH-18/G11): one structured line per resolution —
            // hash and duration only, never the raw appearance body or tokens.
            log.info('Layout appearance resolved', {
                metahubId,
                presetSource: draft.preset.source,
                themeHash: resolved.hash,
                durationMs: Date.now() - startedAt
            })
            return {
                mode: draft.mode,
                preset: { source: draft.preset.source, id: draft.preset.id, version: resolvedVersion },
                overrides: draft.overrides,
                resolved
            }
        } catch (error) {
            if (error instanceof ThemeAppearanceResolveError) {
                throw new MetahubDomainError({
                    message: error.message,
                    statusCode: 422,
                    code: 'VALIDATION_ERROR',
                    details: error.details as Record<string, unknown> | undefined
                })
            }
            throw error
        }
    }

    private async updateLayoutAppearance(
        metahubId: string,
        layoutId: string,
        appearance: ThemeAppearance,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const rows = await this.exec.query<{ id: string; version: number }>(
            `
            UPDATE ${lt} l
            SET config = jsonb_set(COALESCE(l.config, '{}'::jsonb), '{appearance}', $3::jsonb, true),
                _upl_updated_at = NOW(),
                _upl_updated_by = $4,
                _upl_version = COALESCE(l._upl_version, 1) + 1
            WHERE l.id = $2
              AND COALESCE(l._upl_version, 1) = $5
              AND l._upl_deleted = false
              AND l._mhb_deleted = false
            RETURNING l.id, COALESCE(l._upl_version, 1) AS version
            `,
            [metahubId, layoutId, JSON.stringify(appearance), userId, expectedVersion]
        )
        const row = rows[0]
        if (!row) {
            throw new MetahubDomainError({
                message: 'Layout was modified by another user or does not exist.',
                statusCode: 409,
                code: 'CONFLICT',
                details: { layoutId }
            })
        }
        return { layoutId: row.id, version: row.version, appearance }
    }

    private async listBranchSchemas(metahubId: string): Promise<string[]> {
        const rows = await this.exec.query<{ schema_name: string }>(
            `
            SELECT b.schema_name
            FROM metahubs.obj_metahub_branches b
            WHERE b.metahub_id = $1
              AND b._upl_deleted = false
            `,
            [metahubId]
        )
        return rows.map((row) => row.schema_name)
    }
}
