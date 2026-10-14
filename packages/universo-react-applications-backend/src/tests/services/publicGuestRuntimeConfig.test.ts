import { resolvePublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'

const fields = {
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

const fieldMap = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, `${key}Column`]))

const createValidGuestConfig = () => ({
    objects: {
        accessLinks: 'AccessLinks',
        participants: 'Participants',
        assessments: 'Assessments',
        contentNodes: 'ContentNodes',
        assessmentResponses: 'AssessmentResponses',
        assessmentAttempts: 'AssessmentAttempts',
        contentProgress: 'ContentProgress'
    },
    fields: Object.fromEntries(Object.entries(fields).map(([key, keys]) => [key, fieldMap(keys)]))
})

const expectedResolvedConfig = (config: ReturnType<typeof createValidGuestConfig>) => ({
    objects: {
        accessLinks: config.objects.accessLinks,
        participants: config.objects.participants,
        contentNodes: config.objects.contentNodes,
        contentProgress: config.objects.contentProgress
    },
    fields: {
        accessLink: config.fields.accessLink,
        participant: config.fields.participant,
        contentNode: config.fields.contentNode,
        contentPart: config.fields.contentPart,
        contentProgress: config.fields.contentProgress
    },
    assessment: {
        objects: {
            assessments: config.objects.assessments,
            assessmentResponses: config.objects.assessmentResponses,
            assessmentAttempts: config.objects.assessmentAttempts
        },
        fields: {
            assessment: config.fields.assessment,
            assessmentQuestion: config.fields.assessmentQuestion,
            assessmentResponse: config.fields.assessmentResponse,
            assessmentAttempt: config.fields.assessmentAttempt
        }
    }
})

describe('resolvePublicGuestRuntimeConfig', () => {
    it('resolves the canonical publicRuntime.guest shape and optional access-link content reference', () => {
        const config = createValidGuestConfig()
        config.fields.accessLink = { ...config.fields.accessLink, contentNodeIdRef: 'ContentNodeIdRef' }

        expect(resolvePublicGuestRuntimeConfig({ publicRuntime: { guest: config } })).toEqual({
            ...expectedResolvedConfig(config),
            fields: { ...expectedResolvedConfig(config).fields, accessLink: { ...config.fields.accessLink } }
        })
    })

    it('resolves supported entity and field aliases from the configured settings object', () => {
        const config = createValidGuestConfig()
        const aliasedConfig = {
            objects: {
                accessLinks: config.objects.accessLinks,
                students: config.objects.participants,
                quizzes: config.objects.assessments,
                contentNodes: config.objects.contentNodes,
                quizResponses: config.objects.assessmentResponses,
                quizAttempts: config.objects.assessmentAttempts,
                contentProgress: config.objects.contentProgress
            },
            fields: {
                accessLink: config.fields.accessLink,
                student: config.fields.participant,
                contentNode: config.fields.contentNode,
                contentPart: config.fields.contentPart,
                quiz: config.fields.assessment,
                quizQuestion: config.fields.assessmentQuestion,
                quizResponse: config.fields.assessmentResponse,
                quizAttempt: config.fields.assessmentAttempt,
                contentProgress: config.fields.contentProgress
            }
        }

        expect(resolvePublicGuestRuntimeConfig({ guestRuntime: aliasedConfig })).toEqual(expectedResolvedConfig(config))
    })

    it('keeps content guest access available when optional assessment mappings are absent', () => {
        const config = createValidGuestConfig()
        const {
            assessments: _assessments,
            assessmentResponses: _responses,
            assessmentAttempts: _attempts,
            ...contentObjects
        } = config.objects
        const {
            assessment: _assessment,
            assessmentQuestion: _question,
            assessmentResponse: _response,
            assessmentAttempt: _attempt,
            ...contentFields
        } = config.fields

        const resolved = resolvePublicGuestRuntimeConfig({
            publicRuntime: { guest: { objects: contentObjects, fields: contentFields } }
        })

        expect(resolved).not.toBeNull()
        expect(resolved?.assessment).toBeUndefined()
        expect(resolved?.objects).toEqual({
            accessLinks: config.objects.accessLinks,
            participants: config.objects.participants,
            contentNodes: config.objects.contentNodes,
            contentProgress: config.objects.contentProgress
        })
    })

    it('fails closed for quiz capability when assessment mappings are only partially configured', () => {
        const config = createValidGuestConfig()
        const { questionSetDigest: _questionSetDigest, ...attemptFields } = config.fields.assessmentAttempt

        const resolved = resolvePublicGuestRuntimeConfig({
            publicRuntime: { guest: { ...config, fields: { ...config.fields, assessmentAttempt: attemptFields } } }
        })

        expect(resolved).not.toBeNull()
        expect(resolved?.assessment).toBeUndefined()
    })
})
