import { z } from 'zod'
import type { PackageAttachmentConfig, PackageAuthoringSurfaceDescriptor, PackageDisplayMode } from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'

const displayModes = ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'] as const satisfies readonly PackageDisplayMode[]
const playcanvasEditorArtifactModes = ['artifact-only', 'universo-hosted'] as const

const packageAttachmentEmptyConfigSchema = z
    .object({
        schemaVersion: z.literal('1'),
        kind: z.literal('none')
    })
    .strict()

const packageAttachmentDisplayConfigSchema = z
    .object({
        schemaVersion: z.literal('1'),
        kind: z.literal('display'),
        display: z
            .object({
                mode: z.enum(displayModes),
                developmentUrl: z.string().url().max(2048).nullable().optional(),
                showArtifactOnlyNotice: z.boolean()
            })
            .strict(),
        playcanvasProject: z
            .object({
                defaultProjectId: z.string().uuid().nullable()
            })
            .strict()
            .optional()
    })
    .strict()

export const packageAttachmentConfigSchema = z.discriminatedUnion('kind', [
    packageAttachmentEmptyConfigSchema,
    packageAttachmentDisplayConfigSchema
])

export const packageAuthoringSurfaceSchema = z
    .discriminatedUnion('kind', [
        z
            .object({
                schemaVersion: z.literal('1'),
                kind: z.literal('none'),
                supportedDisplayModes: z.tuple([]),
                defaultConfig: z
                    .object({
                        schemaVersion: z.literal('1'),
                        kind: z.literal('none')
                    })
                    .strict()
            })
            .strict(),
        z
            .object({
                schemaVersion: z.literal('1'),
                kind: z.literal('playcanvasEditor'),
                packageSlug: z
                    .string()
                    .trim()
                    .min(1)
                    .max(96)
                    .regex(/^[a-z0-9][a-z0-9-]*$/),
                supportedDisplayModes: z.array(z.enum(displayModes)).min(1),
                defaultConfig: packageAttachmentDisplayConfigSchema,
                artifact: z
                    .object({
                        packageName: z.literal('@universo-react/playcanvas-editor'),
                        manifestFileName: z.literal('universo-artifact-manifest.json'),
                        outputRoot: z.literal('dist/editor'),
                        smokeMode: z.enum(playcanvasEditorArtifactModes),
                        mode: z.enum(playcanvasEditorArtifactModes).optional()
                    })
                    .strict()
            })
            .strict()
    ])
    .superRefine((value, ctx) => {
        if (value.kind === 'playcanvasEditor') {
            if (new Set(value.supportedDisplayModes).size !== value.supportedDisplayModes.length) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['supportedDisplayModes'],
                    message: 'Display modes must be unique'
                })
            }

            if (value.defaultConfig.kind !== 'display') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultConfig'],
                    message: 'PlayCanvas Editor requires display default config'
                })
                return
            }

            if (!value.supportedDisplayModes.includes(value.defaultConfig.display.mode)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultConfig', 'display', 'mode'],
                    message: 'Default display mode must be supported'
                })
            }

            if (value.defaultConfig.display.developmentUrl) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultConfig', 'display', 'developmentUrl'],
                    message: 'Default development URL must be empty'
                })
            }
        }
    })

export const parsePackageAttachmentConfig = (value: unknown): PackageAttachmentConfig => {
    const parsed = packageAttachmentConfigSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('Invalid package config payload', { details: parsed.error.flatten() })
    }
    return parsed.data
}

export const parsePackageAuthoringSurface = (value: unknown): PackageAuthoringSurfaceDescriptor => {
    const parsed = packageAuthoringSurfaceSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('Invalid package authoring surface descriptor', { details: parsed.error.flatten() })
    }
    return parsed.data
}

export const resolvePackageAuthoringSurface = (value: unknown): PackageAuthoringSurfaceDescriptor => {
    if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
        return {
            schemaVersion: '1',
            kind: 'none',
            supportedDisplayModes: [],
            defaultConfig: {
                schemaVersion: '1',
                kind: 'none'
            }
        }
    }

    return parsePackageAuthoringSurface(value)
}

const normalizeDevelopmentUrlOrigin = (value: string): string | null => {
    try {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            return null
        }
        return parsed.origin
    } catch {
        return null
    }
}

const getAllowedDevelopmentUrlOrigins = (): string[] =>
    Array.from(
        new Set(
            (process.env.PLAYCANVAS_EDITOR_DEVELOPMENT_URLS ?? '')
                .split(',')
                .map((origin) => normalizeDevelopmentUrlOrigin(origin.trim()))
                .filter((origin): origin is string => Boolean(origin))
        )
    )

export const isDevelopmentUrlModeEnabled = (): boolean => getAllowedDevelopmentUrlOrigins().length > 0

export const validateDevelopmentUrl = (value: string | null | undefined): void => {
    if (!value) {
        throw new MetahubValidationError('Development URL is required')
    }

    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        throw new MetahubValidationError('Development URL is invalid')
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new MetahubValidationError('Development URL is invalid')
    }

    const allowedOrigins = getAllowedDevelopmentUrlOrigins()

    if (allowedOrigins.length === 0 || !allowedOrigins.includes(parsed.origin)) {
        throw new MetahubValidationError('Development URL is not allowed')
    }
}

export const resolveAllowedPackageDisplayModes = (authoringSurface: PackageAuthoringSurfaceDescriptor): PackageDisplayMode[] => {
    if (authoringSurface.kind === 'none') {
        return []
    }

    return authoringSurface.supportedDisplayModes.filter((mode) => mode !== 'developmentUrl' || isDevelopmentUrlModeEnabled())
}

export const resolvePackageAttachmentConfig = (
    value: unknown,
    authoringSurface: PackageAuthoringSurfaceDescriptor,
    options?: { validateDevelopmentUrlAllowlist?: boolean }
): PackageAttachmentConfig => {
    const validateDevelopmentUrlAllowlist = options?.validateDevelopmentUrlAllowlist ?? true
    const config = parsePackageAttachmentConfig(value)

    if (authoringSurface.kind === 'none') {
        if (config.kind !== 'none') {
            throw new MetahubValidationError('Package does not support display settings')
        }
        return config
    }

    if (config.kind !== 'display') {
        throw new MetahubValidationError('Package display settings are required')
    }

    if (!authoringSurface.supportedDisplayModes.includes(config.display.mode)) {
        throw new MetahubValidationError('Package display mode is not supported')
    }

    const normalized: PackageAttachmentConfig = {
        schemaVersion: '1',
        kind: 'display',
        display: {
            mode: config.display.mode,
            developmentUrl: config.display.mode === 'developmentUrl' ? config.display.developmentUrl ?? null : null,
            showArtifactOnlyNotice: config.display.showArtifactOnlyNotice
        },
        playcanvasProject: config.playcanvasProject
            ? {
                  defaultProjectId: config.playcanvasProject.defaultProjectId
              }
            : undefined
    }

    if (normalized.display.mode === 'developmentUrl' && validateDevelopmentUrlAllowlist) {
        validateDevelopmentUrl(normalized.display.developmentUrl)
    }

    return normalized
}

export const resolveStoredPackageAttachmentConfig = (
    value: unknown,
    authoringSurface: PackageAuthoringSurfaceDescriptor
): PackageAttachmentConfig =>
    resolvePackageAttachmentConfig(value, authoringSurface, {
        validateDevelopmentUrlAllowlist: false
    })

export const resolveDefaultPackageAttachmentConfig = (authoringSurface: PackageAuthoringSurfaceDescriptor): PackageAttachmentConfig =>
    resolvePackageAttachmentConfig(authoringSurface.defaultConfig, authoringSurface)

export const resolveCompatiblePackageAttachmentConfig = (
    value: unknown,
    authoringSurface: PackageAuthoringSurfaceDescriptor
): PackageAttachmentConfig => {
    try {
        return resolvePackageAttachmentConfig(value, authoringSurface)
    } catch {
        return resolveDefaultPackageAttachmentConfig(authoringSurface)
    }
}

export const resolveCompatiblePackageAttachmentConfigOrThrow = (
    value: unknown,
    authoringSurface: PackageAuthoringSurfaceDescriptor
): PackageAttachmentConfig => {
    try {
        return resolvePackageAttachmentConfig(value, authoringSurface)
    } catch {
        throw new MetahubValidationError('Package display settings are not compatible with the selected package version', {
            resetConfigRequired: true
        })
    }
}
