import { z } from 'zod'

/**
 * Typed theme-preset contracts shared by authoring surfaces, the theme
 * resolver package, and both backends. Tokens are an allowlist-only profile:
 * every leaf is a hex color, an enum, or a bounded number, so URL/string
 * injection vectors (TZ FR-017) cannot materialize and `strictObject` blocks
 * unknown keys — including `__proto__`/`constructor`/`prototype` — at every
 * level.
 */

export const THEME_TOKENS_SCHEMA_VERSION = 1

export const THEME_PRESET_CODENAME_REGEX = /^[a-z][a-z0-9-]{2,63}$/

/** TZ §13: preset and resolved snapshots are capped at 64 KiB. */
export const THEME_PRESET_MAX_BYTES = 64 * 1024
export const THEME_RESOLVED_MAX_BYTES = 64 * 1024

/** TZ §13: at most 100 active presets per metahub/application scope. */
export const THEME_PRESETS_MAX_PER_SCOPE = 100

export const THEME_HASH_REGEX = /^sha256:[0-9a-f]{64}$/

const forbiddenPresetKeys = ['__proto__', 'constructor', 'prototype'] as const

export const isForbiddenThemeKey = (key: string): boolean => (forbiddenPresetKeys as readonly string[]).includes(key)

/** TZ FR-018: token colors are #RRGGBB only (no shorthand, no alpha). */
export const themeHexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex-color')
export type ThemeHexColor = z.infer<typeof themeHexColorSchema>

export const themeFontFamilySchema = z.enum(['inter', 'system', 'serif', 'mono'])
export type ThemeFontFamily = z.infer<typeof themeFontFamilySchema>

export const themeDensitySchema = z.enum(['compact', 'comfortable'])
export type ThemeDensity = z.infer<typeof themeDensitySchema>

export const themeShadowScaleSchema = z.enum(['none', 'soft', 'default', 'strong'])
export type ThemeShadowScale = z.infer<typeof themeShadowScaleSchema>

const nullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullish()

const themeColorSlotSchema = z
    .object({
        main: themeHexColorSchema,
        contrastText: themeHexColorSchema
    })
    .strict()
export type ThemeColorSlot = z.infer<typeof themeColorSlotSchema>

const themeModeColorsSchema = z
    .object({
        primary: themeColorSlotSchema,
        secondary: themeColorSlotSchema,
        background: z
            .object({
                default: themeHexColorSchema,
                paper: themeHexColorSchema
            })
            .strict(),
        text: z
            .object({
                primary: themeHexColorSchema,
                secondary: themeHexColorSchema
            })
            .strict(),
        divider: themeHexColorSchema
    })
    .strict()
export type ThemeModeColors = z.infer<typeof themeModeColorsSchema>

export const themeSharedTokensSchema = z
    .object({
        typography: z
            .object({
                fontFamily: themeFontFamilySchema,
                baseSize: z.number().int().min(12).max(20),
                scale: z.number().min(1.1).max(1.4),
                weights: z
                    .object({
                        regular: z.number().int().min(100).max(900),
                        medium: z.number().int().min(100).max(900),
                        bold: z.number().int().min(100).max(900)
                    })
                    .strict()
            })
            .strict(),
        spacing: z
            .object({
                base: z.number().int().min(4).max(16),
                density: themeDensitySchema
            })
            .strict(),
        shape: z
            .object({
                borderRadius: z.number().int().min(0).max(24),
                borderWidth: z.number().int().min(0).max(4)
            })
            .strict(),
        shadows: z
            .object({
                scale: themeShadowScaleSchema
            })
            .strict()
    })
    .strict()
export type ThemeSharedTokens = z.infer<typeof themeSharedTokensSchema>

export const themeTokensSchema = z
    .object({
        shared: themeSharedTokensSchema,
        modes: z
            .object({
                light: themeModeColorsSchema,
                dark: themeModeColorsSchema
            })
            .strict()
    })
    .strict()
    .superRefine((value, context) => {
        for (const key of Object.keys(value)) {
            if (isForbiddenThemeKey(key)) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Forbidden token key.' })
            }
        }
    })
export type ThemeTokens = z.infer<typeof themeTokensSchema>
export type ThemeTokensInput = z.input<typeof themeTokensSchema>

/** Sparse overrides: absent keys keep the preset value, `null` reverts to it. */
const themeColorSlotOverridesSchema = z
    .object({
        main: nullable(themeHexColorSchema),
        contrastText: nullable(themeHexColorSchema)
    })
    .strict()

const themeModeColorsOverridesSchema = z
    .object({
        primary: themeColorSlotOverridesSchema.optional(),
        secondary: themeColorSlotOverridesSchema.optional(),
        background: z
            .object({
                default: nullable(themeHexColorSchema),
                paper: nullable(themeHexColorSchema)
            })
            .strict()
            .optional(),
        text: z
            .object({
                primary: nullable(themeHexColorSchema),
                secondary: nullable(themeHexColorSchema)
            })
            .strict()
            .optional(),
        divider: nullable(themeHexColorSchema)
    })
    .strict()

const themeSharedTokensOverridesSchema = z
    .object({
        typography: z
            .object({
                fontFamily: nullable(themeFontFamilySchema),
                baseSize: nullable(z.number().int().min(12).max(20)),
                scale: nullable(z.number().min(1.1).max(1.4)),
                weights: z
                    .object({
                        regular: nullable(z.number().int().min(100).max(900)),
                        medium: nullable(z.number().int().min(100).max(900)),
                        bold: nullable(z.number().int().min(100).max(900))
                    })
                    .strict()
                    .optional()
            })
            .strict()
            .optional(),
        spacing: z
            .object({
                base: nullable(z.number().int().min(4).max(16)),
                density: nullable(themeDensitySchema)
            })
            .strict()
            .optional(),
        shape: z
            .object({
                borderRadius: nullable(z.number().int().min(0).max(24)),
                borderWidth: nullable(z.number().int().min(0).max(4))
            })
            .strict()
            .optional(),
        shadows: z
            .object({
                scale: nullable(themeShadowScaleSchema)
            })
            .strict()
            .optional()
    })
    .strict()

export const themeOverridesSchema = z
    .object({
        shared: themeSharedTokensOverridesSchema.optional(),
        modes: z
            .object({
                light: themeModeColorsOverridesSchema.optional(),
                dark: themeModeColorsOverridesSchema.optional()
            })
            .strict()
            .optional()
    })
    .strict()
export type ThemeOverrides = z.infer<typeof themeOverridesSchema>

const themePresetDbIdSchema = z
    .string()
    .uuid()
    .refine((value) => value[14]?.toLowerCase() === '7', 'DB preset id must be a UUID v7')

export const themePresetRefSchema = z
    .object({
        source: z.enum(['file', 'metahub', 'application']),
        /** File presets are addressed by codename, DB presets by UUID v7. */
        id: z.string().min(1),
        version: z.number().int().positive()
    })
    .strict()
    .superRefine((ref, ctx) => {
        // DB-sourced refs reach SQL `WHERE id = $n` in the stores — a malformed
        // identifier must fail validation (400 THEME_PRESET_INVALID), never a
        // raw PostgreSQL cast error (500).
        if (ref.source === 'file') return
        if (!themePresetDbIdSchema.safeParse(ref.id).success) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['id'], message: 'DB preset id must be a UUID v7' })
        }
    })
export type ThemePresetRef = z.infer<typeof themePresetRefSchema>

export const themeResolvedSchema = z
    .object({
        hash: z.string().regex(THEME_HASH_REGEX),
        tokens: themeTokensSchema
    })
    .strict()
export type ThemeResolved = z.infer<typeof themeResolvedSchema>

/** Server-authored appearance stored inside a layout config (`resolved` is never client-authored). */
export const themeAppearanceSchema = z
    .object({
        mode: z.enum(['system', 'light', 'dark']).default('system'),
        preset: themePresetRefSchema,
        overrides: themeOverridesSchema.default({}),
        resolved: themeResolvedSchema
    })
    .strict()
export type ThemeAppearance = z.infer<typeof themeAppearanceSchema>
export type ThemeAppearanceInput = z.input<typeof themeAppearanceSchema>

/** Anonymous runtime projection: mode + resolved tokens only — no preset reference, no overrides (TZ §11.4). */
export const themePublicAppearanceSchema = themeAppearanceSchema.omit({ preset: true, overrides: true })
export type ThemePublicAppearance = z.infer<typeof themePublicAppearanceSchema>

/** Client-submitted draft (PATCH body) — the server fills `resolved`. */
export const themeAppearanceDraftSchema = themeAppearanceSchema.omit({ resolved: true })
export type ThemeAppearanceDraft = z.infer<typeof themeAppearanceDraftSchema>

/** TZ §10.3: the build-time file-preset envelope (`<codename>.theme.json`). */
export const themeFilePresetEnvelopeSchema = z
    .object({
        $schema: z.string().optional(),
        schemaVersion: z.number().int().positive().default(THEME_TOKENS_SCHEMA_VERSION),
        id: z.string().regex(THEME_PRESET_CODENAME_REGEX),
        version: z.number().int().positive(),
        name: z.record(z.string().min(2).max(8), z.string().min(1)),
        description: z.record(z.string().min(2).max(8), z.string().min(1)).optional(),
        tokens: themeTokensSchema
    })
    .strict()
export type ThemeFilePreset = z.infer<typeof themeFilePresetEnvelopeSchema>

/** Serialized JSON byte size of a value — the client/server-side token cap. */
export const serializedJsonByteSize = (value: unknown): number => JSON.stringify(value ?? null).length

/**
 * WCAG 2.1 relative luminance for #RRGGBB colors (sRGB linearization).
 * Returns `undefined` for colors the token schema would reject.
 */
export const themeColorLuminance = (value: string): number | undefined => {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return undefined
    const hex = value.slice(1)
    const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    if (channels.some((channel) => Number.isNaN(channel))) return undefined
    return channels
        .map((channel) => channel / 255)
        .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
        .reduce((luminance, channel, index) => luminance + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

/** WCAG 2.1 contrast ratio between two #RRGGBB colors; `undefined` when invalid. */
export const themeContrastRatio = (first: string, second: string): number | undefined => {
    const a = themeColorLuminance(first)
    const b = themeColorLuminance(second)
    if (a === undefined || b === undefined) return undefined
    const lighter = Math.max(a, b)
    const darker = Math.min(a, b)
    return (lighter + 0.05) / (darker + 0.05)
}

export interface ThemeContrastIssue {
    /** `light:text.primary/background.default` style pair identifier for localization. */
    pair: string
    mode: 'light' | 'dark'
    ratio: number
    minimum: number
}

const TEXT_PAIR_MINIMUM = 4.5
const UI_PAIR_MINIMUM = 3

interface ThemeContrastIssueAccumulator {
    errors: ThemeContrastIssue[]
    warnings: ThemeContrastIssue[]
}

const collectModeContrastIssues = (mode: 'light' | 'dark', colors: ThemeModeColors, into: ThemeContrastIssueAccumulator): void => {
    const push = (name: string, first: string, second: string, minimum: number, severity: 'error' | 'warning') => {
        const ratio = themeContrastRatio(first, second)
        if (ratio === undefined || ratio >= minimum) return
        const issue: ThemeContrastIssue = { pair: `${mode}:${name}`, mode, ratio, minimum }
        if (severity === 'error') into.errors.push(issue)
        else into.warnings.push(issue)
    }

    // Blocking text pairs (WCAG 1.4.3): layout preset saves are rejected.
    // These are the page-surface text colors the whole UI reads by.
    push('text.primary/background.default', colors.text.primary, colors.background.default, TEXT_PAIR_MINIMUM, 'error')
    push('text.primary/background.paper', colors.text.primary, colors.background.paper, TEXT_PAIR_MINIMUM, 'error')
    push('text.secondary/background.default', colors.text.secondary, colors.background.default, TEXT_PAIR_MINIMUM, 'error')
    push('text.secondary/background.paper', colors.text.secondary, colors.background.paper, TEXT_PAIR_MINIMUM, 'error')

    // Non-blocking UI pairs (WCAG 1.4.11): surfaced as pre-save warnings.
    // `contrastText` pairs warn rather than block: the platform's own default
    // (brand400 main + brand50 contrastText) sits at ~3.7:1, so blocking here
    // would reject the universo-default preset itself. Dividers are decorative
    // separators, not component boundaries — exempt.
    push('primary.contrastText/primary.main', colors.primary.contrastText, colors.primary.main, TEXT_PAIR_MINIMUM, 'warning')
    push('secondary.contrastText/secondary.main', colors.secondary.contrastText, colors.secondary.main, TEXT_PAIR_MINIMUM, 'warning')
    push('primary.main/background.default', colors.primary.main, colors.background.default, UI_PAIR_MINIMUM, 'warning')
    push('primary.main/background.paper', colors.primary.main, colors.background.paper, UI_PAIR_MINIMUM, 'warning')
    push('secondary.main/background.default', colors.secondary.main, colors.background.default, UI_PAIR_MINIMUM, 'warning')
    push('secondary.main/background.paper', colors.secondary.main, colors.background.paper, UI_PAIR_MINIMUM, 'warning')
}

/**
 * TZ FR-019/FR-020: blocking errors for page-surface text pairs, non-blocking
 * warnings for component pairs (contrastText, brand-on-background — see the
 * plan's Pinned Decision 11 and the owner-confirmed semantics above).
 */
export const themeContrastIssues = (tokens: ThemeTokens): { errors: ThemeContrastIssue[]; warnings: ThemeContrastIssue[] } => {
    const accumulator: ThemeContrastIssueAccumulator = { errors: [], warnings: [] }
    collectModeContrastIssues('light', tokens.modes.light, accumulator)
    collectModeContrastIssues('dark', tokens.modes.dark, accumulator)
    return accumulator
}

/** TZ §11.5 error codes. */
export const THEME_PRESET_ERROR_CODES = {
    notFound: 'THEME_PRESET_NOT_FOUND',
    invalid: 'THEME_PRESET_INVALID',
    versionConflict: 'THEME_PRESET_VERSION_CONFLICT',
    inUse: 'THEME_PRESET_IN_USE',
    scopeForbidden: 'THEME_PRESET_SCOPE_FORBIDDEN',
    sourceUnavailable: 'THEME_PRESET_SOURCE_UNAVAILABLE',
    resolveFailed: 'THEME_APPEARANCE_RESOLVE_FAILED',
    exportFailed: 'THEME_EXPORT_FAILED',
    limitReached: 'THEME_PRESET_LIMIT_REACHED'
} as const
export type ThemePresetErrorCode = (typeof THEME_PRESET_ERROR_CODES)[keyof typeof THEME_PRESET_ERROR_CODES]
