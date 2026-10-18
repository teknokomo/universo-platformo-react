import { createRuntimeGuestController } from '../../controllers/runtimeGuestController'
import { asyncHandler } from '../../shared/asyncHandler'
import {
    applicationId,
    schemaName,
    withPublicApplication,
    buildDataSource,
    buildApp,
    express,
    request,
    errorHandler,
    codenameVlc,
    localizedTextVlc,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes', () => {
    installPublicApplicationsTestHooks()

    it('fails closed with one generic response before validating every direct guest route for an unpublished application', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined, { appPublished: false }))
        const app = buildApp(dataSource)
        const routes: Array<{ name: string; send: () => Promise<{ status: number; body: unknown }> }> = [
            {
                name: 'resolve access link',
                send: async () => request(app).get(`/public/a/${applicationId}/links/quiz-link`)
            },
            {
                name: 'create guest session',
                send: async () => request(app).post(`/public/a/${applicationId}/guest-session`).send({})
            },
            {
                name: 'read runtime payload',
                send: async () => request(app).get(`/public/a/${applicationId}/runtime?unexpected=1`)
            },
            {
                name: 'start assessment attempt',
                send: async () => request(app).post(`/public/a/${applicationId}/runtime/attempts/start`).send({})
            },
            {
                name: 'read assessment attempt',
                send: async () => request(app).get(`/public/a/${applicationId}/runtime/attempts/not-a-uuid`)
            },
            {
                name: 'continue assessment block',
                send: async () => request(app).post(`/public/a/${applicationId}/runtime/attempts/not-a-uuid/continue`).send({})
            },
            {
                name: 'save assessment answer',
                send: async () => request(app).put(`/public/a/${applicationId}/runtime/attempts/not-a-uuid/answers`).send({})
            },
            {
                name: 'finalize assessment attempt',
                send: async () => request(app).post(`/public/a/${applicationId}/runtime/attempts/not-a-uuid/finalize`).send({})
            },
            {
                name: 'update guest progress',
                send: async () => request(app).post(`/public/a/${applicationId}/runtime/guest-progress`).send({})
            },
            {
                name: 'list runtime modules',
                send: async () => request(app).get(`/public/a/${applicationId}/runtime/modules`)
            },
            {
                name: 'read runtime module bundle',
                send: async () => request(app).get(`/public/a/${applicationId}/runtime/modules/not-a-uuid/client`)
            }
        ]

        for (const route of routes) {
            const response = await route.send()
            expect({ route: route.name, status: response.status, body: response.body }).toEqual({
                route: route.name,
                status: 404,
                body: { error: 'Public guest runtime is unavailable' }
            })
        }
        expect(dataSource.query.mock.calls.some(([sql]) => String(sql).includes('FROM applications.obj_applications\n'))).toBe(false)
    })

    it('lists only eligible quiz links using public slugs and localized titles', async () => {
        const eligibleId = '018f8a78-7b8f-7c1d-a111-222233334410'
        const expiredId = '018f8a78-7b8f-7c1d-a111-222233334411'
        const exhaustedId = '018f8a78-7b8f-7c1d-a111-222233334412'
        const inactiveId = '018f8a78-7b8f-7c1d-a111-222233334413'
        const nonQuizId = '018f8a78-7b8f-7c1d-a111-222233334414'
        const invalidTargetId = '018f8a78-7b8f-7c1d-a111-222233334415'
        const questionId = '018f8a78-7b8f-7c1d-a111-222233334416'
        const quizIdForList = '018f8a78-7b8f-7c1d-a111-222233334417'
        const safeEligibleId = '018f8a78-7b8f-7c1d-a111-222233334418'
        const accessLinkComponents = [
            ['Slug', 'slug', 'STRING'],
            ['TargetType', 'target_type', 'STRING'],
            ['TargetId', 'target_id', 'STRING'],
            ['IsActive', 'is_active', 'BOOLEAN'],
            ['ExpiresAt', 'expires_at', 'DATE'],
            ['MaxUses', 'max_uses', 'NUMBER'],
            ['UseCount', 'use_count', 'NUMBER'],
            ['LinkTitle', 'title', 'STRING']
        ].map(([codename, column_name, data_type], index) => ({
            id: `link-component-${index}`,
            codename: codenameVlc(codename),
            column_name,
            data_type,
            parent_component_id: null
        }))
        const quizComponents = [
            { id: 'quiz-title', codename: codenameVlc('Title'), column_name: 'title', data_type: 'STRING', parent_component_id: null },
            {
                id: 'quiz-description',
                codename: codenameVlc('Description'),
                column_name: 'description',
                data_type: 'STRING',
                parent_component_id: null
            },
            {
                id: 'quiz-passing-score',
                codename: codenameVlc('PassingScorePercent'),
                column_name: 'passing_score_percent',
                data_type: 'NUMBER',
                parent_component_id: null
            },
            {
                id: 'quiz-max-attempts',
                codename: codenameVlc('MaxAttempts'),
                column_name: 'max_attempts',
                data_type: 'NUMBER',
                parent_component_id: null
            },
            {
                id: 'quiz-time-limit',
                codename: codenameVlc('TimeLimitSeconds'),
                column_name: 'time_limit_seconds',
                data_type: 'NUMBER',
                parent_component_id: null
            },
            {
                id: 'quiz-completion-text',
                codename: codenameVlc('CompletionText'),
                column_name: 'completion_text',
                data_type: 'STRING',
                parent_component_id: null
            },
            {
                id: 'quiz-questions',
                codename: codenameVlc('Questions'),
                column_name: 'quiz_questions',
                data_type: 'TABLE',
                parent_component_id: null
            },
            {
                id: 'question-prompt',
                codename: codenameVlc('Prompt'),
                column_name: 'prompt',
                data_type: 'STRING',
                parent_component_id: 'quiz-questions'
            },
            {
                id: 'question-description',
                codename: codenameVlc('QuestionDescription'),
                column_name: 'question_description',
                data_type: 'STRING',
                parent_component_id: 'quiz-questions'
            },
            {
                id: 'question-type',
                codename: codenameVlc('QuestionType'),
                column_name: 'question_type',
                data_type: 'STRING',
                parent_component_id: 'quiz-questions'
            },
            {
                id: 'question-explanation',
                codename: codenameVlc('Explanation'),
                column_name: 'explanation',
                data_type: 'STRING',
                parent_component_id: 'quiz-questions'
            },
            {
                id: 'question-sort-order',
                codename: codenameVlc('SortOrder'),
                column_name: 'sort_order',
                data_type: 'NUMBER',
                parent_component_id: 'quiz-questions'
            },
            {
                id: 'question-options',
                codename: codenameVlc('Options'),
                column_name: 'options',
                data_type: 'JSON',
                parent_component_id: 'quiz-questions'
            }
        ]
        const candidateRows = [
            {
                id: eligibleId,
                slug: 'public-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: true,
                expires_at: null,
                max_uses: null,
                use_count: 0,
                title: localizedTextVlc('Ambiguous link', 'Неоднозначная ссылка')
            },
            {
                id: safeEligibleId,
                slug: 'safe-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: true,
                expires_at: null,
                max_uses: null,
                use_count: 0,
                title: localizedTextVlc('Assessment link', 'Ссылка на проверку')
            },
            {
                id: '018f8a78-7b8f-7c1d-a111-222233334419',
                slug: 'public-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: false,
                expires_at: null,
                max_uses: null,
                use_count: 0,
                title: localizedTextVlc('Inactive duplicate', 'Неактивный дубликат')
            },
            {
                id: expiredId,
                slug: 'expired-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: true,
                expires_at: '2000-01-01T00:00:00.000Z',
                max_uses: null,
                use_count: 0
            },
            {
                id: exhaustedId,
                slug: 'exhausted-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: true,
                expires_at: null,
                max_uses: 2,
                use_count: 2
            },
            {
                id: inactiveId,
                slug: 'inactive-quiz',
                target_type: 'quiz',
                target_id: quizIdForList,
                is_active: false,
                expires_at: null,
                max_uses: null,
                use_count: 0
            },
            {
                id: nonQuizId,
                slug: 'content-link',
                target_type: 'content',
                target_id: quizIdForList,
                is_active: true,
                expires_at: null,
                max_uses: null,
                use_count: 0
            },
            {
                id: invalidTargetId,
                slug: 'broken-quiz',
                target_type: 'quiz',
                target_id: 'not-a-uuid',
                is_active: true,
                expires_at: null,
                max_uses: null,
                use_count: 0
            }
        ]
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [
                            { id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }
                        ]
                    }
                    if (params[0] === 'Quizzes') {
                        return [{ id: 'object-quizzes', codename: codenameVlc('Quizzes'), kind: 'object', table_name: 'quiz_table' }]
                    }
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') return accessLinkComponents
                    if (params[0] === 'object-quizzes') return quizComponents
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    if (sql.includes('LIMIT 500')) return candidateRows
                    return candidateRows.filter((row) => row.slug === String(params[0]))
                }
                if (sql.includes(`FROM "${schemaName}"."quiz_table"`)) {
                    return [
                        {
                            id: quizIdForList,
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
                                    id: '018f8a78-7b8f-7c1d-a111-222233334424',
                                    label: localizedTextVlc('Saturn', 'Сатурн'),
                                    isCorrect: true
                                },
                                { id: '018f8a78-7b8f-7c1d-a111-222233334425', label: localizedTextVlc('Mars', 'Марс'), isCorrect: false }
                            ]
                        }
                    ]
                }
                return undefined
            })
        )
        const guest = createRuntimeGuestController(() => dataSource)
        const app = express()
        app.use(express.json())
        app.get(
            '/global-short-links/applications/:applicationId/quiz-access-options',
            asyncHandler(guest.listEligiblePublicQuizAccessLinks)
        )
        app.use(errorHandler)

        const response = await request(app)
            .get(`/global-short-links/applications/${applicationId}/quiz-access-options?locale=ru`)
            .expect(200)

        expect(response.body).toEqual({
            items: [{ id: safeEligibleId, slug: 'safe-quiz', label: 'Ссылка на проверку', workspaceId: null, workspaceLabel: null }]
        })
        expect(JSON.stringify(response.body)).not.toMatch(/guest|participant|student|isCorrect|explanation/i)
    })
})
