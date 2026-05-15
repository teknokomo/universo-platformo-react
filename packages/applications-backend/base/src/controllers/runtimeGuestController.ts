import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { qColumn, qSchemaTable } from '@universo/database'
import { RuntimeScriptsService } from '../services/runtimeScriptsService'
import {
    listActivePublicWorkspaceIds,
    loadPublicRuntimeRecord,
    loadPublicTableRows,
    resolveChildComponents,
    resolvePublicRuntimeObject,
    resolvePublicRuntimeSchema,
    resolveTopLevelComponents,
    setPublicWorkspaceContext,
    type PublicRuntimeObjectBinding,
    type PublicRuntimeSchemaContext
} from '../shared/publicRuntimeAccess'
import { UUID_REGEX, resolveLocalizedContent, resolveRuntimeCodenameText, IDENTIFIER_REGEX } from '../shared/runtimeHelpers'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24
const GUEST_PARTICIPANT_ID_HEADER = 'x-guest-participant-id'
const LEGACY_GUEST_STUDENT_ID_HEADER = 'x-guest-student-id'
const GUEST_SESSION_TOKEN_HEADER = 'x-guest-session-token'
const MAX_GUEST_SESSION_TOKEN_LENGTH = 4096
const MAX_GUEST_ANSWER_QUESTIONS = 200
const MAX_GUEST_ANSWER_OPTIONS = 20
const MAX_GUEST_ANSWER_ID_LENGTH = 128

const createGuestSessionSchema = z.object({
    displayName: z.string().trim().min(1).max(255),
    accessLinkId: z.string().uuid()
})

const publicRuntimeQuerySchema = z
    .object({
        slug: z.string().trim().min(1).max(255),
        targetType: z.enum(['content', 'assessment', 'module', 'quiz']).optional(),
        targetId: z.string().uuid().optional(),
        locale: z.string().trim().min(2).max(32).optional()
    })
    .superRefine((value, ctx) => {
        if (value.targetType && !value.targetId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['targetId'],
                message: 'targetId is required when targetType is provided'
            })
        }
    })

const guestAnswerOptionsSchema = z.array(z.string().trim().min(1).max(MAX_GUEST_ANSWER_ID_LENGTH)).max(MAX_GUEST_ANSWER_OPTIONS)
const guestAnswersSchema = z
    .record(guestAnswerOptionsSchema)
    .default({})
    .superRefine((answers, ctx) => {
        if (Object.keys(answers).length > MAX_GUEST_ANSWER_QUESTIONS) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `answers supports at most ${MAX_GUEST_ANSWER_QUESTIONS} questions`
            })
        }
    })

const guestSubmitSchema = z
    .object({
        participantId: z.string().uuid().optional(),
        studentId: z.string().uuid().optional(),
        sessionToken: z.string().trim().min(1).max(MAX_GUEST_SESSION_TOKEN_LENGTH),
        assessmentId: z.string().uuid().optional(),
        quizId: z.string().uuid().optional(),
        answers: guestAnswersSchema
    })
    .superRefine((value, ctx) => {
        if (!value.participantId && !value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['participantId'], message: 'participantId is required' })
        }
        if (value.participantId && value.studentId && value.participantId !== value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studentId'], message: 'studentId alias must match participantId' })
        }
        if (!value.assessmentId && !value.quizId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessmentId'], message: 'assessmentId is required' })
        }
        if (value.assessmentId && value.quizId && value.assessmentId !== value.quizId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quizId'], message: 'quizId alias must match assessmentId' })
        }
    })
    .transform((value) => ({
        participantId: value.participantId ?? value.studentId!,
        sessionToken: value.sessionToken,
        assessmentId: value.assessmentId ?? value.quizId!,
        answers: value.answers
    }))

const guestProgressSchema = z
    .object({
        participantId: z.string().uuid().optional(),
        studentId: z.string().uuid().optional(),
        sessionToken: z.string().trim().min(1).max(MAX_GUEST_SESSION_TOKEN_LENGTH),
        contentNodeId: z.string().uuid().optional(),
        moduleId: z.string().uuid().optional(),
        progressPercent: z.number().min(0).max(100).default(0),
        lastAccessedItemIndex: z.number().int().min(0).default(0),
        status: z.string().trim().min(1).max(64).default('in_progress')
    })
    .superRefine((value, ctx) => {
        if (!value.participantId && !value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['participantId'], message: 'participantId is required' })
        }
        if (value.participantId && value.studentId && value.participantId !== value.studentId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studentId'], message: 'studentId alias must match participantId' })
        }
        if (!value.contentNodeId && !value.moduleId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contentNodeId'], message: 'contentNodeId is required' })
        }
        if (value.contentNodeId && value.moduleId && value.contentNodeId !== value.moduleId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['moduleId'], message: 'moduleId alias must match contentNodeId' })
        }
    })
    .transform((value) => ({
        participantId: value.participantId ?? value.studentId!,
        sessionToken: value.sessionToken,
        contentNodeId: value.contentNodeId ?? value.moduleId!,
        progressPercent: value.progressPercent,
        lastAccessedItemIndex: value.lastAccessedItemIndex,
        status: value.status
    }))

type AccessLinkRecord = {
    id: string
    slug: string
    title: unknown
    targetType: string
    targetId: string
    isActive: boolean
    expiresAt: string | null
    maxUses: number | null
    useCount: number | null
    classId: string | null
    workspaceId: string | null
    binding: PublicRuntimeObjectBinding
    columns: {
        slug: string
        targetType: string
        targetId: string
        isActive: string
        expiresAt: string | null
        maxUses: string | null
        useCount: string | null
        title: string | null
        classId: string | null
    }
}

type GuestSessionPayload = {
    linkId: string
    secret: string
    workspaceId?: string | null
}

type StoredGuestSessionState = {
    linkId: string
    secretHash: string
    expiresAt: string
    workspaceId?: string | null
}

type PublicGuestRuntimeConfig = {
    objects: {
        accessLinks: string
        participants: string
        assessments: string
        contentNodes: string
        assessmentResponses: string
        contentProgress: string
    }
    fields: {
        accessLink: {
            slug: string
            targetType: string
            targetId: string
            isActive: string
            expiresAt: string
            maxUses: string
            useCount: string
            title: string
            classId: string
        }
        participant: {
            displayName: string
            isGuest: string
            guestSessionToken: string
        }
        contentNode: {
            title: string
            description: string
            contentItems: string
        }
        contentPart: {
            itemType: string
            itemTitle: string
            itemContent: string
            quizId: string
            sortOrder: string
        }
        assessment: {
            title: string
            description: string
            passingScorePercent: string
            questions: string
        }
        assessmentQuestion: {
            prompt: string
            description: string
            questionType: string
            explanation: string
            sortOrder: string
            options: string
        }
        assessmentResponse: {
            studentId: string
            quizId: string
            questionId: string
            selectedOptionIds: string
            isCorrect: string
            attemptNumber: string
            submittedAt: string
        }
        contentProgress: {
            studentId: string
            moduleId: string
            status: string
            progressPercent: string
            startedAt: string
            completedAt: string
            lastAccessedItemIndex: string
        }
    }
}

const PUBLIC_GUEST_RUNTIME_OBJECT_ALIASES = {
    accessLinks: ['accessLinks'],
    participants: ['participants', 'students'],
    assessments: ['assessments', 'quizzes'],
    contentNodes: ['contentNodes', 'modules'],
    assessmentResponses: ['assessmentResponses', 'quizResponses'],
    contentProgress: ['contentProgress', 'moduleProgress']
} as const
const PUBLIC_GUEST_RUNTIME_FIELD_KEYS = {
    accessLink: ['slug', 'targetType', 'targetId', 'isActive', 'expiresAt', 'maxUses', 'useCount', 'title', 'classId'],
    participant: ['displayName', 'isGuest', 'guestSessionToken'],
    contentNode: ['title', 'description', 'contentItems'],
    contentPart: ['itemType', 'itemTitle', 'itemContent', 'quizId', 'sortOrder'],
    assessment: ['title', 'description', 'passingScorePercent', 'questions'],
    assessmentQuestion: ['prompt', 'description', 'questionType', 'explanation', 'sortOrder', 'options'],
    assessmentResponse: ['studentId', 'quizId', 'questionId', 'selectedOptionIds', 'isCorrect', 'attemptNumber', 'submittedAt'],
    contentProgress: ['studentId', 'moduleId', 'status', 'progressPercent', 'startedAt', 'completedAt', 'lastAccessedItemIndex']
} as const
const PUBLIC_GUEST_RUNTIME_FIELD_ALIASES = {
    accessLink: ['accessLink'],
    participant: ['participant', 'student'],
    contentNode: ['contentNode', 'module'],
    contentPart: ['contentPart', 'moduleContentItem'],
    assessment: ['assessment', 'quiz'],
    assessmentQuestion: ['assessmentQuestion', 'quizQuestion'],
    assessmentResponse: ['assessmentResponse', 'quizResponse'],
    contentProgress: ['contentProgress', 'moduleProgress']
} as const

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readConfiguredString = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null)

const readConfiguredStringMap = <K extends readonly string[]>(source: unknown, keys: K): Record<K[number], string> | null => {
    if (!isPlainRecord(source)) return null
    const result = {} as Record<K[number], string>
    for (const key of keys) {
        const value = readConfiguredString(source[key])
        if (!value) {
            return null
        }
        result[key as K[number]] = value
    }
    return result
}

const readConfiguredStringMapByAliases = <TKeys extends Record<string, readonly string[]>>(
    source: unknown,
    aliases: TKeys
): Record<keyof TKeys, string> | null => {
    if (!isPlainRecord(source)) return null
    const result = {} as Record<keyof TKeys, string>
    for (const [key, candidates] of Object.entries(aliases) as Array<[keyof TKeys, readonly string[]]>) {
        const value = candidates
            .map((candidate) => readConfiguredString(source[candidate]))
            .find((candidate): candidate is string => Boolean(candidate))
        if (!value) {
            return null
        }
        result[key] = value
    }
    return result
}

const readFieldMapByAliases = <K extends keyof typeof PUBLIC_GUEST_RUNTIME_FIELD_ALIASES>(
    rawFields: Record<string, unknown>,
    fieldKey: K
) => {
    const aliases = PUBLIC_GUEST_RUNTIME_FIELD_ALIASES[fieldKey]
    for (const alias of aliases) {
        const fieldMap = readConfiguredStringMap(rawFields[alias], PUBLIC_GUEST_RUNTIME_FIELD_KEYS[fieldKey])
        if (fieldMap) {
            return fieldMap
        }
    }
    return null
}

const resolvePublicGuestRuntimeConfig = (settings: Record<string, unknown>): PublicGuestRuntimeConfig | null => {
    const publicRuntime = isPlainRecord(settings.publicRuntime) ? settings.publicRuntime : {}
    const rawConfig = isPlainRecord(publicRuntime.guest)
        ? publicRuntime.guest
        : isPlainRecord(settings.guestRuntime)
        ? settings.guestRuntime
        : null
    if (!rawConfig) return null

    const objects = readConfiguredStringMapByAliases(rawConfig.objects, PUBLIC_GUEST_RUNTIME_OBJECT_ALIASES)
    const rawFields = isPlainRecord(rawConfig.fields) ? rawConfig.fields : null
    if (!objects || !rawFields) return null

    const accessLinkFields = readFieldMapByAliases(rawFields, 'accessLink')
    const participantFields = readFieldMapByAliases(rawFields, 'participant')
    const contentNodeFields = readFieldMapByAliases(rawFields, 'contentNode')
    const contentPartFields = readFieldMapByAliases(rawFields, 'contentPart')
    const assessmentFields = readFieldMapByAliases(rawFields, 'assessment')
    const assessmentQuestionFields = readFieldMapByAliases(rawFields, 'assessmentQuestion')
    const assessmentResponseFields = readFieldMapByAliases(rawFields, 'assessmentResponse')
    const contentProgressFields = readFieldMapByAliases(rawFields, 'contentProgress')

    if (
        !accessLinkFields ||
        !participantFields ||
        !contentNodeFields ||
        !contentPartFields ||
        !assessmentFields ||
        !assessmentQuestionFields ||
        !assessmentResponseFields ||
        !contentProgressFields
    ) {
        return null
    }

    return {
        objects,
        fields: {
            accessLink: accessLinkFields,
            participant: participantFields,
            contentNode: contentNodeFields,
            contentPart: contentPartFields,
            assessment: assessmentFields,
            assessmentQuestion: assessmentQuestionFields,
            assessmentResponse: assessmentResponseFields,
            contentProgress: contentProgressFields
        }
    }
}

const indexByCodename = <T extends { codename: unknown }>(items: T[]) =>
    Object.fromEntries(items.map((item) => [resolveRuntimeCodenameText(item.codename), item]))

const readAttrValue = (row: Record<string, unknown> | null, columnName: string): unknown => row?.[columnName] ?? null

const normalizeEnumCodename = (value: unknown): string => {
    const codename = resolveRuntimeCodenameText(value)
    return codename
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase()
}

const isEnumerationRefComponent = (component: {
    data_type?: string
    target_object_kind?: string | null
    target_object_id?: string | null
}) => component.data_type === 'REF' && component.target_object_kind === 'enumeration' && typeof component.target_object_id === 'string'

const loadEnumerationValueCodeMaps = async (
    executor: DbExecutor,
    schemaName: string,
    components: Array<{ data_type?: string; target_object_kind?: string | null; target_object_id?: string | null }>
) => {
    const optionListIds = Array.from(
        new Set(components.filter(isEnumerationRefComponent).map((component) => String(component.target_object_id)))
    )

    const maps = new Map<string, Map<string, string>>()
    if (optionListIds.length === 0) {
        return maps
    }

    const valuesTable = qSchemaTable(schemaName, '_app_values')
    const rows = await executor.query<{ id: string; object_id: string; codename: unknown }>(
        `
        SELECT id, object_id, codename
        FROM ${valuesTable}
        WHERE object_id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        ORDER BY object_id ASC, sort_order ASC, codename ASC
        `,
        [optionListIds]
    )

    for (const row of rows) {
        const optionMap = maps.get(row.object_id) ?? new Map<string, string>()
        optionMap.set(row.id, normalizeEnumCodename(row.codename))
        maps.set(row.object_id, optionMap)
    }

    return maps
}

const resolveEnumerationRefValue = (
    component: { data_type?: string; target_object_kind?: string | null; target_object_id?: string | null } | undefined,
    value: unknown,
    enumValueCodeMaps: Map<string, Map<string, string>>
) => {
    if (typeof value !== 'string' || !component || !isEnumerationRefComponent(component)) {
        return typeof value === 'string' ? value : ''
    }

    return enumValueCodeMaps.get(String(component.target_object_id))?.get(value) ?? value
}

const normalizeOptions = (value: unknown, locale: string): Array<{ id: string; label: string; isCorrect: boolean }> => {
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const raw = entry as Record<string, unknown>
            const id = typeof raw.id === 'string' ? raw.id : null
            const label = resolveLocalizedContent(raw.label ?? raw.text ?? '', locale, '')
            if (!id) return null
            return {
                id,
                label,
                isCorrect: raw.is_correct === true || raw.isCorrect === true
            }
        })
        .filter((entry): entry is { id: string; label: string; isCorrect: boolean } => entry !== null)
}

const normalizeQuestionRows = (
    rows: Array<Record<string, unknown>>,
    columns: Record<string, string>,
    options?: {
        locale?: string
        questionTypeComponent?: { data_type?: string; target_object_kind?: string | null; target_object_id?: string | null }
        enumValueCodeMaps?: Map<string, Map<string, string>>
    }
) =>
    rows.map((row) => ({
        id: String(row.id),
        prompt: resolveLocalizedContent(row[columns.prompt], options?.locale ?? 'en', ''),
        description: resolveLocalizedContent(row[columns.description], options?.locale ?? 'en', ''),
        questionType: resolveEnumerationRefValue(
            options?.questionTypeComponent,
            row[columns.questionType],
            options?.enumValueCodeMaps ?? new Map<string, Map<string, string>>()
        ),
        explanation: resolveLocalizedContent(row[columns.explanation], options?.locale ?? 'en', ''),
        sortOrder: typeof row[columns.sortOrder] === 'number' ? Number(row[columns.sortOrder]) : 0,
        options: normalizeOptions(row[columns.options], options?.locale ?? 'en')
    }))

const encodeGuestSessionToken = (payload: GuestSessionPayload): string => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

const encodeStoredGuestSessionState = (payload: StoredGuestSessionState): string => JSON.stringify(payload)

const hashGuestSessionSecret = (secret: string): string => crypto.createHash('sha256').update(secret, 'utf8').digest('hex')

const isSameSecretHash = (expectedHash: string, actualSecret: string): boolean => {
    const actualHash = hashGuestSessionSecret(actualSecret)
    const expectedBuffer = Buffer.from(expectedHash, 'utf8')
    const actualBuffer = Buffer.from(actualHash, 'utf8')
    return (
        expectedBuffer.length === actualBuffer.length &&
        crypto.timingSafeEqual(new Uint8Array(expectedBuffer), new Uint8Array(actualBuffer))
    )
}

const decodeStoredGuestSessionState = (value: unknown): StoredGuestSessionState | null => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null
    }

    try {
        const decoded = JSON.parse(value) as Partial<StoredGuestSessionState>
        if (!decoded || typeof decoded !== 'object') return null
        if (typeof decoded.linkId !== 'string' || !UUID_REGEX.test(decoded.linkId)) return null
        if (typeof decoded.secretHash !== 'string' || !/^[a-f0-9]{64}$/i.test(decoded.secretHash)) return null
        if (typeof decoded.expiresAt !== 'string' || Number.isNaN(new Date(decoded.expiresAt).getTime())) return null
        if (decoded.workspaceId != null && (typeof decoded.workspaceId !== 'string' || !UUID_REGEX.test(decoded.workspaceId))) return null
        return {
            linkId: decoded.linkId,
            secretHash: decoded.secretHash.toLowerCase(),
            expiresAt: decoded.expiresAt,
            workspaceId: decoded.workspaceId ?? null
        }
    } catch {
        return null
    }
}

const decodeGuestSessionToken = (token: string): GuestSessionPayload | null => {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Partial<GuestSessionPayload>
        if (!decoded || typeof decoded !== 'object') return null
        if (typeof decoded.linkId !== 'string' || !UUID_REGEX.test(decoded.linkId)) return null
        if (typeof decoded.secret !== 'string' || decoded.secret.trim().length === 0) return null
        if (decoded.workspaceId != null && (typeof decoded.workspaceId !== 'string' || !UUID_REGEX.test(decoded.workspaceId))) {
            return null
        }
        return {
            linkId: decoded.linkId,
            secret: decoded.secret,
            workspaceId: decoded.workspaceId ?? null
        }
    } catch {
        return null
    }
}

const readGuestRuntimeSessionRequest = (req: Request): { participantId: string; sessionToken: string } | { error: string } | null => {
    const participantIdHeader = req.get(GUEST_PARTICIPANT_ID_HEADER) ?? req.get(LEGACY_GUEST_STUDENT_ID_HEADER)
    const sessionTokenHeader = req.get(GUEST_SESSION_TOKEN_HEADER)

    const participantId = typeof participantIdHeader === 'string' ? participantIdHeader.trim() : ''
    const sessionToken = typeof sessionTokenHeader === 'string' ? sessionTokenHeader.trim() : ''

    if (!participantId && !sessionToken) {
        return null
    }

    if (!participantId || !sessionToken) {
        return { error: 'Guest runtime session headers must be provided together' }
    }

    if (!UUID_REGEX.test(participantId)) {
        return { error: 'Guest runtime participant header must be a UUID' }
    }
    if (sessionToken.length > MAX_GUEST_SESSION_TOKEN_LENGTH) {
        return { error: 'Guest runtime session token is too large' }
    }

    return {
        participantId,
        sessionToken
    }
}

export function createRuntimeGuestController(getDbExecutor: () => DbExecutor) {
    const scriptsService = new RuntimeScriptsService()
    const createUuidV7 = async (executor: DbExecutor): Promise<string> => {
        const rows = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        const id = rows[0]?.id
        if (!id) {
            throw new Error('Database UUID v7 generation failed')
        }
        return id
    }

    const resolveAccessLinksBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.accessLinks)
    const resolveStudentsBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.participants)
    const resolveQuizBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.assessments)
    const resolveModuleBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.contentNodes)
    const resolveQuizResponsesBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.assessmentResponses)
    const resolveModuleProgressBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.contentProgress)

    const loadAccessLinkRecordBy = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        lookup: { type: 'slug'; value: string } | { type: 'id'; value: string },
        workspaceId: string | null
    ): Promise<AccessLinkRecord | null> => {
        const binding = await resolveAccessLinksBinding(executor, schemaName, config)
        if (!binding) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const fields = config.fields.accessLink
        const slugColumn = attrByCodename[fields.slug]?.column_name
        const targetTypeColumn = attrByCodename[fields.targetType]?.column_name
        const targetIdColumn = attrByCodename[fields.targetId]?.column_name
        const isActiveColumn = attrByCodename[fields.isActive]?.column_name
        const expiresAtColumn = attrByCodename[fields.expiresAt]?.column_name
        const maxUsesColumn = attrByCodename[fields.maxUses]?.column_name
        const useCountColumn = attrByCodename[fields.useCount]?.column_name
        const titleColumn = attrByCodename[fields.title]?.column_name
        const classIdColumn = attrByCodename[fields.classId]?.column_name

        if (!slugColumn || !targetTypeColumn || !targetIdColumn || !isActiveColumn) return null

        const safeColumns = {
            slug: slugColumn,
            targetType: targetTypeColumn,
            targetId: targetIdColumn,
            isActive: isActiveColumn,
            expiresAt: expiresAtColumn,
            maxUses: maxUsesColumn,
            useCount: useCountColumn,
            title: titleColumn,
            classId: classIdColumn
        }
        for (const col of Object.values(safeColumns)) {
            if (col && !IDENTIFIER_REGEX.test(col)) return null
        }

        const tableQt = qSchemaTable(schemaName, binding.tableName)
        const matchColumnSql = lookup.type === 'slug' ? `"${safeColumns.slug}"` : 'id'
        const rows = await executor.query<Record<string, unknown>>(
            `
            SELECT id,
                   "${safeColumns.slug}" AS slug,
                   "${safeColumns.targetType}" AS target_type,
                   "${safeColumns.targetId}" AS target_id,
                   "${safeColumns.isActive}" AS is_active,
                   ${safeColumns.expiresAt ? `"${safeColumns.expiresAt}"` : 'NULL'} AS expires_at,
                   ${safeColumns.maxUses ? `"${safeColumns.maxUses}"` : 'NULL'} AS max_uses,
                   ${safeColumns.useCount ? `"${safeColumns.useCount}"` : 'NULL'} AS use_count,
                   ${safeColumns.title ? `"${safeColumns.title}"` : 'NULL'} AS title,
                   ${safeColumns.classId ? `"${safeColumns.classId}"` : 'NULL'} AS class_id
            FROM ${tableQt}
            WHERE ${matchColumnSql} = $1
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            `,
            [lookup.value]
        )

        const row = rows[0]
        if (!row) return null

        return {
            id: String(row.id),
            slug: String(row.slug ?? ''),
            title: row.title ?? null,
            targetType: String(row.target_type ?? ''),
            targetId: String(row.target_id ?? ''),
            isActive: row.is_active === true,
            expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
            maxUses: typeof row.max_uses === 'number' ? row.max_uses : null,
            useCount: typeof row.use_count === 'number' ? row.use_count : null,
            classId: typeof row.class_id === 'string' ? row.class_id : null,
            workspaceId,
            binding,
            columns: {
                slug: safeColumns.slug,
                targetType: safeColumns.targetType,
                targetId: safeColumns.targetId,
                isActive: safeColumns.isActive,
                expiresAt: safeColumns.expiresAt ?? null,
                maxUses: safeColumns.maxUses ?? null,
                useCount: safeColumns.useCount ?? null,
                title: safeColumns.title ?? null,
                classId: safeColumns.classId ?? null
            }
        }
    }

    const resolveAccessLinkRecordBy = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        lookup: { type: 'slug'; value: string } | { type: 'id'; value: string }
    ): Promise<AccessLinkRecord | null> => {
        if (!workspacesEnabled) {
            await setPublicWorkspaceContext(executor, schemaName, null)
            return loadAccessLinkRecordBy(executor, schemaName, config, lookup, null)
        }

        const workspaceIds = await listActivePublicWorkspaceIds(executor, schemaName)
        for (const workspaceId of workspaceIds) {
            const hasWorkspace = await setPublicWorkspaceContext(executor, schemaName, workspaceId)
            if (!hasWorkspace) {
                continue
            }

            const link = await loadAccessLinkRecordBy(executor, schemaName, config, lookup, workspaceId)
            if (link) {
                return link
            }
        }

        await setPublicWorkspaceContext(executor, schemaName, null)
        return null
    }

    const loadAccessLinkRecord = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        slug: string
    ): Promise<AccessLinkRecord | null> =>
        resolveAccessLinkRecordBy(executor, schemaName, config, workspacesEnabled, { type: 'slug', value: slug })

    const loadAccessLinkRecordById = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        linkId: string
    ): Promise<AccessLinkRecord | null> =>
        resolveAccessLinkRecordBy(executor, schemaName, config, workspacesEnabled, { type: 'id', value: linkId })

    const assertAccessLinkAvailable = (
        link: AccessLinkRecord,
        options: { enforceQuota: boolean }
    ): { ok: true } | { ok: false; status: number; error: string } => {
        if (!link.isActive) {
            return { ok: false, status: 403, error: 'Access link is inactive' }
        }
        if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
            return { ok: false, status: 403, error: 'Access link has expired' }
        }
        if (
            options.enforceQuota &&
            typeof link.maxUses === 'number' &&
            typeof link.useCount === 'number' &&
            link.useCount >= link.maxUses
        ) {
            return { ok: false, status: 403, error: 'Access link usage limit reached' }
        }

        return { ok: true }
    }

    const consumeAccessLinkUse = async (executor: DbExecutor, schemaName: string, link: AccessLinkRecord): Promise<boolean> => {
        const useCountColumn = link.columns.useCount
        if (!useCountColumn) {
            return true
        }

        if (!IDENTIFIER_REGEX.test(useCountColumn) || !IDENTIFIER_REGEX.test(link.columns.isActive)) return false
        if (link.columns.expiresAt && !IDENTIFIER_REGEX.test(link.columns.expiresAt)) return false
        if (link.columns.maxUses && !IDENTIFIER_REGEX.test(link.columns.maxUses)) return false

        const tableQt = qSchemaTable(schemaName, link.binding.tableName)
        const result = await executor.query<{ id: string }>(
            `
            UPDATE ${tableQt}
            SET "${useCountColumn}" = COALESCE("${useCountColumn}", 0) + 1,
                ${qColumn('_upl_updated_at')} = NOW()
            WHERE id = $1
              AND "${link.columns.isActive}" = true
              AND ${link.columns.expiresAt ? `("${link.columns.expiresAt}" IS NULL OR "${link.columns.expiresAt}" >= NOW())` : 'TRUE'}
              AND ${
                  link.columns.maxUses && link.columns.useCount
                      ? `("${link.columns.maxUses}" IS NULL OR COALESCE("${link.columns.useCount}", 0) < "${link.columns.maxUses}")`
                      : 'TRUE'
              }
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
            `,
            [link.id]
        )

        return result.length > 0
    }

    const validateGuestSession = async (
        executor: DbExecutor,
        schemaName: string,
        workspacesEnabled: boolean,
        config: PublicGuestRuntimeConfig,
        studentId: string,
        sessionToken: string
    ): Promise<{ isValid: boolean; accessLinkId: string | null; workspaceId: string | null }> => {
        const tokenPayload = decodeGuestSessionToken(sessionToken)
        if (!tokenPayload) {
            return { isValid: false, accessLinkId: null, workspaceId: null }
        }

        const binding = await resolveStudentsBinding(executor, schemaName, config)
        if (!binding) return { isValid: false, accessLinkId: null, workspaceId: null }

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const studentFields = config.fields.participant
        const tokenColumn = attrByCodename[studentFields.guestSessionToken]?.column_name
        const isGuestColumn = attrByCodename[studentFields.isGuest]?.column_name
        if (!tokenColumn || !isGuestColumn) return { isValid: false, accessLinkId: null, workspaceId: null }

        if (!IDENTIFIER_REGEX.test(tokenColumn) || !IDENTIFIER_REGEX.test(isGuestColumn)) {
            return { isValid: false, accessLinkId: null, workspaceId: null }
        }

        const tableQt = qSchemaTable(schemaName, binding.tableName)
        const candidateWorkspaceIds = workspacesEnabled
            ? tokenPayload.workspaceId
                ? [tokenPayload.workspaceId]
                : await listActivePublicWorkspaceIds(executor, schemaName)
            : [null]

        for (const workspaceId of candidateWorkspaceIds) {
            if (workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(executor, schemaName, workspaceId)
                if (!hasWorkspace) {
                    continue
                }
            } else {
                await setPublicWorkspaceContext(executor, schemaName, null)
            }

            const rows = await executor.query<{ id: string; guest_session_token: string | null }>(
                `
                SELECT id,
                       "${tokenColumn}" AS guest_session_token
                FROM ${tableQt}
                WHERE id = $1
                  AND "${isGuestColumn}" = true
                  AND ${ACTIVE_ROW_SQL}
                LIMIT 1
                `,
                [studentId]
            )

            const storedState = decodeStoredGuestSessionState(rows[0]?.guest_session_token ?? null)
            const isExpired = !storedState || new Date(storedState.expiresAt).getTime() <= Date.now()
            const isTokenBoundToStoredSession =
                storedState?.linkId === tokenPayload.linkId &&
                (storedState.workspaceId ?? null) === (tokenPayload.workspaceId ?? null) &&
                isSameSecretHash(storedState.secretHash, tokenPayload.secret)

            if (rows.length > 0 && !isExpired && isTokenBoundToStoredSession) {
                return {
                    isValid: true,
                    accessLinkId: tokenPayload.linkId,
                    workspaceId: workspaceId ?? null
                }
            }
        }

        return { isValid: false, accessLinkId: null, workspaceId: null }
    }

    const buildModulePayload = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        moduleId: string,
        locale: string
    ) => {
        const binding = await resolveModuleBinding(executor, schemaName, config)
        if (!binding) return null

        const row = await loadPublicRuntimeRecord(executor, schemaName, binding, moduleId)
        if (!row) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const moduleFields = config.fields.contentNode
        const contentItemFields = config.fields.contentPart
        const contentTable = attrByCodename[moduleFields.contentItems]
        const contentAttrs = resolveChildComponents(binding, contentTable?.id ?? '')
        const contentAttrByCodename = indexByCodename(contentAttrs)
        const childRows = contentTable ? await loadPublicTableRows(executor, schemaName, contentTable, contentAttrs, moduleId) : []
        const enumValueCodeMaps = await loadEnumerationValueCodeMaps(executor, schemaName, contentAttrs)

        const columns = Object.fromEntries(contentAttrs.map((cmp) => [resolveRuntimeCodenameText(cmp.codename), cmp.column_name]))

        return {
            type: 'module' as const,
            id: moduleId,
            title: resolveLocalizedContent(readAttrValue(row, attrByCodename[moduleFields.title]?.column_name ?? 'title'), locale, ''),
            description: resolveLocalizedContent(
                readAttrValue(row, attrByCodename[moduleFields.description]?.column_name ?? 'description'),
                locale,
                ''
            ),
            contentItems: childRows.map((childRow, index) => ({
                id: String(childRow.id),
                itemType: resolveEnumerationRefValue(
                    contentAttrByCodename[contentItemFields.itemType],
                    childRow[columns[contentItemFields.itemType]],
                    enumValueCodeMaps
                ),
                itemTitle: resolveLocalizedContent(childRow[columns[contentItemFields.itemTitle]], locale, ''),
                itemContent: resolveLocalizedContent(childRow[columns[contentItemFields.itemContent]], locale, ''),
                quizId:
                    typeof childRow[columns[contentItemFields.quizId]] === 'string'
                        ? String(childRow[columns[contentItemFields.quizId]])
                        : '',
                sortOrder:
                    typeof childRow[columns[contentItemFields.sortOrder]] === 'number'
                        ? Number(childRow[columns[contentItemFields.sortOrder]])
                        : index
            }))
        }
    }

    const buildQuizPayload = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        quizId: string,
        includeAnswers: boolean,
        locale: string
    ) => {
        const binding = await resolveQuizBinding(executor, schemaName, config)
        if (!binding) return null

        const row = await loadPublicRuntimeRecord(executor, schemaName, binding, quizId)
        if (!row) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const quizFields = config.fields.assessment
        const questionFields = config.fields.assessmentQuestion
        const questionsTable = attrByCodename[quizFields.questions]
        const questionAttrs = questionsTable ? resolveChildComponents(binding, questionsTable.id) : []
        const questionAttrByCodename = indexByCodename(questionAttrs)
        const questionRows = questionsTable ? await loadPublicTableRows(executor, schemaName, questionsTable, questionAttrs, quizId) : []
        const enumValueCodeMaps = await loadEnumerationValueCodeMaps(executor, schemaName, questionAttrs)
        const columns = Object.fromEntries(questionAttrs.map((cmp) => [resolveRuntimeCodenameText(cmp.codename), cmp.column_name]))
        const questions = normalizeQuestionRows(
            questionRows,
            {
                prompt: columns[questionFields.prompt],
                description: columns[questionFields.description],
                questionType: columns[questionFields.questionType],
                explanation: columns[questionFields.explanation],
                sortOrder: columns[questionFields.sortOrder],
                options: columns[questionFields.options]
            },
            {
                locale,
                questionTypeComponent: questionAttrByCodename[questionFields.questionType],
                enumValueCodeMaps
            }
        ).map((question) => ({
            ...question,
            options: includeAnswers ? question.options : question.options.map((option) => ({ id: option.id, label: option.label }))
        }))

        return {
            type: 'quiz' as const,
            id: quizId,
            title: resolveLocalizedContent(readAttrValue(row, attrByCodename[quizFields.title]?.column_name ?? 'title'), locale, ''),
            description: resolveLocalizedContent(
                readAttrValue(row, attrByCodename[quizFields.description]?.column_name ?? 'description'),
                locale,
                ''
            ),
            passingScorePercent: readAttrValue(row, attrByCodename[quizFields.passingScorePercent]?.column_name ?? 'passing_score_percent'),
            questions
        }
    }

    const resolveAllowedRuntimeTarget = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        link: AccessLinkRecord,
        requestedTargetType?: 'content' | 'assessment' | 'module' | 'quiz',
        requestedTargetId?: string
    ): Promise<{ type: 'module' | 'quiz'; id: string } | null> => {
        const baseTargetType = link.targetType === 'quiz' || link.targetType === 'assessment' ? 'quiz' : 'module'
        const normalizedRequestedTargetType =
            requestedTargetType === 'assessment' ? 'quiz' : requestedTargetType === 'content' ? 'module' : requestedTargetType
        const baseTargetId = link.targetId
        if (!UUID_REGEX.test(baseTargetId)) {
            return null
        }

        if (!normalizedRequestedTargetType || !requestedTargetId) {
            return { type: baseTargetType, id: baseTargetId }
        }
        if (!UUID_REGEX.test(requestedTargetId)) {
            return null
        }
        if (normalizedRequestedTargetType === baseTargetType && requestedTargetId === baseTargetId) {
            return { type: baseTargetType, id: baseTargetId }
        }
        if (baseTargetType !== 'module' || normalizedRequestedTargetType !== 'quiz') {
            return null
        }

        const modulePayload = await buildModulePayload(executor, schemaName, config, baseTargetId, 'en')
        if (!modulePayload) {
            return null
        }

        const linkedQuizIds = new Set(
            modulePayload.contentItems
                .map((item) => (typeof item.quizId === 'string' ? item.quizId : ''))
                .filter((quizId) => UUID_REGEX.test(quizId))
        )

        if (!linkedQuizIds.has(requestedTargetId)) {
            return null
        }

        return { type: 'quiz', id: requestedTargetId }
    }

    const withPublicRuntimeContext = async (
        applicationId: string,
        res: Response,
        work: (ctx: PublicRuntimeSchemaContext) => Promise<void>
    ): Promise<void> => {
        const ctx = await resolvePublicRuntimeSchema(getDbExecutor, applicationId, res)
        if (!ctx) {
            return
        }

        if (!ctx.workspacesEnabled) {
            await work(ctx)
            return
        }

        await ctx.manager.transaction(async (tx: DbExecutor) => {
            await work({
                ...ctx,
                manager: tx
            })
        })
    }

    const requirePublicGuestRuntimeConfig = (ctx: PublicRuntimeSchemaContext, res: Response): PublicGuestRuntimeConfig | null => {
        const runtimeConfig = resolvePublicGuestRuntimeConfig(ctx.settings)
        if (runtimeConfig) {
            return runtimeConfig
        }
        res.status(404).json({ error: 'Public guest runtime is not configured for this application' })
        return null
    }

    const resolveLink = async (req: Request, res: Response) => {
        const { applicationId, slug } = req.params
        const locale = typeof req.query.locale === 'string' ? req.query.locale : 'en'
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const link = await loadAccessLinkRecord(ctx.manager, ctx.schemaName, runtimeConfig, ctx.workspacesEnabled, slug)
            if (!link) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                if (!hasWorkspace) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: true })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            res.json({
                id: link.id,
                slug: link.slug,
                title: resolveLocalizedContent(link.title, locale, ''),
                targetType: link.targetType,
                targetId: link.targetId,
                classId: link.classId
            })
        })
    }

    const createGuestSession = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsed = createGuestSessionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const link = await loadAccessLinkRecordById(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                ctx.workspacesEnabled,
                parsed.data.accessLinkId
            )
            if (!link) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                if (!hasWorkspace) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: true })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const studentsBinding = await resolveStudentsBinding(ctx.manager, ctx.schemaName, runtimeConfig)
            if (!studentsBinding) {
                res.status(400).json({ error: 'Participant object is not available in this application' })
                return
            }

            const attrs = resolveTopLevelComponents(studentsBinding)
            const attrByCodename = indexByCodename(attrs)
            const studentFields = runtimeConfig.fields.participant
            const displayNameColumn = attrByCodename[studentFields.displayName]?.column_name
            const isGuestColumn = attrByCodename[studentFields.isGuest]?.column_name
            const tokenColumn = attrByCodename[studentFields.guestSessionToken]?.column_name
            if (!displayNameColumn || !isGuestColumn || !tokenColumn) {
                res.status(400).json({ error: 'Students object is missing guest session fields' })
                return
            }
            if (!IDENTIFIER_REGEX.test(displayNameColumn) || !IDENTIFIER_REGEX.test(isGuestColumn) || !IDENTIFIER_REGEX.test(tokenColumn)) {
                res.status(400).json({ error: 'Participant object has invalid guest session fields' })
                return
            }

            const tableQt = qSchemaTable(ctx.schemaName, studentsBinding.tableName)

            try {
                const payload = await ctx.manager.transaction(async (tx: DbExecutor) => {
                    const consumed = await consumeAccessLinkUse(tx, ctx.schemaName, link)
                    if (!consumed) {
                        const error = new Error('Access link usage limit reached')
                        ;(error as Error & { statusCode?: number }).statusCode = 409
                        throw error
                    }

                    const participantId = await createUuidV7(tx)
                    const sessionSecret = crypto.randomBytes(32).toString('hex')
                    const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_MS).toISOString()
                    const insertColumns = ['id', qColumn(displayNameColumn), qColumn(isGuestColumn), qColumn(tokenColumn)]
                    const insertValues = [
                        participantId,
                        parsed.data.displayName,
                        encodeStoredGuestSessionState({
                            linkId: link.id,
                            secretHash: hashGuestSessionSecret(sessionSecret),
                            expiresAt,
                            workspaceId: link.workspaceId
                        })
                    ]
                    const insertPlaceholders = ['$1', '$2', 'true', '$3']

                    if (ctx.workspacesEnabled && link.workspaceId) {
                        insertColumns.push(qColumn('workspace_id'))
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(link.workspaceId)
                    }

                    insertColumns.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(participantId, participantId)

                    await tx.query(
                        `
                        INSERT INTO ${tableQt} (${insertColumns.join(', ')})
                        VALUES (${insertPlaceholders.join(', ')})
                        `,
                        insertValues
                    )

                    return {
                        participantId,
                        studentId: participantId,
                        sessionToken: encodeGuestSessionToken({ linkId: link.id, secret: sessionSecret, workspaceId: link.workspaceId })
                    }
                })

                res.status(201).json(payload)
            } catch (error) {
                if ((error as Error & { statusCode?: number }).statusCode === 409) {
                    res.status(409).json({ error: 'Access link usage limit reached' })
                    return
                }
                throw error
            }
        })
    }

    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsed = publicRuntimeQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
        }
        const locale = parsed.data.locale ?? 'en'
        const guestSessionRequest = readGuestRuntimeSessionRequest(req)
        if (guestSessionRequest && 'error' in guestSessionRequest) {
            return res.status(400).json({ error: guestSessionRequest.error })
        }

        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            let link: AccessLinkRecord | null = null

            if (guestSessionRequest) {
                const session = await validateGuestSession(
                    ctx.manager,
                    ctx.schemaName,
                    ctx.workspacesEnabled,
                    runtimeConfig,
                    guestSessionRequest.participantId,
                    guestSessionRequest.sessionToken
                )
                if (!session.isValid || !session.accessLinkId) {
                    res.status(403).json({ error: 'Guest session is invalid or expired' })
                    return
                }

                if (ctx.workspacesEnabled) {
                    const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
                    if (!hasWorkspace) {
                        res.status(403).json({ error: 'Guest session workspace is not available' })
                        return
                    }
                }

                link = await loadAccessLinkRecordBy(
                    ctx.manager,
                    ctx.schemaName,
                    runtimeConfig,
                    { type: 'id', value: session.accessLinkId },
                    session.workspaceId
                )
                if (!link) {
                    res.status(403).json({ error: 'Guest session is invalid or expired' })
                    return
                }
            } else {
                link = await loadAccessLinkRecord(ctx.manager, ctx.schemaName, runtimeConfig, ctx.workspacesEnabled, parsed.data.slug)
            }

            if (!link) {
                res.status(404).json({ error: 'Access link not found' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, link.workspaceId)
                if (!hasWorkspace) {
                    res.status(404).json({ error: 'Access link not found' })
                    return
                }
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: false })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const resolvedTarget = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                link,
                parsed.data.targetType,
                parsed.data.targetId
            )
            if (!resolvedTarget) {
                res.status(403).json({ error: 'Requested runtime target is not available for this access link' })
                return
            }

            const payload =
                resolvedTarget.type === 'quiz'
                    ? await buildQuizPayload(ctx.manager, ctx.schemaName, runtimeConfig, resolvedTarget.id, false, locale)
                    : await buildModulePayload(ctx.manager, ctx.schemaName, runtimeConfig, resolvedTarget.id, locale)
            if (!payload) {
                res.status(404).json({ error: 'Runtime target not found' })
                return
            }

            res.json(payload)
        })
    }

    const submitGuestQuiz = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsed = guestSubmitSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const session = await validateGuestSession(
                ctx.manager,
                ctx.schemaName,
                ctx.workspacesEnabled,
                runtimeConfig,
                parsed.data.participantId,
                parsed.data.sessionToken
            )
            if (!session.isValid || !session.accessLinkId) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
                if (!hasWorkspace) {
                    res.status(403).json({ error: 'Guest session workspace is not available' })
                    return
                }
            }

            const link = await loadAccessLinkRecordBy(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                { type: 'id', value: session.accessLinkId },
                session.workspaceId
            )
            if (!link) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: false })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const allowedQuizTarget = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                link,
                'assessment',
                parsed.data.assessmentId
            )
            if (!allowedQuizTarget || allowedQuizTarget.type !== 'quiz') {
                res.status(403).json({ error: 'Quiz is not available for this guest session' })
                return
            }

            const quizPayload = await buildQuizPayload(ctx.manager, ctx.schemaName, runtimeConfig, parsed.data.assessmentId, true, 'en')
            if (!quizPayload || quizPayload.type !== 'quiz') {
                res.status(404).json({ error: 'Quiz not found' })
                return
            }

            const responsesBinding = await resolveQuizResponsesBinding(ctx.manager, ctx.schemaName, runtimeConfig)
            if (!responsesBinding) {
                res.status(400).json({ error: 'Assessment responses object is not available' })
                return
            }

            const attrs = resolveTopLevelComponents(responsesBinding)
            const attrByCodename = indexByCodename(attrs)
            const tableQt = qSchemaTable(ctx.schemaName, responsesBinding.tableName)
            const responseFields = runtimeConfig.fields.assessmentResponse
            const columns = {
                studentId: attrByCodename[responseFields.studentId]?.column_name,
                quizId: attrByCodename[responseFields.quizId]?.column_name,
                questionId: attrByCodename[responseFields.questionId]?.column_name,
                selectedOptionIds: attrByCodename[responseFields.selectedOptionIds]?.column_name,
                isCorrect: attrByCodename[responseFields.isCorrect]?.column_name,
                attemptNumber: attrByCodename[responseFields.attemptNumber]?.column_name,
                submittedAt: attrByCodename[responseFields.submittedAt]?.column_name
            }

            if (Object.values(columns).some((column) => !column)) {
                res.status(400).json({ error: 'Assessment responses object is missing required fields' })
                return
            }

            for (const col of Object.values(columns)) {
                if (!IDENTIFIER_REGEX.test(col)) {
                    res.status(400).json({ error: 'Assessment responses object has invalid column names' })
                    return
                }
            }

            const attemptRows = await ctx.manager.query<{ attemptNumber: number | string | null }>(
                `
                SELECT MAX("${columns.attemptNumber}") AS "attemptNumber"
                FROM ${tableQt}
                WHERE "${columns.studentId}" = $1
                  AND "${columns.quizId}" = $2
                  AND ${ACTIVE_ROW_SQL}
                `,
                [parsed.data.participantId, parsed.data.assessmentId]
            )
            const lastAttemptRaw = attemptRows[0]?.attemptNumber
            const nextAttemptNumber =
                typeof lastAttemptRaw === 'number'
                    ? lastAttemptRaw + 1
                    : typeof lastAttemptRaw === 'string' && Number.isFinite(Number(lastAttemptRaw))
                    ? Number(lastAttemptRaw) + 1
                    : 1

            let score = 0
            await ctx.manager.transaction(async (tx: DbExecutor) => {
                for (const question of quizPayload.questions) {
                    const selectedOptionIds = parsed.data.answers[question.id] ?? []
                    const correctOptionIds = (question.options as Array<{ id: string; label: string; isCorrect?: boolean }>)
                        .filter((option) => option.isCorrect)
                        .map((option) => option.id)
                        .sort()
                    const normalizedSelected = [...selectedOptionIds].sort()
                    const isCorrect =
                        normalizedSelected.length === correctOptionIds.length &&
                        normalizedSelected.every((optionId, index) => optionId === correctOptionIds[index])

                    if (isCorrect) {
                        score += 1
                    }

                    const insertColumns = [
                        'id',
                        qColumn(columns.studentId),
                        qColumn(columns.quizId),
                        qColumn(columns.questionId),
                        qColumn(columns.selectedOptionIds),
                        qColumn(columns.isCorrect),
                        qColumn(columns.attemptNumber),
                        qColumn(columns.submittedAt)
                    ]
                    const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5::jsonb', '$6', '$7', 'NOW()']
                    const insertValues = [
                        await createUuidV7(tx),
                        parsed.data.participantId,
                        parsed.data.assessmentId,
                        question.id,
                        JSON.stringify(selectedOptionIds),
                        isCorrect,
                        nextAttemptNumber
                    ]

                    if (ctx.workspacesEnabled && session.workspaceId) {
                        insertColumns.push(qColumn('workspace_id'))
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(session.workspaceId)
                    }

                    insertColumns.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(parsed.data.participantId, parsed.data.participantId)

                    await tx.query(
                        `
                        INSERT INTO ${tableQt} (${insertColumns.join(', ')})
                        VALUES (${insertPlaceholders.join(', ')})
                        `,
                        insertValues
                    )
                }
            })

            res.json({
                score,
                total: quizPayload.questions.length,
                passed:
                    typeof quizPayload.passingScorePercent === 'number'
                        ? (score / Math.max(quizPayload.questions.length, 1)) * 100 >= quizPayload.passingScorePercent
                        : true
            })
        })
    }

    const updateGuestProgress = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsed = guestProgressSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const session = await validateGuestSession(
                ctx.manager,
                ctx.schemaName,
                ctx.workspacesEnabled,
                runtimeConfig,
                parsed.data.participantId,
                parsed.data.sessionToken
            )
            if (!session.isValid || !session.accessLinkId) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
                if (!hasWorkspace) {
                    res.status(403).json({ error: 'Guest session workspace is not available' })
                    return
                }
            }

            const link = await loadAccessLinkRecordBy(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                { type: 'id', value: session.accessLinkId },
                session.workspaceId
            )
            if (!link) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: false })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const allowedModuleTarget = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                link,
                'content',
                parsed.data.contentNodeId
            )
            if (!allowedModuleTarget || allowedModuleTarget.type !== 'module') {
                res.status(403).json({ error: 'Module is not available for this guest session' })
                return
            }

            const progressBinding = await resolveModuleProgressBinding(ctx.manager, ctx.schemaName, runtimeConfig)
            if (!progressBinding) {
                res.status(500).json({ error: 'Content progress object is not available' })
                return
            }

            const attrs = resolveTopLevelComponents(progressBinding)
            const attrByCodename = indexByCodename(attrs)
            const progressFields = runtimeConfig.fields.contentProgress
            const columns = {
                studentId: attrByCodename[progressFields.studentId]?.column_name,
                moduleId: attrByCodename[progressFields.moduleId]?.column_name,
                status: attrByCodename[progressFields.status]?.column_name,
                progressPercent: attrByCodename[progressFields.progressPercent]?.column_name,
                startedAt: attrByCodename[progressFields.startedAt]?.column_name,
                completedAt: attrByCodename[progressFields.completedAt]?.column_name,
                lastAccessedItemIndex: attrByCodename[progressFields.lastAccessedItemIndex]?.column_name
            }
            if (Object.values(columns).some((column) => !column)) {
                res.status(500).json({ error: 'Content progress object is missing required fields' })
                return
            }

            for (const col of Object.values(columns)) {
                if (!IDENTIFIER_REGEX.test(col)) {
                    res.status(400).json({ error: 'Content progress object has invalid column names' })
                    return
                }
            }

            const tableQt = qSchemaTable(ctx.schemaName, progressBinding.tableName)

            await ctx.manager.transaction(async (tx: DbExecutor) => {
                const existingRows = await tx.query<{ id: string }>(
                    `
                    SELECT id
                    FROM ${tableQt}
                    WHERE "${columns.studentId}" = $1
                      AND "${columns.moduleId}" = $2
                      AND ${ACTIVE_ROW_SQL}
                    LIMIT 1
                    `,
                    [parsed.data.participantId, parsed.data.contentNodeId]
                )

                if (existingRows[0]?.id) {
                    await tx.query(
                        `
                        UPDATE ${tableQt}
                        SET "${columns.status}" = $3,
                            "${columns.progressPercent}" = $4,
                            "${columns.lastAccessedItemIndex}" = $5,
                            "${columns.completedAt}" = CASE WHEN $4 >= 100 THEN NOW() ELSE "${columns.completedAt}" END,
                            ${qColumn('_upl_updated_at')} = NOW(),
                            ${qColumn('_upl_updated_by')} = $1
                        WHERE id = $6
                        `,
                        [
                            parsed.data.participantId,
                            parsed.data.contentNodeId,
                            parsed.data.status,
                            parsed.data.progressPercent,
                            parsed.data.lastAccessedItemIndex,
                            existingRows[0].id
                        ]
                    )
                } else {
                    const insertColumns = [
                        'id',
                        qColumn(columns.studentId),
                        qColumn(columns.moduleId),
                        qColumn(columns.status),
                        qColumn(columns.progressPercent),
                        qColumn(columns.startedAt),
                        qColumn(columns.completedAt),
                        qColumn(columns.lastAccessedItemIndex)
                    ]
                    const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5', 'NOW()', 'CASE WHEN $5 >= 100 THEN NOW() ELSE NULL END', '$6']
                    const insertValues = [
                        await createUuidV7(tx),
                        parsed.data.participantId,
                        parsed.data.contentNodeId,
                        parsed.data.status,
                        parsed.data.progressPercent,
                        parsed.data.lastAccessedItemIndex
                    ]

                    if (ctx.workspacesEnabled && session.workspaceId) {
                        insertColumns.push(qColumn('workspace_id'))
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(session.workspaceId)
                    }

                    insertColumns.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(parsed.data.participantId, parsed.data.participantId)

                    await tx.query(
                        `
                        INSERT INTO ${tableQt} (${insertColumns.join(', ')})
                        VALUES (${insertPlaceholders.join(', ')})
                    `,
                        insertValues
                    )
                }
            })

            res.json({ ok: true })
        })
    }

    const listPublicScripts = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const attachedToKind = typeof req.query.attachedToKind === 'string' ? req.query.attachedToKind : undefined
        const attachedToId = typeof req.query.attachedToId === 'string' ? req.query.attachedToId : undefined
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const items = await scriptsService.listClientScripts({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                attachedToKind: attachedToKind as never,
                attachedToId
            })
            res.json({ items })
        })
    }

    const getPublicClientBundle = async (req: Request, res: Response) => {
        const { applicationId, scriptId } = req.params
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            try {
                const bundle = await scriptsService.getClientScriptBundle({
                    executor: ctx.manager,
                    schemaName: ctx.schemaName,
                    scriptId
                })

                res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                res.setHeader('X-Content-Type-Options', 'nosniff')
                res.setHeader(
                    'Content-Security-Policy',
                    "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data: https: http:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
                )
                res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
                res.status(200).send(bundle.bundle)
            } catch (error) {
                res.status(404).json({ error: error instanceof Error ? error.message : String(error) })
            }
        })
    }

    return {
        resolveLink,
        createGuestSession,
        getRuntime,
        submitGuestQuiz,
        updateGuestProgress,
        listPublicScripts,
        getPublicClientBundle
    }
}
