import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { z } from 'zod'
import { ListQuerySchema } from '../../shared/queryParams'
import { getRequestDbExecutor, type DbExecutor } from '../../../utils'
import { localizedContent, toNumberRules, validateNumber } from '@universo/utils'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { ConstantDataType, CONSTANT_DATA_TYPES } from '@universo/types'
import type { ConstantCopyOptions } from '@universo/types'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubConstantsService } from '../../metahubs/services/MetahubConstantsService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubSettingsService } from '../../settings/services/MetahubSettingsService'
import { ensureMetahubAccess } from '../../shared/guards'
import {
    getCodenameSettings,
    getAllowedConstantTypes,
    getAllowConstantCopy,
    getAllowConstantDelete,
    codenameErrorMessage,
    buildCodenameAttempt,
    CODENAME_RETRY_MAX_ATTEMPTS
} from '../../shared/codenameStyleHelper'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as any).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}

const ConstantsListQuerySchema = ListQuerySchema.extend({
    sortBy: z.enum(['name', 'created', 'updated', 'codename', 'sortOrder']).default('sortOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    locale: z.string().trim().min(2).max(10).optional()
})

const validateConstantsListQuery = (query: unknown) => ConstantsListQuerySchema.parse(query)

const validationRulesSchema = z
    .object({
        minLength: z.number().int().min(0).max(10000).nullable().optional(),
        maxLength: z.number().int().min(1).max(10000).nullable().optional(),
        pattern: z.string().max(500).nullable().optional(),
        versioned: z.boolean().nullable().optional(),
        localized: z.boolean().nullable().optional(),
        precision: z.number().int().min(1).max(15).nullable().optional(),
        scale: z.number().int().min(0).max(14).nullable().optional(),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        nonNegative: z.boolean().nullable().optional(),
        dateComposition: z.enum(['date', 'time', 'datetime']).nullable().optional()
    })
    .optional()
    .refine(
        (rules) => {
            if (!rules) return true
            if (typeof rules.scale === 'number' && typeof rules.precision === 'number' && rules.scale >= rules.precision) {
                return false
            }
            if (typeof rules.min === 'number' && typeof rules.max === 'number' && rules.min > rules.max) {
                return false
            }
            if (typeof rules.minLength === 'number' && typeof rules.maxLength === 'number' && rules.minLength > rules.maxLength) {
                return false
            }
            return true
        },
        {
            message: 'Invalid validation rules: scale<precision, min<=max, minLength<=maxLength'
        }
    )

const uiConfigSchema = z
    .object({
        widget: z.enum(['text', 'textarea', 'number', 'checkbox', 'date', 'datetime']).optional(),
        placeholder: z.record(z.string()).optional(),
        helpText: z.record(z.string()).optional(),
        hidden: z.boolean().optional(),
        width: z.number().optional()
    })
    .optional()

const localizedInputSchema = z.union([z.string(), z.record(z.string())]).transform((val) => (typeof val === 'string' ? { en: val } : val))

const createConstantSchema = z.object({
    codename: z.string().min(1).max(100),
    codenameInput: localizedInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    dataType: z.enum(CONSTANT_DATA_TYPES),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    value: z.unknown().optional(),
    sortOrder: z.number().int().optional()
})

const updateConstantSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    dataType: z.enum(CONSTANT_DATA_TYPES).optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema,
    value: z.unknown().optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const moveConstantSchema = z.object({
    direction: z.enum(['up', 'down'])
})

const reorderConstantSchema = z
    .object({
        constantId: z.string().uuid(),
        newSortOrder: z.number().int().min(1)
    })
    .strict()

const copyConstantSchema = z.object({
    codename: z.string().min(1).max(100).optional(),
    codenameInput: localizedInputSchema.optional(),
    codenamePrimaryLocale: z.string().optional(),
    name: localizedInputSchema.optional(),
    namePrimaryLocale: z.string().optional(),
    copyValue: z.boolean().optional(),
    validationRules: validationRulesSchema,
    uiConfig: uiConfigSchema
})

const CONSTANT_LIMIT = 100

const buildCodenameLocalizedVlc = (codenameInput: unknown, primaryLocale?: string, fallbackPrimary = 'en'): unknown => {
    if (codenameInput === undefined) return undefined
    const codenameRecord: Record<string, string | undefined> =
        typeof codenameInput === 'string' ? { en: codenameInput } : (codenameInput as Record<string, string | undefined>)
    const sanitizedCodename = sanitizeLocalizedInput(codenameRecord)
    if (Object.keys(sanitizedCodename).length === 0) return null
    return buildLocalizedContent(sanitizedCodename, primaryLocale, fallbackPrimary)
}

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    if (!name || typeof name !== 'object') {
        return { en: 'Copy (copy)' }
    }

    const asRecord = name as Record<string, unknown>
    const locales =
        asRecord.locales && typeof asRecord.locales === 'object'
            ? (asRecord.locales as Record<string, { content?: unknown }>)
            : (asRecord as Record<string, unknown>)

    const result: Record<string, string> = {}
    for (const [locale, entry] of Object.entries(locales)) {
        const content =
            entry && typeof entry === 'object' && 'content' in entry
                ? typeof (entry as { content?: unknown }).content === 'string'
                    ? (entry as { content: string }).content.trim()
                    : ''
                : typeof entry === 'string'
                ? entry.trim()
                : ''
        const suffix = normalizeLocaleCode(locale) === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = content ? `${content}${suffix}` : normalizeLocaleCode(locale) === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
    }

    if (Object.keys(result).length === 0) {
        return { en: 'Copy (copy)' }
    }

    return result
}

const getLocalizedCandidates = (value: unknown): string[] => {
    if (!value || typeof value !== 'object') return []
    const raw = value as Record<string, unknown>

    const locales = raw.locales
    if (locales && typeof locales === 'object') {
        return Object.values(locales as Record<string, unknown>)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
    }

    return Object.values(raw).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

const extractStringValues = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (!value || typeof value !== 'object') return []

    const raw = value as Record<string, unknown>
    if (raw.locales && typeof raw.locales === 'object') {
        return Object.values(raw.locales as Record<string, unknown>)
            .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).content : null))
            .filter((content): content is string => typeof content === 'string')
    }

    return Object.values(raw).filter((entry): entry is string => typeof entry === 'string')
}

const parseConstantValue = (
    dataType: ConstantDataType,
    value: unknown,
    validationRules?: Record<string, unknown>
): { ok: true; value: unknown } | { ok: false; error: string } => {
    const rules = (validationRules ?? {}) as Record<string, unknown>

    if (value === undefined) {
        return { ok: true, value: undefined }
    }

    if (value === null) {
        return { ok: true, value: null }
    }

    if (dataType === ConstantDataType.STRING) {
        const localized = rules.localized === true

        if (!localized && typeof value !== 'string') {
            return { ok: false, error: 'STRING constant value must be a string' }
        }

        if (localized && typeof value !== 'string' && (typeof value !== 'object' || value === null)) {
            return { ok: false, error: 'Localized STRING constant value must be a string or localized object' }
        }

        const strings = extractStringValues(value)
        const minLength = typeof rules.minLength === 'number' ? rules.minLength : null
        const maxLength = typeof rules.maxLength === 'number' ? rules.maxLength : null
        let pattern: RegExp | null = null
        if (typeof rules.pattern === 'string' && rules.pattern.length > 0) {
            try {
                pattern = new RegExp(rules.pattern)
            } catch {
                return { ok: false, error: 'STRING validation pattern is invalid' }
            }
        }

        for (const entry of strings) {
            if (minLength !== null && entry.length < minLength) {
                return { ok: false, error: `STRING value length must be >= ${minLength}` }
            }
            if (maxLength !== null && entry.length > maxLength) {
                return { ok: false, error: `STRING value length must be <= ${maxLength}` }
            }
            if (pattern && !pattern.test(entry)) {
                return { ok: false, error: 'STRING value does not match the pattern' }
            }
        }

        return { ok: true, value }
    }

    if (dataType === ConstantDataType.NUMBER) {
        const normalized = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : NaN
        const validationResult = validateNumber(normalized, {
            ...toNumberRules(rules),
            precision: typeof rules.precision === 'number' ? rules.precision : 10,
            scale: typeof rules.scale === 'number' ? rules.scale : 0
        })
        if (!validationResult.valid) {
            return { ok: false, error: validationResult.errorMessage ?? 'NUMBER constant value is invalid' }
        }

        return { ok: true, value: validationResult.normalizedValue ?? normalized }
    }

    if (dataType === ConstantDataType.BOOLEAN) {
        if (typeof value !== 'boolean') {
            return { ok: false, error: 'BOOLEAN constant value must be true/false' }
        }
        return { ok: true, value }
    }

    if (dataType === ConstantDataType.DATE) {
        if (typeof value !== 'string' && !(value instanceof Date)) {
            return { ok: false, error: 'DATE constant value must be an ISO date string' }
        }

        const date = value instanceof Date ? value : new Date(value)
        if (Number.isNaN(date.getTime())) {
            return { ok: false, error: 'DATE constant value is invalid' }
        }

        return { ok: true, value: date.toISOString() }
    }

    return { ok: false, error: `Unsupported constant data type: ${dataType}` }
}

const isUniqueViolation = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: unknown }).code
    if (code === '23505') return true
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.toLowerCase().includes('duplicate key value')
}

const resolveUniqueConstantCodename = async (params: {
    metahubId: string
    setId: string
    baseCodename: string
    codenameStyle: 'kebab-case' | 'pascal-case'
    constantsService: MetahubConstantsService
    userId: string
    excludeConstantId?: string
}): Promise<string | null> => {
    const { metahubId, setId, baseCodename, codenameStyle, constantsService, userId, excludeConstantId } = params
    for (let attempt = 1; attempt <= CODENAME_RETRY_MAX_ATTEMPTS; attempt += 1) {
        const candidate = buildCodenameAttempt(baseCodename, attempt, codenameStyle)
        const existing = await constantsService.findByCodename(metahubId, setId, candidate, userId)
        if (!existing || (excludeConstantId && existing.id === excludeConstantId)) {
            return candidate
        }
    }
    return null
}

const buildSetKindError = (): { status: number; payload: { error: string } } => ({
    status: 404,
    payload: { error: 'Set not found' }
})

export function createConstantsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        return {
            exec,
            constantsService: new MetahubConstantsService(exec, schemaService),
            objectsService: new MetahubObjectsService(exec, schemaService),
            settingsService: new MetahubSettingsService(exec, schemaService)
        }
    }

    const resolveSetContext = async (
        metahubId: string,
        setId: string,
        hubId: string | undefined,
        userId: string | undefined,
        objectsService: MetahubObjectsService
    ): Promise<{ ok: true; set: Record<string, unknown> } | { ok: false; status: number; payload: { error: string } }> => {
        if (!userId) {
            return { ok: false, status: 401, payload: { error: 'Unauthorized' } }
        }

        const setObject = await objectsService.findById(metahubId, setId, userId)
        if (!setObject || setObject.kind !== 'set') {
            const err = buildSetKindError()
            return { ok: false, status: err.status, payload: err.payload }
        }

        if (hubId) {
            const hubs = Array.isArray((setObject.config as Record<string, unknown> | undefined)?.hubs)
                ? ((setObject.config as Record<string, unknown>).hubs as unknown[])
                : []
            const hasHub = hubs.some((id) => typeof id === 'string' && id === hubId)
            if (!hasHub) {
                return { ok: false, status: 404, payload: { error: 'Set not found in this hub' } }
            }
        }

        return { ok: true, set: setObject as Record<string, unknown> }
    }

    const resolveAllowedConstantTypes = async (
        metahubId: string,
        userId: string,
        settingsService: MetahubSettingsService
    ): Promise<Set<ConstantDataType>> => {
        const configured = await getAllowedConstantTypes(settingsService, metahubId, userId)
        const allowed = new Set<ConstantDataType>()
        for (const type of configured) {
            if ((CONSTANT_DATA_TYPES as readonly string[]).includes(type)) {
                allowed.add(type as ConstantDataType)
            }
        }

        if (allowed.size === 0) {
            for (const type of CONSTANT_DATA_TYPES) {
                allowed.add(type)
            }
        }

        return allowed
    }

    router.get(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants', '/metahub/:metahubId/set/:setId/constants'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId } = req.params
            const { exec, constantsService, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, undefined)

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            let validatedQuery
            try {
                validatedQuery = validateConstantsListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }

            const { limit, offset, sortBy, sortOrder, search, locale } = validatedQuery

            let items = await constantsService.findAll(metahubId, setId, userId)
            const totalAll = items.length
            const limitReached = totalAll >= CONSTANT_LIMIT

            if (search) {
                const searchLower = search.toLowerCase()
                items = items.filter(
                    (item) =>
                        String(item.codename).toLowerCase().includes(searchLower) ||
                        getLocalizedCandidates(item.name).some((candidate) => candidate.toLowerCase().includes(searchLower))
                )
            }

            const total = items.length

            const getNameValue = (name: unknown): string => {
                if (!name || typeof name !== 'object') return ''
                const raw = name as Record<string, unknown>
                const locales = raw.locales && typeof raw.locales === 'object' ? (raw.locales as Record<string, unknown>) : null
                const primary = typeof raw._primary === 'string' ? raw._primary : undefined

                if (locales) {
                    if (locale && locales[locale] && typeof locales[locale] === 'object') {
                        const localized = (locales[locale] as Record<string, unknown>).content
                        if (typeof localized === 'string') return localized
                    }
                    if (primary && locales[primary] && typeof locales[primary] === 'object') {
                        const primaryContent = (locales[primary] as Record<string, unknown>).content
                        if (typeof primaryContent === 'string') return primaryContent
                    }
                    if (locales.en && typeof locales.en === 'object') {
                        const enContent = (locales.en as Record<string, unknown>).content
                        if (typeof enContent === 'string') return enContent
                    }
                }

                return ''
            }

            items.sort((a, b) => {
                let valA: unknown = a[sortBy as keyof typeof a]
                let valB: unknown = b[sortBy as keyof typeof b]

                if (sortBy === 'name') {
                    valA = getNameValue(a.name)
                    valB = getNameValue(b.name)
                } else if (sortBy === 'created') {
                    valA = a.createdAt
                    valB = b.createdAt
                } else if (sortBy === 'updated') {
                    valA = a.updatedAt
                    valB = b.updatedAt
                }

                if (valA === valB) return 0
                if (valA === undefined || valA === null) return sortOrder === 'asc' ? -1 : 1
                if (valB === undefined || valB === null) return sortOrder === 'asc' ? 1 : -1

                return valA < valB ? (sortOrder === 'asc' ? -1 : 1) : sortOrder === 'asc' ? 1 : -1
            })

            const paginatedItems = items.slice(offset, offset + limit)

            res.json({
                items: paginatedItems,
                pagination: { total, limit, offset },
                meta: {
                    totalAll,
                    limit: CONSTANT_LIMIT,
                    limitReached
                }
            })
        })
    )

    router.get(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId, constantId } = req.params
            const { exec, constantsService, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, undefined)

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const constant = await constantsService.findById(metahubId, constantId, userId)
            if (!constant || constant.setId !== setId) {
                return res.status(404).json({ error: 'Constant not found' })
            }

            res.json(constant)
        })
    )

    router.post(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants', '/metahub/:metahubId/set/:setId/constants'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId } = req.params
            const { exec, constantsService, objectsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const totalAll = await constantsService.countByObjectId(metahubId, setId, userId)
            if (totalAll >= CONSTANT_LIMIT) {
                return res.status(409).json({
                    error: `Constant limit reached: maximum ${CONSTANT_LIMIT} constants per set`,
                    code: 'CONSTANT_LIMIT_REACHED',
                    limit: CONSTANT_LIMIT
                })
            }

            const parsed = createConstantSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const allowedTypes = await resolveAllowedConstantTypes(metahubId, userId, settingsService)

            if (!allowedTypes.has(parsed.data.dataType)) {
                return res.status(400).json({
                    error: `Data type ${parsed.data.dataType} is not allowed by settings`
                })
            }

            const normalizedCodename = normalizeCodenameForStyle(parsed.data.codename, codenameStyle, codenameAlphabet)
            if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: {
                        codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)]
                    }
                })
            }

            const codename = await resolveUniqueConstantCodename({
                metahubId,
                setId,
                baseCodename: normalizedCodename,
                codenameStyle,
                constantsService,
                userId
            })
            if (!codename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for constant' })
            }

            const parsedValue = parseConstantValue(parsed.data.dataType, parsed.data.value, parsed.data.validationRules)
            if (!parsedValue.ok) {
                return res.status(400).json({ error: parsedValue.error })
            }

            const codenameLocalized = buildCodenameLocalizedVlc(parsed.data.codenameInput, parsed.data.codenamePrimaryLocale)
            const sanitizedName = parsed.data.name
                ? sanitizeLocalizedInput(parsed.data.name as Record<string, string | undefined>)
                : { en: codename }

            let created
            try {
                created = await constantsService.create(
                    metahubId,
                    {
                        setId,
                        codename,
                        dataType: parsed.data.dataType,
                        name: buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, 'en'),
                        codenameLocalized,
                        validationRules: parsed.data.validationRules,
                        uiConfig: parsed.data.uiConfig,
                        value: parsedValue.value,
                        sortOrder: parsed.data.sortOrder,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Constant with this codename already exists in selected set' })
                }
                throw error
            }

            res.status(201).json(created)
        })
    )

    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId, constantId } = req.params
            const { exec, constantsService, objectsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const existing = await constantsService.findById(metahubId, constantId, userId)
            if (!existing || existing.setId !== setId) {
                return res.status(404).json({ error: 'Constant not found' })
            }

            const parsed = updateConstantSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const allowedTypes = await resolveAllowedConstantTypes(metahubId, userId, settingsService)

            const nextDataType = parsed.data.dataType ?? (existing.dataType as ConstantDataType)
            if (!allowedTypes.has(nextDataType)) {
                return res.status(400).json({
                    error: `Data type ${nextDataType} is not allowed by settings`
                })
            }

            let nextCodename: string | undefined = existing.codename as string
            if (parsed.data.codename !== undefined) {
                const normalizedCodename = normalizeCodenameForStyle(parsed.data.codename, codenameStyle, codenameAlphabet)
                if (!normalizedCodename || !isValidCodenameForStyle(normalizedCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: {
                            codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)]
                        }
                    })
                }

                if (normalizedCodename !== existing.codename) {
                    const resolved = await resolveUniqueConstantCodename({
                        metahubId,
                        setId,
                        baseCodename: normalizedCodename,
                        codenameStyle,
                        constantsService,
                        userId,
                        excludeConstantId: existing.id as string
                    })
                    if (!resolved) {
                        return res.status(409).json({ error: 'Unable to generate unique codename for constant' })
                    }
                    nextCodename = resolved
                }
            }

            const nextValidationRules = parsed.data.validationRules ?? existing.validationRules
            const nextValueRaw = parsed.data.value !== undefined ? parsed.data.value : existing.value
            const parsedValue = parseConstantValue(nextDataType, nextValueRaw, nextValidationRules as Record<string, unknown> | undefined)
            if (!parsedValue.ok) {
                return res.status(400).json({ error: parsedValue.error })
            }

            const codenameLocalized =
                parsed.data.codenameInput !== undefined || parsed.data.codenamePrimaryLocale !== undefined
                    ? buildCodenameLocalizedVlc(parsed.data.codenameInput, parsed.data.codenamePrimaryLocale)
                    : undefined

            const sanitizedName =
                parsed.data.name !== undefined ? sanitizeLocalizedInput(parsed.data.name as Record<string, string | undefined>) : undefined

            let updated
            try {
                updated = await constantsService.update(
                    metahubId,
                    constantId,
                    {
                        codename: parsed.data.codename !== undefined ? nextCodename : undefined,
                        dataType: parsed.data.dataType,
                        name:
                            sanitizedName !== undefined
                                ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, 'en')
                                : undefined,
                        codenameLocalized,
                        validationRules: parsed.data.validationRules,
                        uiConfig: parsed.data.uiConfig,
                        value: parsedValue.value,
                        sortOrder: parsed.data.sortOrder,
                        expectedVersion: parsed.data.expectedVersion,
                        updatedBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Constant with this codename already exists in selected set' })
                }
                throw error
            }

            if (!updated) {
                return res.status(404).json({ error: 'Constant not found' })
            }

            res.json(updated)
        })
    )

    router.delete(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId', '/metahub/:metahubId/set/:setId/constant/:constantId'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId, constantId } = req.params
            const { exec, constantsService, objectsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'deleteContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const constant = await constantsService.findById(metahubId, constantId, userId)
            if (!constant || constant.setId !== setId) {
                return res.status(404).json({ error: 'Constant not found' })
            }

            const allowConstantDelete = await getAllowConstantDelete(settingsService, metahubId, userId)
            if (!allowConstantDelete) {
                return res.status(403).json({ error: 'Constant delete is disabled by metahub settings' })
            }

            const blocked = await constantsService.findAttributeReferenceBlockersByConstant(metahubId, setId, constantId, userId)
            if (blocked) {
                return res.status(409).json({
                    error: 'Cannot delete constant because it is referenced by REF attributes',
                    code: 'CONSTANT_DELETE_BLOCKED_BY_REFERENCES'
                })
            }

            await constantsService.delete(metahubId, constantId, userId)
            res.status(204).send()
        })
    )

    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId/move', '/metahub/:metahubId/set/:setId/constant/:constantId/move'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId, constantId } = req.params
            const { exec, constantsService, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const parsed = moveConstantSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const moved = await constantsService.moveConstant(metahubId, setId, constantId, parsed.data.direction, userId)
            res.json(moved)
        })
    )

    router.patch(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constants/reorder', '/metahub/:metahubId/set/:setId/constants/reorder'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId } = req.params
            const { exec, constantsService, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const parsed = reorderConstantSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const reordered = await constantsService.reorderConstant(
                metahubId,
                setId,
                parsed.data.constantId,
                parsed.data.newSortOrder,
                userId
            )

            res.json(reordered)
        })
    )

    router.post(
        ['/metahub/:metahubId/hub/:hubId/set/:setId/constant/:constantId/copy', '/metahub/:metahubId/set/:setId/constant/:constantId/copy'],
        writeLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, hubId, setId, constantId } = req.params
            const { exec, constantsService, objectsService, settingsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, 'editContent')

            const setContext = await resolveSetContext(metahubId, setId, hubId, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const source = await constantsService.findById(metahubId, constantId, userId)
            if (!source || source.setId !== setId) {
                return res.status(404).json({ error: 'Constant not found' })
            }

            const allowConstantCopy = await getAllowConstantCopy(settingsService, metahubId, userId)
            if (!allowConstantCopy) {
                return res.status(403).json({ error: 'Constant copy is disabled by metahub settings' })
            }

            const totalAll = await constantsService.countByObjectId(metahubId, setId, userId)
            if (totalAll >= CONSTANT_LIMIT) {
                return res.status(409).json({
                    error: `Constant limit reached: maximum ${CONSTANT_LIMIT} constants per set`,
                    code: 'CONSTANT_LIMIT_REACHED',
                    limit: CONSTANT_LIMIT
                })
            }

            const parsed = copyConstantSchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
            }

            const {
                style: codenameStyle,
                alphabet: codenameAlphabet,
                allowMixed
            } = await getCodenameSettings(settingsService, metahubId, userId)
            const allowedTypes = await resolveAllowedConstantTypes(metahubId, userId, settingsService)
            if (!allowedTypes.has(source.dataType as ConstantDataType)) {
                return res.status(400).json({
                    error: `Data type ${source.dataType} is not allowed by settings`
                })
            }

            const copySuffix = codenameStyle === 'kebab-case' ? '-copy' : 'Copy'
            const normalizedBaseCodename = normalizeCodenameForStyle(
                parsed.data.codename ?? `${source.codename}${copySuffix}`,
                codenameStyle,
                codenameAlphabet
            )
            if (!normalizedBaseCodename || !isValidCodenameForStyle(normalizedBaseCodename, codenameStyle, codenameAlphabet, allowMixed)) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: {
                        codename: [codenameErrorMessage(codenameStyle, codenameAlphabet, allowMixed)]
                    }
                })
            }

            const codename = await resolveUniqueConstantCodename({
                metahubId,
                setId,
                baseCodename: normalizedBaseCodename,
                codenameStyle,
                constantsService,
                userId
            })
            if (!codename) {
                return res.status(409).json({ error: 'Unable to generate unique codename for constant copy' })
            }

            const copyOptions: ConstantCopyOptions = {
                copyValue: parsed.data.copyValue !== false
            }

            const codenamePrimaryLocale = normalizeLocaleCode(parsed.data.codenamePrimaryLocale ?? 'en')
            const codenameLocalized =
                parsed.data.codenameInput === undefined
                    ? buildCodenameLocalizedVlc({ [codenamePrimaryLocale]: codename }, codenamePrimaryLocale, codenamePrimaryLocale)
                    : buildCodenameLocalizedVlc(parsed.data.codenameInput, parsed.data.codenamePrimaryLocale)
            const nameInput = parsed.data.name ?? buildDefaultCopyNameInput(source.name)
            const sanitizedName = sanitizeLocalizedInput(nameInput as Record<string, string | undefined>)
            const nameVlc =
                Object.keys(sanitizedName).length > 0
                    ? buildLocalizedContent(sanitizedName, parsed.data.namePrimaryLocale, 'en')
                    : buildLocalizedContent({ en: codename }, parsed.data.namePrimaryLocale, 'en')

            const validationRules = (parsed.data.validationRules ?? source.validationRules ?? {}) as Record<string, unknown>
            const valueToCopy = copyOptions.copyValue ? source.value : null
            const parsedValue = parseConstantValue(source.dataType as ConstantDataType, valueToCopy, validationRules)
            if (!parsedValue.ok) {
                return res.status(400).json({ error: parsedValue.error })
            }

            let copied
            try {
                copied = await constantsService.create(
                    metahubId,
                    {
                        setId,
                        codename,
                        dataType: source.dataType as ConstantDataType,
                        name: nameVlc,
                        codenameLocalized,
                        validationRules,
                        uiConfig: (parsed.data.uiConfig ?? source.uiConfig ?? {}) as Record<string, unknown>,
                        value: parsedValue.value,
                        createdBy: userId
                    },
                    userId
                )
            } catch (error) {
                if (isUniqueViolation(error)) {
                    return res.status(409).json({ error: 'Constant with this codename already exists in selected set' })
                }
                throw error
            }

            res.status(201).json(copied)
        })
    )

    router.get(
        '/metahub/:metahubId/set/:setId/constant-codenames',
        readLimiter,
        asyncHandler(async (req: Request, res: Response) => {
            const { metahubId, setId } = req.params
            const { exec, constantsService, objectsService } = services(req)
            const userId = resolveUserId(req)

            if (!userId) return res.status(401).json({ error: 'Unauthorized' })
            await ensureMetahubAccess(exec, userId, metahubId, undefined)

            const setContext = await resolveSetContext(metahubId, setId, undefined, userId, objectsService)
            if (!setContext.ok) {
                return res.status(setContext.status).json(setContext.payload)
            }

            const constants = await constantsService.findAll(metahubId, setId, userId)
            res.json({
                items: constants.map((constant) => ({
                    id: constant.id,
                    codename: constant.codename,
                    parentConstantId: null
                }))
            })
        })
    )

    return router
}
