export type PublicGuestAssessmentRuntimeConfig = {
    objects: {
        assessments: string
        assessmentResponses: string
        assessmentAttempts: string
    }
    fields: {
        assessment: {
            title: string
            description: string
            passingScorePercent: string
            maxAttempts: string
            timeLimitSeconds: string
            completionText: string
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
            attemptId: string
            questionId: string
            selectedOptionIds: string
            isCorrect: string
            attemptNumber: string
            submittedAt: string
        }
        assessmentAttempt: {
            studentId: string
            quizId: string
            attemptNumber: string
            startedAt: string
            submittedAt: string
            deadlineAt: string
            effectiveTimeLimitSeconds: string
            passingScorePercentSnapshot: string
            finishedReason: string
            questionsSnapshot: string
            questionSetDigest: string
            accessLinkId: string
            score: string
            totalQuestions: string
            passed: string
            status: string
        }
    }
}

export type PublicGuestRuntimeConfig = {
    objects: {
        accessLinks: string
        participants: string
        contentNodes: string
        contentProgress: string
    }
    fields: {
        accessLink: {
            slug: string
            targetType: string
            targetId: string
            contentNodeIdRef?: string
            isActive: string
            expiresAt: string
            maxUses: string
            useCount: string
            title: string
            classId: string
            showFirstName: string
            requireFirstName: string
            showLastName: string
            requireLastName: string
            showEmail: string
            requireEmail: string
            showPhone: string
            requirePhone: string
            captchaEnabled: string
        }
        participant: {
            displayName: string
            firstName: string
            lastName: string
            email: string
            phone: string
            isGuest: string
            guestSessionToken: string
            termsVersion: string
            termsAcceptedAt: string
            privacyVersion: string
            privacyAcceptedAt: string
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
        contentProgress: {
            studentId: string
            contentNodeId: string
            status: string
            progressPercent: string
            startedAt: string
            completedAt: string
            lastAccessedItemIndex: string
        }
    }
    assessment?: PublicGuestAssessmentRuntimeConfig
}

const PUBLIC_GUEST_RUNTIME_OBJECT_ALIASES = {
    accessLinks: ['accessLinks'],
    participants: ['participants', 'students'],
    contentNodes: ['contentNodes'],
    contentProgress: ['contentProgress']
} as const
const PUBLIC_GUEST_ASSESSMENT_OBJECT_ALIASES = {
    assessments: ['assessments', 'quizzes'],
    assessmentResponses: ['assessmentResponses', 'quizResponses'],
    assessmentAttempts: ['assessmentAttempts', 'quizAttempts']
} as const
const PUBLIC_GUEST_RUNTIME_FIELD_KEYS = {
    accessLink: [
        'slug',
        'targetType',
        'targetId',
        'isActive',
        'expiresAt',
        'maxUses',
        'useCount',
        'title',
        'classId',
        'showFirstName',
        'requireFirstName',
        'showLastName',
        'requireLastName',
        'showEmail',
        'requireEmail',
        'showPhone',
        'requirePhone',
        'captchaEnabled'
    ],
    participant: [
        'displayName',
        'firstName',
        'lastName',
        'email',
        'phone',
        'isGuest',
        'guestSessionToken',
        'termsVersion',
        'termsAcceptedAt',
        'privacyVersion',
        'privacyAcceptedAt'
    ],
    contentNode: ['title', 'description', 'contentItems'],
    contentPart: ['itemType', 'itemTitle', 'itemContent', 'quizId', 'sortOrder'],
    assessment: ['title', 'description', 'passingScorePercent', 'maxAttempts', 'timeLimitSeconds', 'completionText', 'questions'],
    assessmentQuestion: ['prompt', 'description', 'questionType', 'explanation', 'sortOrder', 'options'],
    assessmentResponse: [
        'studentId',
        'quizId',
        'attemptId',
        'questionId',
        'selectedOptionIds',
        'isCorrect',
        'attemptNumber',
        'submittedAt'
    ],
    assessmentAttempt: [
        'studentId',
        'quizId',
        'attemptNumber',
        'startedAt',
        'submittedAt',
        'deadlineAt',
        'effectiveTimeLimitSeconds',
        'passingScorePercentSnapshot',
        'finishedReason',
        'questionsSnapshot',
        'questionSetDigest',
        'accessLinkId',
        'score',
        'totalQuestions',
        'passed',
        'status'
    ],
    contentProgress: ['studentId', 'contentNodeId', 'status', 'progressPercent', 'startedAt', 'completedAt', 'lastAccessedItemIndex']
} as const
const PUBLIC_GUEST_RUNTIME_FIELD_ALIASES = {
    accessLink: ['accessLink'],
    participant: ['participant', 'student'],
    contentNode: ['contentNode'],
    contentPart: ['contentPart'],
    assessment: ['assessment', 'quiz'],
    assessmentQuestion: ['assessmentQuestion', 'quizQuestion'],
    assessmentResponse: ['assessmentResponse', 'quizResponse'],
    assessmentAttempt: ['assessmentAttempt', 'quizAttempt'],
    contentProgress: ['contentProgress']
} as const

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const readConfiguredString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

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

const readOptionalFieldByAliases = <K extends keyof typeof PUBLIC_GUEST_RUNTIME_FIELD_ALIASES>(
    rawFields: Record<string, unknown>,
    fieldKey: K,
    fieldName: string
): string | undefined => {
    for (const alias of PUBLIC_GUEST_RUNTIME_FIELD_ALIASES[fieldKey]) {
        const source = rawFields[alias]
        if (!isPlainRecord(source)) continue
        const value = readConfiguredString(source[fieldName])
        if (value) return value
    }
    return undefined
}

export const resolvePublicGuestRuntimeConfig = (settings: Record<string, unknown>): PublicGuestRuntimeConfig | null => {
    const publicRuntime = isPlainRecord(settings.publicRuntime) ? settings.publicRuntime : {}
    const rawConfig = isPlainRecord(publicRuntime.guest)
        ? publicRuntime.guest
        : isPlainRecord(settings.guestRuntime)
        ? settings.guestRuntime
        : null
    if (!rawConfig) return null

    const objects = readConfiguredStringMapByAliases(rawConfig.objects, PUBLIC_GUEST_RUNTIME_OBJECT_ALIASES)
    const assessmentObjects = readConfiguredStringMapByAliases(rawConfig.objects, PUBLIC_GUEST_ASSESSMENT_OBJECT_ALIASES)
    const rawFields = isPlainRecord(rawConfig.fields) ? rawConfig.fields : null
    if (!objects || !rawFields) return null

    const accessLinkFields = readFieldMapByAliases(rawFields, 'accessLink')
    const participantFields = readFieldMapByAliases(rawFields, 'participant')
    const contentNodeFields = readFieldMapByAliases(rawFields, 'contentNode')
    const contentPartFields = readFieldMapByAliases(rawFields, 'contentPart')
    const assessmentFields = readFieldMapByAliases(rawFields, 'assessment')
    const assessmentQuestionFields = readFieldMapByAliases(rawFields, 'assessmentQuestion')
    const assessmentResponseFields = readFieldMapByAliases(rawFields, 'assessmentResponse')
    const assessmentAttemptFields = readFieldMapByAliases(rawFields, 'assessmentAttempt')
    const contentProgressFields = readFieldMapByAliases(rawFields, 'contentProgress')

    if (!accessLinkFields || !participantFields || !contentNodeFields || !contentPartFields || !contentProgressFields) {
        return null
    }

    const contentNodeIdRef = readOptionalFieldByAliases(rawFields, 'accessLink', 'contentNodeIdRef')

    const assessment: PublicGuestAssessmentRuntimeConfig | undefined =
        assessmentObjects && assessmentFields && assessmentQuestionFields && assessmentResponseFields && assessmentAttemptFields
            ? {
                  objects: assessmentObjects,
                  fields: {
                      assessment: assessmentFields,
                      assessmentQuestion: assessmentQuestionFields,
                      assessmentResponse: assessmentResponseFields,
                      assessmentAttempt: assessmentAttemptFields
                  }
              }
            : undefined

    return {
        objects,
        fields: {
            accessLink: contentNodeIdRef ? { ...accessLinkFields, contentNodeIdRef } : accessLinkFields,
            participant: participantFields,
            contentNode: contentNodeFields,
            contentPart: contentPartFields,
            contentProgress: contentProgressFields
        },
        ...(assessment ? { assessment } : {})
    }
}
