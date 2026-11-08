import { uuidV7Schema } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import {
    themeAppearanceDraftSchema,
    themeContrastIssues,
    themeOverridesSchema,
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

import type { DbExecutor } from '@universo-react/utils'
import {
    archiveThemePresetInTransaction,
    countActiveThemePresets,
    countThemePresetUsages,
    createThemePresetInTransaction,
    deleteThemePresetInTransaction,
    getThemePreset,
    listThemePresets,
    recordThemePresetAuditInTransaction,
    findThemePresetUsageLayoutIds,
    ThemePresetNotFoundError,
    updateThemePresetInTransaction,
    type ThemePresetRecord
} from '../persistence/themePresetsStore'

const PRESET_EXPORT_SCHEMA = 'https://universo-platformo.dev/schemas/theme-preset-file-v1.json'

/** Application-domain typed error carrying TZ §11.5 codes to the controller. */

/** Default copy codename: `${source}-copy`, truncated to keep the TZ codename regex satisfied. */
const deriveCopyCodename = (sourceCodename: string): string => {
    const suffix = '-copy'
    const maxBase = 64 - suffix.length
    const base = sourceCodename.slice(0, Math.max(1, Math.min(sourceCodename.length, maxBase))).replace(/-+$/u, '')
    const codename = `${base}${suffix}`
    return THEME_PRESET_CODENAME_REGEX.test(codename) ? codename : 'preset-copy'
}

export class ApplicationsDomainError extends Error {
    readonly statusCode: number
    readonly code: string
    readonly details?: Record<string, unknown>
    constructor(payload: { message: string; statusCode: number; code: string; details?: Record<string, unknown> }) {
        super(payload.message)
        this.name = 'ApplicationsDomainError'
        this.statusCode = payload.statusCode
        this.code = payload.code
        this.details = payload.details
    }
}

export const createThemePresetInputSchema = z
    .object({
        codename: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
        name: z.record(z.string().min(2).max(8), z.string().min(1)),
        description: z.record(z.string().min(2).max(8), z.string().min(1)).optional(),
        tokens: themeTokensSchema,
        /**
         * Provenance for copies that cannot use the same-schema FK — e.g. the
         * copy-to-application action sourcing an inherited metahub appearance
         * (`metahub:<uuid>`). DB-source copies set basePresetId via copyPreset.
         */
        basePresetCodename: z.string().min(1).max(64).optional()
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

const PRESET_SOURCE_LABEL = 'application' as const

export class ThemePresetVersionConflictError extends ApplicationsDomainError {
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
        throw new ApplicationsDomainError({
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
        throw new ApplicationsDomainError({
            message: 'Theme tokens failed validation.',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: parsed.error.flatten()
        })
    }
    const { errors } = themeContrastIssues(parsed.data)
    if (errors.length > 0) {
        throw new ApplicationsDomainError({
            message: 'Theme tokens fail WCAG text contrast requirements.',
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            details: { errors }
        })
    }
}

export class ApplicationThemePresetsService {
    constructor(private exec: DbExecutor, private getLayoutSchemaName: () => Promise<string>) {}

    /** Layouts live in the application's own `_app_layouts` schema. */
    private async listLayoutSchemas(_applicationId: string): Promise<string[]> {
        return [await this.getLayoutSchemaName()]
    }

    async createPreset(
        applicationId: string,
        input: z.infer<typeof createThemePresetInputSchema>,
        userId: string
    ): Promise<ThemePresetRecord> {
        assertThemeTokensWithinLimit(input.tokens)
        if (isFileThemePresetCodename(input.codename)) {
            throw new ApplicationsDomainError({
                message: `Codename "${input.codename}" is reserved by a built-in file preset.`,
                statusCode: 400,
                code: 'VALIDATION_ERROR',
                details: { reason: 'codename-reserved-by-file-preset', codename: input.codename }
            })
        }
        const parsedTokens = themeTokensSchema.parse(input.tokens)
        const { errors } = themeContrastIssues(parsedTokens)
        if (errors.length > 0) {
            throw new ApplicationsDomainError({
                message: 'Theme tokens fail WCAG text contrast requirements.',
                statusCode: 422,
                code: 'VALIDATION_ERROR',
                details: { errors }
            })
        }
        return this.exec.transaction(async (tx) => {
            const activeCount = await countActiveThemePresets(tx, applicationId)
            if (activeCount >= THEME_PRESETS_MAX_PER_SCOPE) {
                throw new ApplicationsDomainError({
                    message: 'Theme preset limit reached for this application.',
                    statusCode: 409,
                    code: 'THEME_PRESET_LIMIT_REACHED',
                    details: { limit: THEME_PRESETS_MAX_PER_SCOPE }
                })
            }
            const created = await createThemePresetInTransaction(tx, {
                applicationId,
                codename: input.codename,
                name: input.name,
                description: input.description ?? {},
                tokens: input.tokens,
                basePresetId: null,
                basePresetCodename: input.basePresetCodename ?? null,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                applicationId,
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

    async getPreset(applicationId: string, presetId: string): Promise<ThemePresetRecord | null> {
        return getThemePreset(this.exec, applicationId, presetId)
    }

    async listPresets(applicationId: string, includeArchived = false): Promise<unknown> {
        const [dbPresets, layoutSchemas] = await Promise.all([
            listThemePresets(this.exec, applicationId, includeArchived),
            this.listLayoutSchemas(applicationId)
        ])
        const presets = await Promise.all(
            dbPresets.map(async (record) => ({
                ...mapDbPreset(record),
                usageCount: await countThemePresetUsages(this.exec, layoutSchemas, record.id)
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

    async copyPreset(applicationId: string, input: z.infer<typeof copyThemePresetInputSchema>, userId: string): Promise<ThemePresetRecord> {
        let sourceTokens: unknown
        let sourceName: Record<string, string> = {}
        let basePresetId: string | null = null
        let basePresetCodename: string | null = null
        let sourceCodename: string

        if (input.filePresetId) {
            const filePreset = findFileThemePreset(input.filePresetId)
            if (!filePreset) {
                throw new ApplicationsDomainError({ message: 'File theme preset was not found.', statusCode: 404, code: 'NOT_FOUND' })
            }
            sourceTokens = filePreset.tokens
            sourceCodename = filePreset.id
            sourceName = filePreset.name
            basePresetCodename = filePreset.id
        } else {
            const source = await getThemePreset(this.exec, applicationId, input.presetId!)
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
            const activeCount = await countActiveThemePresets(tx, applicationId)
            if (activeCount >= THEME_PRESETS_MAX_PER_SCOPE) {
                throw new ApplicationsDomainError({
                    message: 'Theme preset limit reached for this application.',
                    statusCode: 409,
                    code: 'THEME_PRESET_LIMIT_REACHED',
                    details: { limit: THEME_PRESETS_MAX_PER_SCOPE }
                })
            }
            const created = await createThemePresetInTransaction(tx, {
                applicationId,
                codename,
                name,
                description: {},
                tokens: sourceTokens,
                basePresetId,
                basePresetCodename,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                applicationId,
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
        applicationId: string,
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
                applicationId,
                presetId,
                expectedVersion: input.expectedVersion,
                name,
                description,
                tokens: input.tokens,
                actor: userId
            })
            await recordThemePresetAuditInTransaction(tx, {
                applicationId,
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

    async archivePreset(applicationId: string, presetId: string, expectedVersion: number, userId: string): Promise<ThemePresetRecord> {
        return this.exec.transaction(async (tx) => {
            const record = await archiveThemePresetInTransaction(tx, { applicationId, presetId, expectedVersion, actor: userId })
            await recordThemePresetAuditInTransaction(tx, {
                applicationId,
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

    async deletePreset(applicationId: string, presetId: string, expectedVersion: number, userId: string): Promise<ThemePresetRecord> {
        const layoutSchemas = await this.listLayoutSchemas(applicationId)
        return this.exec.transaction(async (tx) => {
            const usageLayoutIds = await findThemePresetUsageLayoutIds(tx, layoutSchemas, presetId)
            if (usageLayoutIds.length > 0) {
                throw new ApplicationsDomainError({
                    message: 'Theme preset is used by layouts and cannot be deleted.',
                    statusCode: 409,
                    code: 'THEME_PRESET_IN_USE',
                    details: { usageCount: usageLayoutIds.length, usageLayoutIds, presetId }
                })
            }
            const record = await deleteThemePresetInTransaction(tx, { applicationId, presetId, expectedVersion, actor: userId })
            await recordThemePresetAuditInTransaction(tx, {
                applicationId,
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
        applicationId: string,
        presetId: string,
        codenameOverride: string | undefined,
        userId: string
    ): Promise<ThemePresetExportEnvelope> {
        const record = await getThemePreset(this.exec, applicationId, presetId)
        if (!record) throw new ThemePresetNotFoundError()
        if (codenameOverride !== undefined && !THEME_PRESET_CODENAME_REGEX.test(codenameOverride)) {
            throw new ApplicationsDomainError({
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
            throw new ApplicationsDomainError({
                message: 'Exported theme preset failed envelope validation.',
                statusCode: 500,
                code: 'VALIDATION_ERROR',
                details: parsed.error.flatten()
            })
        }
        if (isFileThemePresetCodename(parsed.data.id)) {
            throw new ApplicationsDomainError({
                message: `Preset codename "${parsed.data.id}" is reserved by a built-in file preset; provide a new codename for the export.`,
                statusCode: 409,
                code: 'CONFLICT',
                details: { reason: 'codename-reserved-by-file-preset', codename: parsed.data.id }
            })
        }

        await recordThemePresetAuditInTransaction(this.exec, {
            applicationId,
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
        applicationId: string,
        layoutId: string,
        input: z.infer<typeof layoutAppearanceMutationSchema>,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const resolved = await this.resolveAppearanceDraft(applicationId, input.appearance)
        const updated = await this.updateLayoutAppearance(applicationId, layoutId, resolved, input.expectedVersion, userId)
        await recordThemePresetAuditInTransaction(this.exec, {
            applicationId,
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
        applicationId: string,
        layoutId: string,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: null }> {
        const schemaName = await this.getLayoutSchemaName()
        const lt = qSchemaTable(schemaName, '_app_layouts')
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
                RETURNING l.id
                `,
                [layoutId, userId, expectedVersion]
            )
            if (!rows[0]) {
                throw new ApplicationsDomainError({
                    message: 'Layout was modified by another user or does not exist.',
                    statusCode: 409,
                    code: 'CONFLICT',
                    details: { layoutId }
                })
            }
        })
        // Observability (TH-18/G11): the reset removes the appearance, so there
        // is no hash to report.
        console.info('[applicationThemePresets] Layout appearance reset', { applicationId, layoutId })
        await recordThemePresetAuditInTransaction(this.exec, {
            applicationId,
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
        applicationId: string,
        layoutId: string,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const current = await this.readLayoutAppearance(applicationId, layoutId, userId)
        if (!current) {
            throw new ApplicationsDomainError({ message: 'Layout has no appearance to refresh.', statusCode: 404, code: 'NOT_FOUND' })
        }
        const overrides = themeOverridesSchema.safeParse(current.overrides)
        const resolved = await this.resolveAppearanceDraft(applicationId, {
            mode: current.mode,
            preset: current.preset,
            overrides: overrides.success ? overrides.data : {}
        })
        const updated = await this.updateLayoutAppearance(applicationId, layoutId, resolved, expectedVersion, userId)
        await recordThemePresetAuditInTransaction(this.exec, {
            applicationId,
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
        applicationId: string,
        layoutId: string,
        _userId: string
    ): Promise<{ mode: 'system' | 'light' | 'dark'; preset: ThemePresetRef; overrides: unknown } | null> {
        const schemaName = await this.getLayoutSchemaName()
        const lt = qSchemaTable(schemaName, '_app_layouts')
        const rows = await this.exec.query<{ appearance: unknown }>(
            `SELECT l.config->'appearance' AS appearance FROM ${lt} l WHERE l.id = $1 AND l._upl_deleted = false LIMIT 1`,
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

    private async resolveAppearanceDraft(
        applicationId: string,
        draft: z.infer<typeof themeAppearanceDraftSchema>
    ): Promise<ThemeAppearance> {
        let presetTokens: unknown
        let resolvedVersion = draft.preset.version

        if (draft.preset.source === 'file') {
            const filePreset = findFileThemePreset(draft.preset.id)
            if (!filePreset) {
                throw new ApplicationsDomainError({ message: 'File theme preset was not found.', statusCode: 404, code: 'NOT_FOUND' })
            }
            presetTokens = filePreset.tokens
            resolvedVersion = filePreset.version
        } else if (draft.preset.source === 'application') {
            const preset = await getThemePreset(this.exec, applicationId, draft.preset.id)
            if (!preset || preset.archived) {
                throw new ApplicationsDomainError({
                    message: 'Referenced theme preset is not available in this application.',
                    statusCode: 404,
                    code: 'NOT_FOUND',
                    details: { presetId: draft.preset.id }
                })
            }
            presetTokens = preset.tokens
            resolvedVersion = preset.version
        } else if (draft.preset.source === 'metahub') {
            // Pinned Decision 14: the applications backend never reads
            // metahubs.obj_theme_presets. Inherited appearance renders from the
            // synced resolved snapshot; re-resolution requires copy-to-application.
            throw new ApplicationsDomainError({
                message: 'This layout inherits a metahub preset. Copy it into the application or select another preset.',
                statusCode: 409,
                code: 'THEME_PRESET_SOURCE_UNAVAILABLE'
            })
        } else {
            throw new ApplicationsDomainError({ message: 'Invalid preset source.', statusCode: 400, code: 'VALIDATION_ERROR' })
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
                throw new ApplicationsDomainError({
                    message: 'Theme tokens fail WCAG text contrast requirements.',
                    statusCode: 422,
                    code: 'THEME_APPEARANCE_RESOLVE_FAILED',
                    details: { errors: contrastErrors }
                })
            }
            // Observability (TH-18/G11): one structured line per resolution —
            // hash and duration only, never the raw appearance body or tokens.
            console.info('[applicationThemePresets] Layout appearance resolved', {
                applicationId,
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
                throw new ApplicationsDomainError({
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
        applicationId: string,
        layoutId: string,
        appearance: ThemeAppearance,
        expectedVersion: number,
        userId: string
    ): Promise<{ layoutId: string; version: number; appearance: ThemeAppearance }> {
        const schemaName = await this.getLayoutSchemaName()
        const lt = qSchemaTable(schemaName, '_app_layouts')
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
            RETURNING l.id, COALESCE(l._upl_version, 1) AS version
            `,
            [applicationId, layoutId, JSON.stringify(appearance), userId, expectedVersion]
        )
        const row = rows[0]
        if (!row) {
            throw new ApplicationsDomainError({
                message: 'Layout was modified by another user or does not exist.',
                statusCode: 409,
                code: 'CONFLICT',
                details: { layoutId }
            })
        }
        return { layoutId: row.id, version: row.version, appearance }
    }
}
