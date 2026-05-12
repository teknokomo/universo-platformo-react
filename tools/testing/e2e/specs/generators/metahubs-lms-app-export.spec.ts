import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildSnapshotEnvelope, buildVLC, validateSnapshotEnvelope } from '@universo/utils'
import { waitForMetahubCatalogId, waitForMetahubEnumerationId, waitForOptionValueId } from '../../support/lmsRuntime'
import {
    assertLmsFixtureEnvelopeContract,
    buildLmsLiveMetahubCodename,
    buildLmsLiveMetahubName,
    LMS_CANONICAL_METAHUB,
    LMS_DEMO_ACCESS_LINKS,
    LMS_DEMO_CLASSES,
    LMS_DEMO_COURSES,
    LMS_DEMO_DEVELOPMENT_PLAN,
    LMS_DEMO_ENROLLMENTS,
    LMS_DEMO_KNOWLEDGE_SPACE,
    LMS_DEMO_MODULE_PROGRESS,
    LMS_DEMO_MODULES,
    LMS_DEMO_QUIZ_RESPONSES,
    LMS_DEMO_QUIZZES,
    LMS_DEMO_REPORTS,
    LMS_DEMO_RESOURCES,
    LMS_DEMO_STUDENTS,
    LMS_FIXTURE_FILENAME
} from '../../support/lmsFixtureContract'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')

async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

async function seedCanonicalLmsRecords(api: ApiContext, metahubId: string) {
    const [
        classesCatalogId,
        studentsCatalogId,
        learningResourcesCatalogId,
        coursesCatalogId,
        courseSectionsCatalogId,
        learningTracksCatalogId,
        trackStepsCatalogId,
        modulesCatalogId,
        quizzesCatalogId,
        quizResponsesCatalogId,
        moduleProgressCatalogId,
        accessLinksCatalogId,
        enrollmentsCatalogId,
        knowledgeSpacesCatalogId,
        knowledgeFoldersCatalogId,
        knowledgeBookmarksCatalogId,
        developmentPlansCatalogId,
        developmentPlanStagesCatalogId,
        developmentPlanTasksCatalogId,
        reportsCatalogId,
        contentTypeEnumerationId,
        resourceTypeEnumerationId,
        moduleStatusEnumerationId,
        questionTypeEnumerationId,
        enrollmentStatusEnumerationId,
        completionStatusEnumerationId,
        reportTypeEnumerationId
    ] = await Promise.all([
        waitForMetahubCatalogId(api, metahubId, 'Classes'),
        waitForMetahubCatalogId(api, metahubId, 'Students'),
        waitForMetahubCatalogId(api, metahubId, 'Learning Resources'),
        waitForMetahubCatalogId(api, metahubId, 'Courses'),
        waitForMetahubCatalogId(api, metahubId, 'Course Sections'),
        waitForMetahubCatalogId(api, metahubId, 'Learning Tracks'),
        waitForMetahubCatalogId(api, metahubId, 'Track Steps'),
        waitForMetahubCatalogId(api, metahubId, 'Modules'),
        waitForMetahubCatalogId(api, metahubId, 'Quizzes'),
        waitForMetahubCatalogId(api, metahubId, 'Quiz Responses'),
        waitForMetahubCatalogId(api, metahubId, 'Module Progress'),
        waitForMetahubCatalogId(api, metahubId, 'Access Links'),
        waitForMetahubCatalogId(api, metahubId, 'Enrollments'),
        waitForMetahubCatalogId(api, metahubId, 'Knowledge Spaces'),
        waitForMetahubCatalogId(api, metahubId, 'Knowledge Folders'),
        waitForMetahubCatalogId(api, metahubId, 'Knowledge Bookmarks'),
        waitForMetahubCatalogId(api, metahubId, 'Development Plans'),
        waitForMetahubCatalogId(api, metahubId, 'Development Plan Stages'),
        waitForMetahubCatalogId(api, metahubId, 'Development Plan Tasks'),
        waitForMetahubCatalogId(api, metahubId, 'Reports'),
        waitForMetahubEnumerationId(api, metahubId, 'Content Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Resource Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Module Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Question Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Enrollment Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Completion Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Report Type')
    ])

    const [
        textValueId,
        quizRefValueId,
        pageResourceTypeValueId,
        videoResourceTypeValueId,
        publishedModuleStatusValueId,
        singleChoiceValueId,
        activeEnrollmentStatusValueId,
        notStartedCompletionStatusValueId,
        inProgressCompletionStatusValueId,
        progressReportTypeValueId
    ] =
        await Promise.all([
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'Text'),
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'QuizRef'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Page'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Video'),
            waitForOptionValueId(api, metahubId, moduleStatusEnumerationId, 'Published'),
            waitForOptionValueId(api, metahubId, questionTypeEnumerationId, 'SingleChoice'),
            waitForOptionValueId(api, metahubId, enrollmentStatusEnumerationId, 'Active'),
            waitForOptionValueId(api, metahubId, completionStatusEnumerationId, 'NotStarted'),
            waitForOptionValueId(api, metahubId, completionStatusEnumerationId, 'InProgress'),
            waitForOptionValueId(api, metahubId, reportTypeEnumerationId, 'Progress')
        ])

    const classRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededClass of LMS_DEMO_CLASSES) {
        const classRow = await createRecord(api, metahubId, classesCatalogId, {
            data: {
                Name: buildVLC(seededClass.name.en, seededClass.name.ru),
                Description: buildVLC(seededClass.description.en, seededClass.description.ru),
                SchoolYear: seededClass.schoolYear,
                StudentCountLimit: seededClass.studentCountLimit
            }
        })
        classRowsByKey.set(seededClass.key, classRow)
    }

    const studentRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededStudent of LMS_DEMO_STUDENTS) {
        const studentRow = await createRecord(api, metahubId, studentsCatalogId, {
            data: {
                DisplayName: seededStudent.displayName.en,
                Email: seededStudent.email,
                IsGuest: false,
                GuestSessionToken: null
            }
        })
        studentRowsByKey.set(seededStudent.key, studentRow)
    }

    const resourceRowsByCodename = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededResource of LMS_DEMO_RESOURCES) {
        const resourceTypeValueId = seededResource.source.type === 'video' ? videoResourceTypeValueId : pageResourceTypeValueId
        const resourceRow = await createRecord(api, metahubId, learningResourcesCatalogId, {
            data: {
                Title: seededResource.title,
                ResourceType: resourceTypeValueId,
                Source: seededResource.source,
                EstimatedTimeMinutes: seededResource.estimatedTimeMinutes ?? 0,
                Language: seededResource.language ?? 'en'
            }
        })
        resourceRowsByCodename.set(seededResource.codename, resourceRow)
    }

    const courseRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededCourse of LMS_DEMO_COURSES) {
        const courseRow = await createRecord(api, metahubId, coursesCatalogId, {
            data: {
                Title: buildVLC(seededCourse.title.en, seededCourse.title.ru),
                Description: buildVLC(seededCourse.description.en, seededCourse.description.ru),
                Status: publishedModuleStatusValueId,
                EstimatedTimeMinutes: seededCourse.estimatedTimeMinutes
            }
        })
        courseRowsByKey.set(seededCourse.key, courseRow)
    }

    const quizRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededQuiz of LMS_DEMO_QUIZZES) {
        const quizRow = await createRecord(api, metahubId, quizzesCatalogId, {
            data: {
                Title: buildVLC(seededQuiz.title.en, seededQuiz.title.ru),
                Description: buildVLC(seededQuiz.description.en, seededQuiz.description.ru),
                PassingScorePercent: seededQuiz.passingScorePercent,
                MaxAttempts: seededQuiz.maxAttempts,
                Questions: seededQuiz.questions.en.map((question, index) => ({
                    Id: `${seededQuiz.key}-question-${index + 1}`,
                    Prompt: buildVLC(question.prompt, seededQuiz.questions.ru[index].prompt),
                    QuestionDescription: buildVLC(question.description, seededQuiz.questions.ru[index].description),
                    QuestionType: singleChoiceValueId,
                    Difficulty: 1,
                    Explanation: buildVLC(question.explanation, seededQuiz.questions.ru[index].explanation),
                    Options: question.options,
                    SortOrder: question.sortOrder
                }))
            }
        })
        quizRowsByKey.set(seededQuiz.key, quizRow)
    }

    const moduleRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededModule of LMS_DEMO_MODULES) {
        const moduleRow = await createRecord(api, metahubId, modulesCatalogId, {
            data: {
                Title: buildVLC(seededModule.title.en, seededModule.title.ru),
                Description: buildVLC(seededModule.description.en, seededModule.description.ru),
                Status: publishedModuleStatusValueId,
                EstimatedDurationMinutes: seededModule.estimatedDurationMinutes,
                AccessLinkSlug: seededModule.accessLinkSlug,
                ContentItems: seededModule.contentItems.en.map((item, index) => {
                    const localizedItem = seededModule.contentItems.ru[index]
                    const isQuizRef = item.itemType === 'QuizRef'
                    return {
                        ItemType: isQuizRef ? quizRefValueId : textValueId,
                        ItemTitle: buildVLC(item.itemTitle, localizedItem.itemTitle),
                        ...(item.itemContent
                            ? { ItemContent: buildVLC(item.itemContent, localizedItem.itemContent ?? localizedItem.itemTitle) }
                            : {}),
                        ...(isQuizRef ? { QuizId: quizRowsByKey.get(seededModule.linkedQuizKey)?.id ?? null } : {}),
                        SortOrder: item.sortOrder
                    }
                })
            }
        })
        moduleRowsByKey.set(seededModule.key, moduleRow)
    }

    const onboardingCourse = courseRowsByKey.get('onboarding-course')
    const complianceCourse = courseRowsByKey.get('compliance-course')
    const overviewResource = resourceRowsByCodename.get('CourseOverviewPageResource')
    const safetyVideoResource = resourceRowsByCodename.get('SafetyVideoResource')
    const certificatePolicyResource = resourceRowsByCodename.get('CertificatePolicyResource')

    const courseSections = [
        {
            course: onboardingCourse,
            title: buildVLC('Start with the course overview', 'Начните с обзора курса'),
            resource: overviewResource,
            module: moduleRowsByKey.get('learning-path'),
            sortOrder: 1
        },
        {
            course: onboardingCourse,
            title: buildVLC('Watch the safety intro', 'Посмотрите вводное видео по безопасности'),
            resource: safetyVideoResource,
            module: moduleRowsByKey.get('docking-corridor'),
            sortOrder: 2
        },
        {
            course: complianceCourse,
            title: buildVLC('Read the certificate policy', 'Изучите политику сертификатов'),
            resource: certificatePolicyResource,
            module: moduleRowsByKey.get('lunar-logistics'),
            sortOrder: 1
        }
    ]

    for (const section of courseSections) {
        await createRecord(api, metahubId, courseSectionsCatalogId, {
            data: {
                CourseId: section.course?.id ?? null,
                Title: section.title,
                ResourceId: section.resource?.id ?? null,
                ModuleId: section.module?.id ?? null,
                SortOrder: section.sortOrder
            }
        })
    }

    const trackRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    const onboardingTrack = await createRecord(api, metahubId, learningTracksCatalogId, {
        data: {
            Title: buildVLC('New learner onboarding track', 'Трек адаптации нового учащегося'),
            Description: buildVLC('A guided sequence for the first learning week.', 'Последовательный маршрут на первую учебную неделю.'),
            TrackItems: [
                { ModuleId: moduleRowsByKey.get('learning-path')?.id ?? null, Required: true, SortOrder: 1 },
                { ModuleId: moduleRowsByKey.get('docking-corridor')?.id ?? null, Required: true, SortOrder: 2 }
            ]
        }
    })
    trackRowsByKey.set('onboarding-track', onboardingTrack)

    const complianceTrack = await createRecord(api, metahubId, learningTracksCatalogId, {
        data: {
            Title: buildVLC('Compliance refresh track', 'Трек обновления требований'),
            Description: buildVLC('A short periodic compliance route.', 'Короткий периодический маршрут по требованиям.'),
            TrackItems: [{ ModuleId: moduleRowsByKey.get('lunar-logistics')?.id ?? null, Required: true, SortOrder: 1 }]
        }
    })
    trackRowsByKey.set('compliance-track', complianceTrack)

    const trackSteps = [
        {
            track: onboardingTrack,
            title: buildVLC('Complete Learning Path 101', 'Завершить учебный маршрут 101'),
            module: moduleRowsByKey.get('learning-path'),
            resource: overviewResource,
            sortOrder: 1
        },
        {
            track: onboardingTrack,
            title: buildVLC('Complete Docking Corridor Basics', 'Завершить основы стыковочного коридора'),
            module: moduleRowsByKey.get('docking-corridor'),
            resource: safetyVideoResource,
            sortOrder: 2
        },
        {
            track: complianceTrack,
            title: buildVLC('Complete Lunar Supply Windows', 'Завершить окна лунных поставок'),
            module: moduleRowsByKey.get('lunar-logistics'),
            resource: certificatePolicyResource,
            sortOrder: 1
        }
    ]

    for (const step of trackSteps) {
        await createRecord(api, metahubId, trackStepsCatalogId, {
            data: {
                TrackId: step.track.id,
                Title: step.title,
                ModuleId: step.module?.id ?? null,
                ResourceId: step.resource?.id ?? null,
                SortOrder: step.sortOrder,
                Required: true
            }
        })
    }

    for (const seededLink of LMS_DEMO_ACCESS_LINKS) {
        await createRecord(api, metahubId, accessLinksCatalogId, {
            data: {
                Slug: seededLink.slug,
                TargetType: 'module',
                TargetId: moduleRowsByKey.get(seededLink.moduleKey)?.id ?? null,
                LinkClassId: classRowsByKey.get(seededLink.classKey)?.id ?? null,
                IsActive: true,
                MaxUses: 50,
                UseCount: 0,
                LinkTitle: buildVLC(seededLink.title.en, seededLink.title.ru)
            }
        })
    }

    for (const seededEnrollment of LMS_DEMO_ENROLLMENTS) {
        await createRecord(api, metahubId, enrollmentsCatalogId, {
            data: {
                EnrollmentStudentId: studentRowsByKey.get(seededEnrollment.studentKey)?.id ?? null,
                EnrollmentClassId: classRowsByKey.get(seededEnrollment.classKey)?.id ?? null,
                ModuleIdRef: moduleRowsByKey.get(seededEnrollment.moduleKey)?.id ?? null,
                EnrollmentStatus: activeEnrollmentStatusValueId,
                EnrolledAt: '2061-02-01T08:00:00.000Z',
                CompletedAt: seededEnrollment.moduleKey === 'docking-corridor' ? null : '2061-02-01T10:00:00.000Z',
                Score: seededEnrollment.moduleKey === 'docking-corridor' ? 50 : 100
            }
        })
    }

    for (const seededProgress of LMS_DEMO_MODULE_PROGRESS) {
        await createRecord(api, metahubId, moduleProgressCatalogId, {
            data: {
                ProgressStudentId: studentRowsByKey.get(seededProgress.studentKey)?.id ?? null,
                ModuleId: moduleRowsByKey.get(seededProgress.moduleKey)?.id ?? null,
                ProgressStatus: seededProgress.status,
                ProgressPercent: seededProgress.progressPercent,
                StartedAt: '2061-02-01T08:15:00.000Z',
                CompletedAt: seededProgress.status === 'completed' ? '2061-02-01T10:00:00.000Z' : null,
                LastAccessedItemIndex: seededProgress.status === 'completed' ? 2 : 1
            }
        })
    }

    for (const seededResponse of LMS_DEMO_QUIZ_RESPONSES) {
        await createRecord(api, metahubId, quizResponsesCatalogId, {
            data: {
                StudentId: studentRowsByKey.get(seededResponse.studentKey)?.id ?? null,
                QuizId: quizRowsByKey.get(seededResponse.quizKey)?.id ?? null,
                QuestionId: seededResponse.questionId,
                SelectedOptionIds: seededResponse.selectedOptionIds,
                IsCorrect: seededResponse.isCorrect,
                AttemptNumber: seededResponse.attemptNumber,
                SubmittedAt: '2061-02-01T08:20:00.000Z'
            }
        })
    }

    const knowledgeSpaceRow = await createRecord(api, metahubId, knowledgeSpacesCatalogId, {
        data: {
            Title: buildVLC(LMS_DEMO_KNOWLEDGE_SPACE.title.en, LMS_DEMO_KNOWLEDGE_SPACE.title.ru),
            Description: buildVLC(LMS_DEMO_KNOWLEDGE_SPACE.description.en, LMS_DEMO_KNOWLEDGE_SPACE.description.ru),
            Visibility: 'workspace'
        }
    })
    const knowledgeFolderRow = await createRecord(api, metahubId, knowledgeFoldersCatalogId, {
        data: {
            SpaceId: knowledgeSpaceRow.id,
            Title: buildVLC('Getting started articles', 'Статьи для старта'),
            ArticlePageCodename: 'KnowledgeArticle',
            SortOrder: 1
        }
    })
    await createRecord(api, metahubId, knowledgeBookmarksCatalogId, {
        data: {
            StudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            FolderId: knowledgeFolderRow.id,
            CreatedAt: '2061-02-01T09:00:00.000Z'
        }
    })

    const developmentPlanRow = await createRecord(api, metahubId, developmentPlansCatalogId, {
        data: {
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.title.en, LMS_DEMO_DEVELOPMENT_PLAN.title.ru),
            StudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            SupervisorEmail: 'supervisor@example.test',
            Status: inProgressCompletionStatusValueId
        }
    })
    const developmentStageRow = await createRecord(api, metahubId, developmentPlanStagesCatalogId, {
        data: {
            PlanId: developmentPlanRow.id,
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.stageTitle.en, LMS_DEMO_DEVELOPMENT_PLAN.stageTitle.ru),
            SortOrder: 1
        }
    })
    await createRecord(api, metahubId, developmentPlanTasksCatalogId, {
        data: {
            StageId: developmentStageRow.id,
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.taskTitle.en, LMS_DEMO_DEVELOPMENT_PLAN.taskTitle.ru),
            ResourceId: overviewResource?.id ?? null,
            Status: notStartedCompletionStatusValueId
        }
    })

    for (const reportDefinition of LMS_DEMO_REPORTS) {
        await createRecord(api, metahubId, reportsCatalogId, {
            data: {
                Name: reportDefinition.title,
                ReportType: progressReportTypeValueId,
                Filters: reportDefinition.filters,
                Definition: reportDefinition,
                SavedFilters: [{ name: buildVLC('All active learners', 'Все активные учащиеся'), filters: reportDefinition.filters }]
            }
        })
    }
}

test.describe('Metahubs LMS App Export', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical lms metahub and export snapshot fixture', async ({ runManifest }) => {
        test.setTimeout(300_000)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })

        const metahubName = buildLmsLiveMetahubName(runManifest.runId)
        const metahubCodename = buildLmsLiveMetahubCodename(runManifest.runId)
        const metahub = await createMetahub(api, {
            name: metahubName,
            namePrimaryLocale: 'en',
            codename: metahubCodename,
            description: LMS_CANONICAL_METAHUB.description,
            descriptionPrimaryLocale: 'en',
            templateCodename: 'lms'
        })

        if (!metahub?.id) {
            throw new Error('LMS metahub generator did not receive a metahub id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName.en,
            codename: LMS_CANONICAL_METAHUB.codename.en
        })

        await seedCanonicalLmsRecords(api, metahub.id)

        const exportResponse = await apiGet(api, `/api/v1/metahub/${metahub.id}/export`)
        expect(exportResponse.ok).toBe(true)

        const exportedEnvelope = validateSnapshotEnvelope((await exportResponse.json()) as Record<string, unknown>)
        const envelope = buildSnapshotEnvelope({
            metahub: exportedEnvelope.metahub,
            publication: exportedEnvelope.publication,
            sourceInstance: exportedEnvelope.sourceInstance,
            snapshot: {
                ...exportedEnvelope.snapshot,
                runtimePolicy: {
                    workspaceMode: 'required'
                }
            }
        })
        validateSnapshotEnvelope(envelope)
        assertLmsFixtureEnvelopeContract(envelope)

        const fixturePath = path.join(FIXTURES_DIR, LMS_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')

        expect(fs.existsSync(fixturePath)).toBe(true)
    })
})
