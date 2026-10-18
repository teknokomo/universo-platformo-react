import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createHash } from 'node:crypto'

export const express = require('express') as typeof import('express')
export const request = require('supertest') as typeof import('supertest')
export const authBackend = require('@universo-react/auth-backend') as typeof import('@universo-react/auth-backend')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createPublicApplicationsRoutes } from '../../routes/publicApplicationsRoutes'

type QueryScope = 'root' | 'tx'
type QueryHandler = (sql: string, params: unknown[], scope: QueryScope) => unknown[] | undefined | Promise<unknown[] | undefined>

export const hashGuestSecret = (secret: string): string => createHash('sha256').update(secret, 'utf8').digest('hex')

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
    next()
}) as RateLimitRequestHandler

export const errorHandler = (err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
        return _next(err)
    }
    res.status(err.statusCode ?? err.status ?? 500).json({ error: err.message || 'Internal Server Error' })
}

export const buildDataSource = (handler?: QueryHandler, options: { serializeAdvisoryLocks?: boolean } = {}) => {
    const { executor, txExecutor } = createMockDbExecutor()
    let generatedUuidIndex = 0
    const transactionSql: string[] = []
    const queryCalls: Array<{ sql: string; params: unknown[]; scope: QueryScope }> = []
    let activeTransactionCount = 0
    const advisoryLockTails = new Map<string, Promise<void>>()
    const acquireTestAdvisoryLock = async (key: string): Promise<() => void> => {
        const previous = advisoryLockTails.get(key) ?? Promise.resolve()
        let releaseLock: () => void = () => undefined
        const lockHeld = new Promise<void>((resolve) => {
            releaseLock = resolve
        })
        const tail = previous.then(() => lockHeld)
        advisoryLockTails.set(key, tail)
        await previous
        return () => {
            releaseLock()
            if (advisoryLockTails.get(key) === tail) advisoryLockTails.delete(key)
        }
    }
    const respond = async (sql: string, params: unknown[] = [], scope: QueryScope) => {
        queryCalls.push({ sql, params, scope })
        if (scope === 'tx') transactionSql.push(sql)
        if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
            generatedUuidIndex += 1
            return [{ id: `018f8a78-7b8f-7c1d-a111-22223333${String(4000 + generatedUuidIndex).padStart(4, '0')}` }]
        }
        const override = await handler?.(sql, params, scope)
        if (override !== undefined) {
            return override
        }
        return []
    }

    ;(executor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'root'))
    ;(txExecutor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'tx'))
    ;(executor.transaction as jest.Mock).mockImplementation(async (callback: (trx: typeof txExecutor) => Promise<unknown>) => {
        if (!options.serializeAdvisoryLocks) {
            activeTransactionCount += 1
            try {
                return await callback(txExecutor)
            } finally {
                activeTransactionCount -= 1
            }
        }

        const heldLocks: Array<() => void> = []
        const transactionExecutor = {
            query: jest.fn(async (sql: string, params: unknown[] = []) => {
                if (sql.includes('pg_advisory_xact_lock(hashtextextended($1::text, 0))')) {
                    heldLocks.push(await acquireTestAdvisoryLock(String(params[0])))
                }
                return respond(sql, params, 'tx')
            }),
            transaction: jest.fn(async (nestedCallback: (trx: typeof txExecutor) => Promise<unknown>) => nestedCallback(txExecutor)),
            isReleased: jest.fn().mockReturnValue(false)
        }

        try {
            activeTransactionCount += 1
            return await callback(transactionExecutor as typeof txExecutor)
        } finally {
            activeTransactionCount -= 1
            heldLocks.reverse().forEach((releaseLock) => releaseLock())
        }
    })

    return Object.assign(executor, { transactionSql, queryCalls, isInTransaction: () => activeTransactionCount > 0 })
}

export const buildApp = (dataSource: ReturnType<typeof buildDataSource>) => {
    const app = express()
    app.use(express.json())
    app.use(
        '/',
        createPublicApplicationsRoutes(() => dataSource, mockRateLimiter, mockRateLimiter)
    )
    app.use(errorHandler)
    return app
}

export const codenameVlc = (value: string) => ({
    _primary: 'en',
    locales: {
        en: { content: value }
    }
})

export const localizedTextVlc = (en: string, ru: string) => ({
    _primary: 'en',
    locales: {
        en: { content: en },
        ru: { content: ru }
    }
})

const publicGuestRuntimeSettings = {
    publicRuntime: {
        guest: {
            objects: {
                accessLinks: 'AccessLinks',
                participants: 'Students',
                assessments: 'Quizzes',
                contentNodes: 'LearningResources',
                assessmentResponses: 'QuizResponses',
                assessmentAttempts: 'QuizAttempts',
                contentProgress: 'ContentProgress'
            },
            fields: {
                accessLink: {
                    slug: 'Slug',
                    targetType: 'TargetType',
                    targetId: 'TargetId',
                    contentNodeIdRef: 'ContentNodeIdRef',
                    isActive: 'IsActive',
                    expiresAt: 'ExpiresAt',
                    maxUses: 'MaxUses',
                    useCount: 'UseCount',
                    title: 'LinkTitle',
                    classId: 'LinkClassId',
                    showFirstName: 'ShowFirstName',
                    requireFirstName: 'RequireFirstName',
                    showLastName: 'ShowLastName',
                    requireLastName: 'RequireLastName',
                    showEmail: 'ShowEmail',
                    requireEmail: 'RequireEmail',
                    showPhone: 'ShowPhone',
                    requirePhone: 'RequirePhone',
                    captchaEnabled: 'CaptchaEnabled'
                },
                participant: {
                    displayName: 'DisplayName',
                    firstName: 'FirstName',
                    lastName: 'LastName',
                    email: 'Email',
                    phone: 'Phone',
                    isGuest: 'IsGuest',
                    guestSessionToken: 'GuestSessionToken',
                    termsVersion: 'TermsVersion',
                    termsAcceptedAt: 'TermsAcceptedAt',
                    privacyVersion: 'PrivacyVersion',
                    privacyAcceptedAt: 'PrivacyAcceptedAt'
                },
                contentNode: {
                    title: 'Title',
                    description: 'Description',
                    contentItems: 'ContentItems'
                },
                contentPart: {
                    itemType: 'ItemType',
                    itemTitle: 'ItemTitle',
                    itemContent: 'ItemContent',
                    quizId: 'QuizId',
                    sortOrder: 'SortOrder'
                },
                assessment: {
                    title: 'Title',
                    description: 'Description',
                    passingScorePercent: 'PassingScorePercent',
                    maxAttempts: 'MaxAttempts',
                    timeLimitSeconds: 'TimeLimitSeconds',
                    confirmAnswerBeforeNext: 'ConfirmAnswerBeforeNext',
                    pauseTimerOnBlockIntro: 'PauseTimerOnBlockIntro',
                    blockRelativeNumbering: 'BlockRelativeNumbering',
                    completionText: 'CompletionText',
                    blocks: 'Blocks',
                    questions: 'Questions'
                },
                assessmentBlock: {
                    blockKey: 'BlockKey',
                    title: 'Title',
                    introduction: 'Introduction',
                    sortOrder: 'SortOrder'
                },
                assessmentQuestion: {
                    prompt: 'Prompt',
                    description: 'QuestionDescription',
                    questionType: 'QuestionType',
                    explanation: 'Explanation',
                    sortOrder: 'SortOrder',
                    blockKey: 'BlockKey',
                    options: 'Options'
                },
                assessmentResponse: {
                    studentId: 'StudentId',
                    quizId: 'QuizId',
                    attemptId: 'AttemptId',
                    questionId: 'QuestionId',
                    selectedOptionIds: 'SelectedOptionIds',
                    isCorrect: 'IsCorrect',
                    attemptNumber: 'AttemptNumber',
                    submittedAt: 'SubmittedAt'
                },
                assessmentAttempt: {
                    studentId: 'StudentId',
                    quizId: 'QuizId',
                    attemptNumber: 'AttemptNumber',
                    startedAt: 'StartedAt',
                    submittedAt: 'SubmittedAt',
                    deadlineAt: 'DeadlineAt',
                    effectiveTimeLimitSeconds: 'EffectiveTimeLimitSeconds',
                    passingScorePercentSnapshot: 'PassingScorePercentSnapshot',
                    finishedReason: 'FinishedReason',
                    questionsSnapshot: 'QuestionsSnapshot',
                    questionSetDigest: 'QuestionSetDigest',
                    flowSnapshot: 'FlowSnapshot',
                    phase: 'Phase',
                    phaseRevision: 'PhaseRevision',
                    timerState: 'TimerState',
                    frozenRemainingMs: 'FrozenRemainingMs',
                    accessLinkId: 'AccessLinkId',
                    classIdSnapshot: 'ClassIdSnapshot',
                    score: 'Score',
                    scorePercent: 'ScorePercent',
                    totalQuestions: 'TotalQuestions',
                    passed: 'Passed',
                    status: 'Status'
                },
                contentProgress: {
                    studentId: 'ProgressStudentId',
                    contentNodeId: 'ContentNodeId',
                    status: 'ProgressStatus',
                    progressPercent: 'ProgressPercent',
                    startedAt: 'StartedAt',
                    completedAt: 'CompletedAt',
                    lastAccessedItemIndex: 'LastAccessedItemIndex'
                }
            }
        }
    }
}

export const applicationId = '018f8a78-7b8f-7c1d-a111-222233334403'
export const schemaName = 'app_018f8a787b8f7c1da111222233334442'
export const contentNodeId = '8f1c1880-2b67-4d79-b02b-a53db0a85453'
export const quizId = '16fe6f92-497d-47dd-a1bc-faf7fe55d765'
export const accessLinkId = '3ea1c528-0868-44b6-a30b-7e63a9f963da'
export const workspaceId1 = '018f8a78-7b8f-7c1d-a111-222233334441'
export const workspaceId2 = '018f8a78-7b8f-7c1d-a111-222233334442'
export const guestIdempotencyKey = Buffer.alloc(32, 19).toString('base64url')

export function installPublicApplicationsTestHooks(): void {
    const previousTermsVersion = process.env.LEGAL_TERMS_VERSION
    const previousPrivacyVersion = process.env.LEGAL_PRIVACY_VERSION

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.LEGAL_TERMS_VERSION = 'tests-terms-v1'
        process.env.LEGAL_PRIVACY_VERSION = 'tests-privacy-v1'
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    afterAll(() => {
        if (previousTermsVersion === undefined) delete process.env.LEGAL_TERMS_VERSION
        else process.env.LEGAL_TERMS_VERSION = previousTermsVersion
        if (previousPrivacyVersion === undefined) delete process.env.LEGAL_PRIVACY_VERSION
        else process.env.LEGAL_PRIVACY_VERSION = previousPrivacyVersion
    })
}

export const withPublicApplication = (handler: QueryHandler, applicationOverrides: Record<string, unknown> = {}): QueryHandler => {
    const accessLinkObjectIds = new Set<string>()
    const accessLinkTableNames = new Set<string>()
    const resolveCodename = (value: unknown): string => {
        if (typeof value === 'string') return value
        if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
        const localized = value as { _primary?: unknown; locales?: Record<string, { content?: unknown }> }
        const primary = typeof localized._primary === 'string' ? localized._primary : 'en'
        const content = localized.locales?.[primary]?.content ?? localized.locales?.en?.content
        return typeof content === 'string' ? content : ''
    }

    return async (sql, params, scope) => {
        if (sql.includes('FROM applications.obj_applications a')) {
            const publicationId = '018f8a78-7b8f-7c1d-a111-222233334401'
            const publicationVersionId = '018f8a78-7b8f-7c1d-a111-222233334402'
            return [
                {
                    id: applicationId,
                    schemaName,
                    schemaStatus: 'synced',
                    isPublic: true,
                    workspacesEnabled: false,
                    aliasRoutingMode: 'direct',
                    installedReleaseMetadata: {
                        kind: 'application_release_installation',
                        bundleVersion: 1,
                        sourceKind: 'publication',
                        snapshotHash: 'a'.repeat(64),
                        publicationId,
                        publicationVersionId
                    },
                    lastSyncedPublicationVersionId: publicationVersionId,
                    uplArchived: false,
                    uplDeleted: false,
                    appPublished: true,
                    appArchived: false,
                    appDeleted: false,
                    hasActiveAlias: false,
                    matchedAlias: null,
                    primaryAlias: null,
                    ...applicationOverrides
                }
            ]
        }
        if (sql.includes('FROM applications.obj_applications')) {
            return [
                {
                    id: applicationId,
                    schemaName,
                    isPublic: true,
                    workspacesEnabled: false,
                    settings: publicGuestRuntimeSettings,
                    ...applicationOverrides
                }
            ]
        }
        if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
            const rows = (await handler(sql, params, scope)) ?? []
            for (const value of rows) {
                if (!value || typeof value !== 'object' || Array.isArray(value)) continue
                const row = value as Record<string, unknown>
                if (resolveCodename(row.codename) !== 'AccessLinks') continue
                if (typeof row.id === 'string') accessLinkObjectIds.add(row.id)
                if (typeof row.table_name === 'string') accessLinkTableNames.add(row.table_name)
            }
            return rows
        }
        if (sql.includes(`FROM "${schemaName}"."_app_components"`) && accessLinkObjectIds.has(String(params[0]))) {
            const rows = (await handler(sql, params, scope)) ?? []
            const hasLinkIdentityFields = rows.some(
                (value) =>
                    Boolean(value) &&
                    typeof value === 'object' &&
                    !Array.isArray(value) &&
                    ['Slug', 'TargetType', 'TargetId', 'IsActive'].includes(resolveCodename((value as Record<string, unknown>).codename))
            )
            const hasFirstNameField = rows.some(
                (value) =>
                    Boolean(value) &&
                    typeof value === 'object' &&
                    !Array.isArray(value) &&
                    resolveCodename((value as Record<string, unknown>).codename) === 'ShowFirstName'
            )
            if (hasLinkIdentityFields && !hasFirstNameField) {
                // Minimal route fixtures inherit the LMS template's visible first-name default.
                return [
                    ...rows,
                    {
                        id: 'test-access-link-show-first-name',
                        codename: 'ShowFirstName',
                        column_name: 'show_first_name',
                        data_type: 'BOOLEAN',
                        parent_component_id: null
                    }
                ]
            }
            return rows
        }
        if ([...accessLinkTableNames].some((tableName) => sql.includes(`"${tableName}"`))) {
            const rows = await handler(sql, params, scope)
            return rows?.map((value) =>
                value && typeof value === 'object' && !Array.isArray(value)
                    ? { shows_first_name: true, ...(value as Record<string, unknown>) }
                    : value
            )
        }
        return handler(sql, params, scope)
    }
}

export const withPublicQuizAccessLink = (handler: QueryHandler = () => undefined): QueryHandler =>
    withPublicApplication((sql, params, scope) => {
        if (sql.includes(`FROM "${schemaName}"."_app_objects"`) && params[0] === 'AccessLinks') {
            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
        }
        if (sql.includes(`FROM "${schemaName}"."_app_components"`) && params[0] === 'object-links') {
            return [
                { id: 'slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                { id: 'target-type', codename: 'TargetType', column_name: 'target_type', data_type: 'STRING', parent_component_id: null },
                { id: 'target-id', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                { id: 'active', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                {
                    id: 'show-first-name',
                    codename: 'ShowFirstName',
                    column_name: 'show_first_name',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                },
                {
                    id: 'require-first-name',
                    codename: 'RequireFirstName',
                    column_name: 'require_first_name',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                },
                {
                    id: 'show-last-name',
                    codename: 'ShowLastName',
                    column_name: 'show_last_name',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                },
                {
                    id: 'require-last-name',
                    codename: 'RequireLastName',
                    column_name: 'require_last_name',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                },
                { id: 'show-email', codename: 'ShowEmail', column_name: 'show_email', data_type: 'BOOLEAN', parent_component_id: null },
                {
                    id: 'require-email',
                    codename: 'RequireEmail',
                    column_name: 'require_email',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                },
                { id: 'show-phone', codename: 'ShowPhone', column_name: 'show_phone', data_type: 'BOOLEAN', parent_component_id: null },
                {
                    id: 'require-phone',
                    codename: 'RequirePhone',
                    column_name: 'require_phone',
                    data_type: 'BOOLEAN',
                    parent_component_id: null
                }
            ]
        }
        if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
            return [
                {
                    id: accessLinkId,
                    slug: 'required-idempotency-quiz',
                    target_type: 'quiz',
                    target_id: quizId,
                    is_active: true,
                    shows_first_name: true,
                    requires_first_name: true,
                    shows_last_name: true,
                    requires_last_name: true
                }
            ]
        }
        return handler(sql, params, scope)
    })

export const buildRevokedAttemptRaceDataSource = (
    options: {
        alreadyRevoked?: boolean
        revokeDuringMutation?: boolean
        expiresAt?: string | null
        existingAttempt?: boolean
        completedAttempt?: boolean
        blockedAttempt?: boolean
        blockTransitionAttempt?: boolean
        quizUnavailable?: boolean
        invalidQuestionOptionId?: boolean
        revokeGuestSessionOnTransactionalRevalidation?: boolean
        retargetDuringMutation?: boolean
        contentTarget?: boolean
        unlinkContentQuizDuringMutation?: boolean
        workspaceId?: string | null
        beforeTransactionalAccessLinkLock?: () => Promise<void>
        serializeAdvisoryLocks?: boolean
    } = {}
) => {
    const guestConfig = publicGuestRuntimeSettings.publicRuntime.guest
    const objectTables: Record<string, string> = {
        AccessLinks: 'access_links_table',
        Students: 'students_table',
        LearningResources: 'learning_resources_table',
        Quizzes: 'quiz_table',
        QuizAttempts: 'quiz_attempts_table',
        QuizResponses: 'quiz_responses_table'
    }
    const objectIds = Object.fromEntries(Object.keys(objectTables).map((name) => [name, `object-${name}`]))
    const objectFields = guestConfig.fields as Record<string, Record<string, string>>
    const fieldGroups: Record<string, string> = {
        AccessLinks: 'accessLink',
        Students: 'participant',
        LearningResources: 'contentNode',
        Quizzes: 'assessment',
        QuizAttempts: 'assessmentAttempt',
        QuizResponses: 'assessmentResponse'
    }
    const componentsByObject = Object.fromEntries(
        Object.entries(fieldGroups).map(([objectName, groupName]) => [
            objectIds[objectName],
            (() => {
                const childTables =
                    objectName === 'Quizzes'
                        ? [
                              { field: 'blocks', group: 'assessmentBlock', table: 'quiz_blocks' },
                              { field: 'questions', group: 'assessmentQuestion', table: 'quiz_questions' }
                          ]
                        : objectName === 'LearningResources'
                        ? [{ field: 'contentItems', group: 'contentPart', table: 'content_items' }]
                        : []
                const components = Object.entries(objectFields[groupName]).map(([fieldName, codename], index) => {
                    const childTable = childTables.find((table) => table.field === fieldName)
                    return {
                        id: `${objectName}-component-${index}`,
                        codename: codenameVlc(codename),
                        column_name: childTable?.table ?? codename.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
                        data_type: childTable ? 'TABLE' : 'STRING',
                        parent_component_id: null as string | null
                    }
                })
                for (const table of childTables) {
                    const fieldCodename = objectFields[groupName][table.field]
                    const childComponent = components.find((component) => component.codename.locales.en.content === fieldCodename)
                    if (childComponent) {
                        Object.entries(objectFields[table.group]).forEach(([, codename], index) => {
                            components.push({
                                id: `${objectName}-${table.field}-component-${index}`,
                                codename: codenameVlc(codename),
                                column_name: codename.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
                                data_type: 'STRING',
                                parent_component_id: childComponent.id
                            })
                        })
                    }
                }
                return components
            })()
        ])
    )
    const linkId = '018f8a78-7b8f-7c1d-a111-222233334420'
    const participantId = '018f8a78-7b8f-7c1d-a111-222233334421'
    const attemptId = '018f8a78-7b8f-7c1d-a111-222233334422'
    const secret = 'race-test-secret'
    const workspaceId = options.workspaceId ?? null
    const sessionToken = Buffer.from(JSON.stringify({ participantId, linkId, secret, workspaceId }), 'utf8').toString('base64url')
    const questionId = '018f8a78-7b8f-7c1d-a111-222233334423'
    const firstBlockKey = '018f8a78-7b8f-7c1d-a111-222233334428'
    const secondBlockKey = '018f8a78-7b8f-7c1d-a111-222233334429'
    const secondQuestionId = '018f8a78-7b8f-7c1d-a111-222233334430'
    const attemptSnapshot = options.blockedAttempt
        ? [
              {
                  id: questionId,
                  prompt: 'Which planet has rings?',
                  description: null,
                  explanation: null,
                  sortOrder: 0,
                  blockKey: firstBlockKey,
                  options: [
                      { id: '018f8a78-7b8f-7c1d-a111-222233334424', label: 'Saturn', isCorrect: true },
                      { id: '018f8a78-7b8f-7c1d-a111-222233334425', label: 'Mars', isCorrect: false }
                  ]
              },
              {
                  id: secondQuestionId,
                  prompt: 'Which planet is red?',
                  description: null,
                  explanation: null,
                  sortOrder: 1,
                  blockKey: secondBlockKey,
                  options: [
                      { id: '018f8a78-7b8f-7c1d-a111-222233334431', label: 'Mars', isCorrect: true },
                      { id: '018f8a78-7b8f-7c1d-a111-222233334432', label: 'Neptune', isCorrect: false }
                  ]
              }
          ]
        : [
              {
                  id: questionId,
                  prompt: 'Which planet has rings?',
                  description: null,
                  explanation: null,
                  sortOrder: 0,
                  blockKey: null,
                  options: [
                      { id: '018f8a78-7b8f-7c1d-a111-222233334424', label: 'Saturn', isCorrect: true },
                      { id: '018f8a78-7b8f-7c1d-a111-222233334425', label: 'Mars', isCorrect: false }
                  ]
              }
          ]
    const existingAttemptRow: Record<string, unknown> & { id: string } = {
        id: attemptId,
        studentId: participantId,
        quizId,
        attemptNumber: 1,
        startedAt: '2026-10-10T12:00:00.000Z',
        submittedAt: options.completedAttempt ? '2026-10-10T12:05:00.000Z' : null,
        deadlineAt: null,
        effectiveTimeLimitSeconds: 0,
        passingScorePercentSnapshot: 70,
        finishedReason: options.completedAttempt ? 'submitted' : null,
        questionsSnapshot: attemptSnapshot,
        questionSetDigest: 'a'.repeat(64),
        flowSnapshot: options.blockedAttempt
            ? {
                  contractVersion: 1,
                  blocks: [
                      { key: firstBlockKey, title: 'Planets', introduction: 'First block', sortOrder: 0 },
                      { key: secondBlockKey, title: 'Orbits', introduction: 'Second block', sortOrder: 1 }
                  ],
                  pauseTimerOnBlockIntro: false,
                  numberingMode: 'block',
                  completionText: ''
              }
            : { contractVersion: 1, blocks: [], pauseTimerOnBlockIntro: false, numberingMode: 'global', completionText: '' },
        phase: options.blockedAttempt ? 'block_intro' : 'question',
        phaseRevision: options.blockTransitionAttempt ? 1 : 0,
        timerState: 'untimed',
        frozenRemainingMs: null,
        accessLinkId: linkId,
        score: 0,
        totalQuestions: options.blockedAttempt ? 2 : 1,
        passed: false,
        status: options.completedAttempt ? 'Submitted' : 'Started'
    }
    const attemptQueries: string[] = []
    const responseQueries: string[] = []
    const quizQueries: string[] = []
    const accessLinkActiveStates: boolean[] = []
    const accessLinkMutationStates: boolean[] = []
    const accessLinkTargetIds: string[] = []
    const retargetedQuizId = '018f8a78-7b8f-7c1d-a111-222233334426'
    let guestSessionRevoked = false
    let accessLinkActiveOverride: boolean | undefined
    let guestSessionReadCount = 0
    let contentQuizUnlinked = false
    const dataSource = buildDataSource(
        withPublicApplication(
            async (sql, params, scope) => {
                if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                    return workspaceId ? [{ id: workspaceId }] : []
                }
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    const objectName = String(params[0])
                    if (!objectTables[objectName]) return []
                    return [
                        {
                            id: objectIds[objectName],
                            codename: codenameVlc(objectName),
                            kind: 'object',
                            table_name: objectTables[objectName]
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return componentsByObject[String(params[0])] ?? []
                }
                if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                    guestSessionReadCount += 1
                    const isSessionRevoked =
                        guestSessionRevoked ||
                        (options.revokeGuestSessionOnTransactionalRevalidation && scope === 'tx' && guestSessionReadCount > 1)
                    return [
                        {
                            id: participantId,
                            guest_session_token: isSessionRevoked
                                ? null
                                : JSON.stringify({
                                      participantId,
                                      linkId,
                                      secretHash: hashGuestSecret(secret),
                                      expiresAt: '2099-01-01T00:00:00.000Z',
                                      workspaceId,
                                      quizIntakeIdempotencyKeyHash: 'a'.repeat(64)
                                  }),
                            terms_version: 'terms 2026.10',
                            terms_accepted_at: '2026-10-10T12:00:00.000Z',
                            privacy_version: 'privacy 2026.10',
                            privacy_accepted_at: '2026-10-10T12:00:00.000Z'
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    if (scope === 'tx' && /FOR UPDATE/i.test(sql)) {
                        await options.beforeTransactionalAccessLinkLock?.()
                        if (options.contentTarget && options.unlinkContentQuizDuringMutation) contentQuizUnlinked = true
                    }
                    const isActive =
                        accessLinkActiveOverride ??
                        (options.alreadyRevoked ? false : options.revokeDuringMutation === false || scope !== 'tx')
                    accessLinkActiveStates.push(isActive)
                    const targetId = options.retargetDuringMutation && scope === 'tx' && /FOR UPDATE/i.test(sql) ? retargetedQuizId : quizId
                    accessLinkTargetIds.push(targetId)
                    return [
                        {
                            id: linkId,
                            slug: 'revoked-quiz',
                            target_type: options.contentTarget ? 'content' : 'quiz',
                            target_id: options.contentTarget ? contentNodeId : targetId,
                            content_node_id_ref: options.contentTarget ? contentNodeId : null,
                            is_active: isActive,
                            expires_at: options.expiresAt ?? null,
                            max_uses: null,
                            use_count: 0,
                            workspace_id: workspaceId,
                            title: localizedTextVlc('Quiz link', 'Ссылка на тест'),
                            shows_first_name: true,
                            requires_first_name: true,
                            shows_last_name: true,
                            requires_last_name: true
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."quiz_table"`)) {
                    quizQueries.push(sql)
                    if (options.quizUnavailable) return []
                    return [
                        {
                            id: quizId,
                            title: localizedTextVlc('Planetary Science Quiz', 'Тест по планетологии'),
                            description: localizedTextVlc('Description', 'Описание'),
                            passing_score_percent: 70,
                            max_attempts: 3,
                            time_limit_seconds: null,
                            completion_text: localizedTextVlc('Complete', 'Готово')
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."quiz_questions"`)) {
                    quizQueries.push(sql)
                    if (options.quizUnavailable) return []
                    return [
                        {
                            id: questionId,
                            prompt: localizedTextVlc('Which planet has rings?', 'У какой планеты есть кольца?'),
                            question_description: null,
                            question_type: 'single_choice',
                            explanation: null,
                            sort_order: 0,
                            options: [
                                {
                                    id: options.invalidQuestionOptionId
                                        ? '018f8a78-7b8f-4c1d-a111-222233334424'
                                        : '018f8a78-7b8f-7c1d-a111-222233334424',
                                    label: localizedTextVlc('Saturn', 'Сатурн'),
                                    isCorrect: true
                                },
                                { id: '018f8a78-7b8f-7c1d-a111-222233334425', label: localizedTextVlc('Mars', 'Марс'), isCorrect: false }
                            ]
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [
                        {
                            id: contentNodeId,
                            title: localizedTextVlc('Astronomy course', 'Курс астрономии'),
                            description: localizedTextVlc('Course description', 'Описание курса')
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334427',
                            item_type: 'quiz',
                            item_title: localizedTextVlc('Planetary Science Quiz', 'Тест по планетологии'),
                            item_content: '',
                            quiz_id: contentQuizUnlinked ? null : quizId,
                            sort_order: 0
                        }
                    ]
                }
                if (sql.includes(`"${schemaName}"."quiz_attempts_table"`)) {
                    attemptQueries.push(sql)
                    if (/^\s*UPDATE\s/i.test(sql)) {
                        if (options.blockedAttempt) {
                            const fieldsByColumn = Object.fromEntries(
                                Object.entries(objectFields.assessmentAttempt).map(([field, codename]) => [
                                    codename.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
                                    field
                                ])
                            )
                            const setClause = sql.match(/\bSET\s+([\s\S]*?)\s+WHERE\b/i)?.[1] ?? ''
                            for (const [, column, parameter] of setClause.matchAll(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*=\s*\$(\d+)/g)) {
                                const field = fieldsByColumn[column]
                                if (field) existingAttemptRow[field] = params[Number(parameter) - 1]
                            }
                        }
                        return [{ id: attemptId }]
                    }
                    if (options.existingAttempt && sql.includes('SELECT')) return [existingAttemptRow]
                    return []
                }
                if (sql.includes(`"${schemaName}"."quiz_responses_table"`)) {
                    responseQueries.push(sql)
                    if (options.blockTransitionAttempt || options.completedAttempt) {
                        return [
                            {
                                questionId,
                                selectedOptionIds: JSON.stringify([attemptSnapshot[0]?.options[0]?.id]),
                                isCorrect: true
                            }
                        ]
                    }
                    return []
                }
                return undefined
            },
            { workspacesEnabled: Boolean(workspaceId) }
        ),
        { serializeAdvisoryLocks: options.serializeAdvisoryLocks }
    )

    return {
        dataSource,
        linkId,
        participantId,
        attemptId,
        questionId,
        sessionToken,
        attemptQueries,
        responseQueries,
        quizQueries,
        accessLinkActiveStates,
        accessLinkTargetIds,
        retargetedQuizId,
        accessLinkMutationStates,
        revokeAndReenableAccessLink: () => {
            guestSessionRevoked = true
            accessLinkActiveOverride = false
            accessLinkMutationStates.push(false)
            accessLinkActiveOverride = true
            accessLinkMutationStates.push(true)
        }
    }
}
