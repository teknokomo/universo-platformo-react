import { z } from 'zod'
import { localizedContent } from '@universo-react/utils'
import {
    MODULE_AUTHORING_SOURCE_KINDS,
    MODULE_CAPABILITIES,
    MODULE_ROLES,
    isModuleAttachmentKind,
    type ModuleAttachmentKind
} from '@universo-react/types'
import type { createMetahubHandlerFactory } from '../../shared/createMetahubHandler'
import { MetahubModulesService } from '../services/MetahubModulesService'
import { MetahubValidationError } from '../../shared/domainErrors'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent

const optionalBooleanFromQuery = z.preprocess((value) => {
    if (value === undefined) return undefined
    return value === 'true' || value === true
}, z.boolean().optional())

const localizedInputSchema = z.union([z.string().min(1), z.record(z.string().min(1))])
const moduleAttachmentKindSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => isModuleAttachmentKind(value), { message: 'Invalid module attachment kind' })
    .transform((value): ModuleAttachmentKind => value)

const listModulesQuerySchema = z.object({
    attachedToKind: moduleAttachmentKindSchema.optional(),
    attachedToId: z.string().uuid().optional(),
    onlyActive: optionalBooleanFromQuery
})

const createModuleSchema = z
    .object({
        codename: z.string().min(1).max(100),
        name: localizedInputSchema,
        description: z.union([localizedInputSchema, z.null()]).optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        attachedToKind: moduleAttachmentKindSchema,
        attachedToId: z.string().uuid().nullable().optional(),
        moduleRole: z.enum(MODULE_ROLES).optional(),
        sourceKind: z.enum(MODULE_AUTHORING_SOURCE_KINDS).optional(),
        sdkApiVersion: z.string().min(1).max(40).optional(),
        sourceCode: z.string().min(1),
        isActive: z.boolean().optional(),
        capabilities: z.array(z.enum(MODULE_CAPABILITIES)).max(50).optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

const updateModuleSchema = z
    .object({
        codename: z.string().min(1).max(100).optional(),
        name: localizedInputSchema.optional(),
        description: z.union([localizedInputSchema, z.null()]).optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        attachedToKind: moduleAttachmentKindSchema.optional(),
        attachedToId: z.string().uuid().nullable().optional(),
        moduleRole: z.enum(MODULE_ROLES).optional(),
        sourceKind: z.enum(MODULE_AUTHORING_SOURCE_KINDS).optional(),
        sdkApiVersion: z.string().min(1).max(40).optional(),
        sourceCode: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        capabilities: z.array(z.enum(MODULE_CAPABILITIES)).max(50).optional(),
        config: z.record(z.unknown()).optional()
    })
    .strict()

const toLocalizedRecord = (value: z.infer<typeof localizedInputSchema>): Record<string, string> => {
    if (typeof value === 'string') {
        return { en: value }
    }
    return value
}

const buildPresentation = (input: {
    name: z.infer<typeof localizedInputSchema>
    description?: z.infer<typeof localizedInputSchema> | null
    namePrimaryLocale?: string
    descriptionPrimaryLocale?: string
}) => {
    const sanitizedName = sanitizeLocalizedInput(toLocalizedRecord(input.name))
    const name = buildLocalizedContent(sanitizedName, input.namePrimaryLocale, 'en')
    if (!name) {
        throw new MetahubValidationError('Module name is required')
    }

    let description: ReturnType<typeof buildLocalizedContent> | null | undefined = undefined
    if (input.description === null) {
        description = null
    } else if (input.description !== undefined) {
        const sanitizedDescription = sanitizeLocalizedInput(toLocalizedRecord(input.description))
        description =
            Object.keys(sanitizedDescription).length > 0
                ? buildLocalizedContent(sanitizedDescription, input.descriptionPrimaryLocale, input.namePrimaryLocale ?? 'en')
                : null
    }

    return {
        name,
        description
    }
}

const mergePresentation = (existing: { name: unknown; description?: unknown }, input: z.infer<typeof updateModuleSchema>) => {
    const existingName = existing.name && typeof existing.name === 'object' ? (existing.name as Record<string, unknown>) : {}
    const nextNameInput = input.name ? sanitizeLocalizedInput(toLocalizedRecord(input.name)) : undefined
    const namePrimaryLocale =
        input.namePrimaryLocale ?? (typeof existingName._primary === 'string' ? existingName._primary : undefined) ?? 'en'
    const name =
        nextNameInput !== undefined
            ? buildLocalizedContent(nextNameInput, input.namePrimaryLocale, namePrimaryLocale)
            : (existing.name as ReturnType<typeof buildLocalizedContent>)

    if (!name) {
        throw new MetahubValidationError('Module name is required')
    }

    let description = existing.description as ReturnType<typeof buildLocalizedContent> | null | undefined
    if (input.description === null) {
        description = null
    } else if (input.description !== undefined) {
        const sanitizedDescription = sanitizeLocalizedInput(toLocalizedRecord(input.description))
        description =
            Object.keys(sanitizedDescription).length > 0
                ? buildLocalizedContent(sanitizedDescription, input.descriptionPrimaryLocale, input.namePrimaryLocale ?? namePrimaryLocale)
                : null
    }

    return { name, description }
}

const normalizeAttachmentId = (attachedToKind: ModuleAttachmentKind, attachedToId?: string | null): string | null | undefined => {
    if (attachedToKind === 'metahub' || attachedToKind === 'general') {
        return null
    }
    return attachedToId ?? null
}

export function createModulesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>) {
    const list = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = listModulesQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const modulesService = new MetahubModulesService(exec, schemaService)
            const items = await modulesService.listModules(
                metahubId,
                {
                    ...parsed.data,
                    attachedToKind: parsed.data.attachedToKind ?? undefined
                },
                userId
            )
            return res.json({ items })
        },
        { permission: 'manageMetahub' }
    )

    const create = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = createModuleSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const modulesService = new MetahubModulesService(exec, schemaService)
            const created = await modulesService.createModule(
                metahubId,
                {
                    codename: parsed.data.codename,
                    presentation: buildPresentation(parsed.data),
                    attachedToKind: parsed.data.attachedToKind,
                    attachedToId: normalizeAttachmentId(parsed.data.attachedToKind, parsed.data.attachedToId),
                    moduleRole: parsed.data.moduleRole,
                    sourceKind: parsed.data.sourceKind,
                    sdkApiVersion: parsed.data.sdkApiVersion,
                    sourceCode: parsed.data.sourceCode,
                    isActive: parsed.data.isActive,
                    capabilities: parsed.data.capabilities,
                    config: parsed.data.config
                },
                userId
            )

            return res.status(201).json(created)
        },
        { permission: 'manageMetahub' }
    )

    const getById = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const modulesService = new MetahubModulesService(exec, schemaService)
            const module = await modulesService.getModuleById(metahubId, req.params.moduleId, userId)
            if (!module) {
                return res.status(404).json({ error: 'Module not found' })
            }
            return res.json(module)
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const parsed = updateModuleSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const modulesService = new MetahubModulesService(exec, schemaService)
            const existing = await modulesService.getModuleById(metahubId, req.params.moduleId, userId)
            if (!existing) {
                return res.status(404).json({ error: 'Module not found' })
            }

            const attachedToKind = parsed.data.attachedToKind === undefined ? undefined : parsed.data.attachedToKind

            const updated = await modulesService.updateModule(
                metahubId,
                req.params.moduleId,
                {
                    codename: parsed.data.codename,
                    presentation:
                        parsed.data.name !== undefined || parsed.data.description !== undefined
                            ? mergePresentation(existing.presentation, parsed.data)
                            : undefined,
                    attachedToKind,
                    attachedToId:
                        attachedToKind !== undefined
                            ? normalizeAttachmentId(attachedToKind, parsed.data.attachedToId)
                            : parsed.data.attachedToId,
                    moduleRole: parsed.data.moduleRole,
                    sourceKind: parsed.data.sourceKind,
                    sdkApiVersion: parsed.data.sdkApiVersion,
                    sourceCode: parsed.data.sourceCode,
                    isActive: parsed.data.isActive,
                    capabilities: parsed.data.capabilities,
                    config: parsed.data.config
                },
                userId
            )

            return res.json(updated)
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec, schemaService }) => {
            const modulesService = new MetahubModulesService(exec, schemaService)
            await modulesService.deleteModule(metahubId, req.params.moduleId, userId)
            return res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { list, create, getById, update, remove }
}
