import type { Request } from 'express'
import { z } from 'zod'
import { validateListQuery } from '../../shared/queryParams'
import type { DbExecutor } from '../../../utils'
import { database, localizedContent, validation } from '@universo/utils'
import { applyRlsContext } from '@universo/auth-backend'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { MetahubBranchesService } from '../services/MetahubBranchesService'
import type { BranchCopyOptions, BranchCopyOptionsInput, VersionedLocalizedContent } from '@universo/types'
import type { createMetahubHandlerFactory, MetahubHandlerContext } from '../../shared/createMetahubHandler'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { getCodenameSettings, codenameErrorMessage } from '../../shared/codenameStyleHelper'
import {
    getCodenamePayloadText,
    optionalCodenamePayloadSchema,
    requiredCodenamePayloadSchema,
    syncOptionalCodenamePayloadText
} from '../../shared/codenamePayload'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const { normalizeBranchCopyOptions } = validation

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const sourceBranchIdSchema = z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().uuid().optional())

const createBranchSchema = z
    .object({
        codename: requiredCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        sourceBranchId: sourceBranchIdSchema,
        fullCopy: z.boolean().optional(),
        copyLayouts: z.boolean().optional(),
        copyTreeEntities: z.boolean().optional(),
        copyLinkedCollections: z.boolean().optional(),
        copyValueGroups: z.boolean().optional(),
        copyOptionLists: z.boolean().optional(),
        copyHubs: z.boolean().optional(),
        copyCatalogs: z.boolean().optional(),
        copySets: z.boolean().optional(),
        copyEnumerations: z.boolean().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        const aliasPairs = [
            ['copyTreeEntities', 'copyHubs'],
            ['copyLinkedCollections', 'copyCatalogs'],
            ['copyValueGroups', 'copySets'],
            ['copyOptionLists', 'copyEnumerations']
        ] as const

        for (const [canonicalKey, legacyKey] of aliasPairs) {
            const canonicalValue = value[canonicalKey]
            const legacyValue = value[legacyKey]

            if (canonicalValue !== undefined && legacyValue !== undefined && canonicalValue !== legacyValue) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [canonicalKey],
                    message: `${canonicalKey} conflicts with legacy alias ${legacyKey}`
                })
            }
        }

        const childFlags = [
            value.copyLayouts,
            value.copyTreeEntities ?? value.copyHubs,
            value.copyLinkedCollections ?? value.copyCatalogs,
            value.copyValueGroups ?? value.copySets,
            value.copyOptionLists ?? value.copyEnumerations
        ]
        const hasExplicitChildDisabled = childFlags.some((flag) => flag === false)

        if (value.fullCopy === true && hasExplicitChildDisabled) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['fullCopy'],
                message: 'fullCopy=true requires all copy options enabled'
            })
        }
    })

const updateBranchSchema = z
    .object({
        codename: optionalCodenamePayloadSchema,
        name: localizedInputSchema.optional(),
        description: optionalLocalizedInputSchema.optional(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getNormalizedBranchCopyOptionsInput = (value: z.infer<typeof createBranchSchema>): BranchCopyOptionsInput => ({
    fullCopy: value.fullCopy,
    copyLayouts: value.copyLayouts,
    copyTreeEntities: value.copyTreeEntities ?? value.copyHubs,
    copyLinkedCollections: value.copyLinkedCollections ?? value.copyCatalogs,
    copyValueGroups: value.copyValueGroups ?? value.copySets,
    copyOptionLists: value.copyOptionLists ?? value.copyEnumerations
})

const getBranchCopyCompatibilityErrorCode = (
    error: unknown
): 'BRANCH_COPY_OPTION_LIST_REFERENCES' | 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES' | null => {
    if (!error || typeof error !== 'object') return null
    const code = (error as { code?: unknown }).code ?? (error as { message?: unknown }).message

    if (code === 'BRANCH_COPY_OPTION_LIST_REFERENCES' || code === 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES') {
        return code
    }
    if (code === 'BRANCH_COPY_ENUM_REFERENCES') {
        return 'BRANCH_COPY_OPTION_LIST_REFERENCES'
    }
    if (code === 'BRANCH_COPY_DANGLING_REFERENCES') {
        return 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES'
    }

    return null
}

const resolveBearerAccessToken = (req: Request): string | null => {
    const headerValue = req.headers.authorization ?? req.headers.Authorization
    if (typeof headerValue !== 'string') return null
    return headerValue.startsWith('Bearer ') ? headerValue.slice(7) : null
}

const applyRlsContextToExecutor = async (executor: Pick<DbExecutor, 'query' | 'isReleased'>, accessToken: string): Promise<void> => {
    await applyRlsContext(
        {
            query: executor.query,
            isReleased: executor.isReleased
        },
        accessToken
    )
}

const runCommittedRlsTransaction = async <T>(
    executor: DbExecutor,
    accessToken: string,
    work: (tx: DbExecutor) => Promise<T>
): Promise<T> => {
    return executor.transaction(async (tx) => {
        await applyRlsContextToExecutor(tx, accessToken)
        return work(tx)
    })
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createBranchesController(createHandler: ReturnType<typeof createMetahubHandlerFactory>, getDbExecutor: () => DbExecutor) {
    const getService = (exec: DbExecutor) => new MetahubBranchesService(exec)

    const getSettingsService = (ctx: MetahubHandlerContext) => new MetahubSettingsService(ctx.exec, ctx.schemaService)

    const listOptions = createHandler(async ({ req, res, metahubId, userId, exec }) => {
        const branchesService = getService(exec)

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { sortBy, sortOrder, search } = validatedQuery
        const branchSortBy = sortBy === 'sortOrder' ? 'updated' : sortBy
        const { branches } = await branchesService.listAllBranches(metahubId, {
            sortBy: branchSortBy,
            sortOrder,
            search
        })

        const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
        const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
        const effectiveActiveId = activeBranchId ?? defaultBranchId

        const items = branches.map((branch) => ({
            id: branch.id,
            metahubId,
            codename: branch.codename,
            name: branch.name,
            description: branch.description,
            sourceBranchId: branch.sourceBranchId ?? null,
            branchNumber: branch.branchNumber,
            version: branch._uplVersion || 1,
            createdAt: branch._uplCreatedAt,
            updatedAt: branch._uplUpdatedAt,
            isDefault: branch.id === defaultBranchId,
            isActive: branch.id === effectiveActiveId
        }))

        res.json({
            items,
            total: items.length,
            meta: { defaultBranchId, activeBranchId: effectiveActiveId }
        })
    })

    const list = createHandler(async ({ req, res, metahubId, userId, exec }) => {
        const branchesService = getService(exec)

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { limit, offset, sortBy, sortOrder, search } = validatedQuery
        const branchSortBy = sortBy === 'sortOrder' ? 'updated' : sortBy
        const { branches, total } = await branchesService.listBranches(metahubId, {
            limit,
            offset,
            sortBy: branchSortBy,
            sortOrder,
            search
        })

        const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
        const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
        const effectiveActiveId = activeBranchId ?? defaultBranchId

        const items = branches.map((branch) => ({
            id: branch.id,
            metahubId,
            codename: branch.codename,
            name: branch.name,
            description: branch.description,
            sourceBranchId: branch.sourceBranchId ?? null,
            branchNumber: branch.branchNumber,
            version: branch._uplVersion || 1,
            createdAt: branch._uplCreatedAt,
            updatedAt: branch._uplUpdatedAt,
            isDefault: branch.id === defaultBranchId,
            isActive: branch.id === effectiveActiveId
        }))

        res.json({
            items,
            pagination: { total, limit, offset },
            meta: { defaultBranchId, activeBranchId: effectiveActiveId }
        })
    })

    const getById = createHandler(async ({ req, res, metahubId, userId, exec }) => {
        const { branchId } = req.params
        const branchesService = getService(exec)

        const branch = await branchesService.getBranchById(metahubId, branchId)
        if (!branch) {
            return res.json({
                branchId,
                blockingUsers: [],
                canDelete: false,
                isDefault: false
            })
        }

        const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
        const activeBranchId = userId ? await branchesService.getUserActiveBranchId(metahubId, userId) : null
        const effectiveActiveId = activeBranchId ?? defaultBranchId

        res.json({
            id: branch.id,
            metahubId,
            codename: branch.codename,
            name: branch.name,
            description: branch.description,
            branchNumber: branch.branchNumber,
            version: branch._uplVersion || 1,
            createdAt: branch._uplCreatedAt,
            updatedAt: branch._uplUpdatedAt,
            isDefault: branch.id === defaultBranchId,
            isActive: branch.id === effectiveActiveId,
            ...(await branchesService.getBranchLineage(metahubId, branchId))
        })
    })

    const create = createHandler(
        async (ctx) => {
            const { req, res, metahubId, userId, exec } = ctx
            const accessToken = resolveBearerAccessToken(req)
            const rootExec = getDbExecutor()

            const branchesService = getService(exec)

            const parsed = createBranchSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, namePrimaryLocale, descriptionPrimaryLocale, sourceBranchId } = parsed.data
            const copyOptions: BranchCopyOptions = normalizeBranchCopyOptions(getNormalizedBranchCopyOptionsInput(parsed.data))

            const settingsService = getSettingsService(ctx)
            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                })
            }

            const existing = await branchesService.findByCodename(metahubId, normalizedCodename)
            if (existing) {
                return res.status(409).json({
                    code: 'BRANCH_CODENAME_EXISTS',
                    error: 'Branch with this codename already exists'
                })
            }

            const sanitizedName = sanitizeLocalizedInput(name ?? {})
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (description) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                }
            }

            const codenameVlc = syncOptionalCodenamePayloadText(codename, namePrimaryLocale ?? 'en', normalizedCodename)
            if (!codenameVlc) {
                return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
            }

            try {
                const branch = accessToken
                    ? await runCommittedRlsTransaction(rootExec, accessToken, async (tx) => {
                          const transactionalService = new MetahubBranchesService(tx)
                          return transactionalService.createBranch({
                              metahubId,
                              sourceBranchId: sourceBranchId ?? null,
                              codename: codenameVlc,
                              name: nameVlc,
                              description: descriptionVlc ?? null,
                              copyOptions,
                              createdBy: userId
                          })
                      })
                    : await branchesService.createBranch({
                          metahubId,
                          sourceBranchId: sourceBranchId ?? null,
                          codename: codenameVlc,
                          name: nameVlc,
                          description: descriptionVlc ?? null,
                          copyOptions,
                          createdBy: userId
                      })

                res.status(201).json({
                    id: branch.id,
                    metahubId,
                    codename: branch.codename,
                    name: branch.name,
                    description: branch.description,
                    sourceBranchId: branch.sourceBranchId ?? null,
                    branchNumber: branch.branchNumber,
                    version: branch._uplVersion || 1,
                    createdAt: branch._uplCreatedAt,
                    updatedAt: branch._uplUpdatedAt
                })
            } catch (error: unknown) {
                const branchCopyErrorCode = getBranchCopyCompatibilityErrorCode(error)
                if (branchCopyErrorCode === 'BRANCH_COPY_OPTION_LIST_REFERENCES') {
                    return res.status(400).json({
                        code: 'BRANCH_COPY_OPTION_LIST_REFERENCES',
                        error: 'Cannot disable enumeration copy while copied entity groups still reference enumerations.'
                    })
                }
                if (branchCopyErrorCode === 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES') {
                    return res.status(400).json({
                        code: 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES',
                        error: 'Copy options would produce dangling entity references. Keep all referenced entity groups enabled.'
                    })
                }
                if (database.isUniqueViolation(error)) {
                    const constraint = database.getDbErrorConstraint(error)
                    if (constraint === 'idx_branches_metahub_codename_active') {
                        return res.status(409).json({
                            code: 'BRANCH_CODENAME_EXISTS',
                            error: 'Branch with this codename already exists'
                        })
                    }
                    if (constraint === 'idx_branches_metahub_number_active' || constraint === 'metahubs_branches_schema_name_key') {
                        return res.status(409).json({
                            code: 'BRANCH_NUMBER_CONFLICT',
                            error: 'Branch numbering conflict. Please retry.'
                        })
                    }
                    return res.status(409).json({
                        code: 'BRANCH_UNIQUE_CONFLICT',
                        error: 'Branch creation failed due to unique constraint conflict'
                    })
                }
                throw error
            }
        },
        { permission: 'manageMetahub' }
    )

    const update = createHandler(
        async (ctx) => {
            const { req, res, metahubId, userId, exec } = ctx
            const { branchId } = req.params
            const branchesService = getService(exec)

            const parsed = updateBranchSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues })
            }

            const { codename, name, description, namePrimaryLocale, descriptionPrimaryLocale, expectedVersion } = parsed.data
            const updateData: {
                codename?: VersionedLocalizedContent<string>
                name?: VersionedLocalizedContent<string>
                description?: VersionedLocalizedContent<string> | null
                expectedVersion?: number
                updatedBy?: string | null
            } = {}

            if (codename !== undefined) {
                const settingsService = getSettingsService(ctx)
                const {
                    style: codenameStyle,
                    alphabet: codenameAlphabet,
                    allowMixed
                } = await getCodenameSettings(settingsService, metahubId, userId)
                const normalizedCodename = normalizeCodenameForStyle(getCodenamePayloadText(codename), codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: { codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)] }
                    })
                }

                const existing = await branchesService.findByCodename(metahubId, normalizedCodename)
                if (existing && existing.id !== branchId) {
                    return res.status(409).json({
                        code: 'BRANCH_CODENAME_EXISTS',
                        error: 'Branch with this codename already exists'
                    })
                }
                const nextCodename = syncOptionalCodenamePayloadText(codename, namePrimaryLocale ?? 'en', normalizedCodename)
                if (!nextCodename) {
                    return res.status(400).json({ error: 'Validation failed', details: { codename: ['Codename is required'] } })
                }
                updateData.codename = nextCodename
            }

            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
                }
                const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
                if (nameVlc) {
                    updateData.name = nameVlc
                }
            }

            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                updateData.description =
                    Object.keys(sanitizedDescription).length > 0
                        ? buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
                        : null
            }

            if (expectedVersion !== undefined) {
                updateData.expectedVersion = expectedVersion
            }

            updateData.updatedBy = userId

            const updated = await branchesService.updateBranch(metahubId, branchId, updateData)
            res.json({
                id: updated.id,
                metahubId,
                codename: updated.codename,
                name: updated.name,
                description: updated.description,
                sourceBranchId: updated.sourceBranchId ?? null,
                branchNumber: updated.branchNumber,
                version: updated._uplVersion || 1,
                createdAt: updated._uplCreatedAt,
                updatedAt: updated._uplUpdatedAt
            })
        },
        { permission: 'manageMetahub' }
    )

    const activate = createHandler(async ({ req, res, metahubId, userId, exec }) => {
        const { branchId } = req.params
        const branchesService = getService(exec)

        const branch = await branchesService.activateBranch(metahubId, branchId, userId)
        res.json({ metahubId, branchId: branch.id })
    })

    const setDefault = createHandler(
        async ({ req, res, metahubId, exec }) => {
            const { branchId } = req.params
            const branchesService = getService(exec)

            const branch = await branchesService.setDefaultBranch(metahubId, branchId)
            res.json({ metahubId, branchId: branch.id })
        },
        { permission: 'manageMetahub' }
    )

    const blockingUsers = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const { branchId } = req.params
            const branchesService = getService(exec)

            const branch = await branchesService.getBranchById(metahubId, branchId)
            if (!branch) {
                return res.status(404).json({ error: 'Branch not found' })
            }

            const defaultBranchId = await branchesService.getDefaultBranchId(metahubId)
            const users = await branchesService.getBlockingUsers(metahubId, branchId, userId ?? undefined)

            res.json({
                branchId,
                blockingUsers: users,
                canDelete: users.length === 0 && branch.id !== defaultBranchId,
                isDefault: branch.id === defaultBranchId
            })
        },
        { permission: 'manageMetahub' }
    )

    const remove = createHandler(
        async ({ req, res, metahubId, userId, exec }) => {
            const { branchId } = req.params
            const branchesService = getService(exec)

            const users = await branchesService.getBlockingUsers(metahubId, branchId, userId)
            if (users.length > 0) {
                return res.status(409).json({
                    error: 'Branch is active for other users',
                    blockingUsers: users
                })
            }

            await branchesService.deleteBranch({ metahubId, branchId, requesterId: userId })
            res.status(204).send()
        },
        { permission: 'manageMetahub' }
    )

    return { listOptions, list, getById, create, update, activate, setDefault, blockingUsers, remove }
}
