import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildVLC, validateSnapshotEnvelope } from '@universo/utils'
import { waitForMetahubCatalogId, waitForMetahubEnumerationId, waitForOptionValueId } from '../../support/lmsRuntime'
import {
    assertLmsFixtureEnvelopeContract,
    buildLmsLiveMetahubCodename,
    buildLmsLiveMetahubName,
    LMS_CANONICAL_METAHUB,
    LMS_DEMO_ACCESS_LINKS,
    LMS_DEMO_CLASSES,
    LMS_DEMO_ENROLLMENTS,
    LMS_DEMO_MODULE_PROGRESS,
    LMS_DEMO_MODULES,
    LMS_DEMO_QUIZ_RESPONSES,
    LMS_DEMO_QUIZZES,
    LMS_DEMO_STUDENTS,
    LMS_FIXTURE_FILENAME,
    LMS_MODULE_SCRIPT_CODENAME,
    LMS_MODULE_WIDGET_SOURCE,
    LMS_STATS_SCRIPT_CODENAME,
    LMS_STATS_WIDGET_SOURCE
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

async function expectJsonResponse(response: Response, label: string) {
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
        throw new Error(`${label} failed with ${response.status} ${response.statusText}: ${text}`)
    }

    return payload
}

async function createCanonicalLmsScripts(api: ApiContext, metahubId: string) {
    await expectJsonResponse(
        await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/scripts`, {
            codename: LMS_MODULE_SCRIPT_CODENAME,
            name: 'LMS module viewer',
            description: 'Canonical LMS module widget script for snapshot export',
            attachedToKind: 'metahub',
            attachedToId: null,
            moduleRole: 'widget',
            sourceKind: 'embedded',
            capabilities: ['rpc.client'],
            sourceCode: LMS_MODULE_WIDGET_SOURCE,
            isActive: true
        }),
        'Creating LMS module viewer script'
    )

    await expectJsonResponse(
        await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/scripts`, {
            codename: LMS_STATS_SCRIPT_CODENAME,
            name: 'LMS stats viewer',
            description: 'Canonical LMS stats widget script for snapshot export',
            attachedToKind: 'metahub',
            attachedToId: null,
            moduleRole: 'widget',
            sourceKind: 'embedded',
            capabilities: ['rpc.client'],
            sourceCode: LMS_STATS_WIDGET_SOURCE,
            isActive: true
        }),
        'Creating LMS stats viewer script'
    )
}

async function seedCanonicalLmsRecords(api: ApiContext, metahubId: string) {
    const [
        classesCatalogId,
        studentsCatalogId,
        modulesCatalogId,
        quizzesCatalogId,
        quizResponsesCatalogId,
        moduleProgressCatalogId,
        accessLinksCatalogId,
        enrollmentsCatalogId,
        contentTypeEnumerationId,
        moduleStatusEnumerationId,
        questionTypeEnumerationId,
        enrollmentStatusEnumerationId
    ] = await Promise.all([
        waitForMetahubCatalogId(api, metahubId, 'Classes'),
        waitForMetahubCatalogId(api, metahubId, 'Students'),
        waitForMetahubCatalogId(api, metahubId, 'Modules'),
        waitForMetahubCatalogId(api, metahubId, 'Quizzes'),
        waitForMetahubCatalogId(api, metahubId, 'Quiz Responses'),
        waitForMetahubCatalogId(api, metahubId, 'Module Progress'),
        waitForMetahubCatalogId(api, metahubId, 'Access Links'),
        waitForMetahubCatalogId(api, metahubId, 'Enrollments'),
        waitForMetahubEnumerationId(api, metahubId, 'Content Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Module Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Question Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Enrollment Status')
    ])

    const [textValueId, quizRefValueId, publishedModuleStatusValueId, singleChoiceValueId, activeEnrollmentStatusValueId] =
        await Promise.all([
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'Text'),
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'QuizRef'),
            waitForOptionValueId(api, metahubId, moduleStatusEnumerationId, 'Published'),
            waitForOptionValueId(api, metahubId, questionTypeEnumerationId, 'SingleChoice'),
            waitForOptionValueId(api, metahubId, enrollmentStatusEnumerationId, 'Active')
        ])

    const classRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededClass of LMS_DEMO_CLASSES) {
        const classRow = await createRecord(api, metahubId, classesCatalogId, {
            data: {
                Name: seededClass.name.en,
                Description: seededClass.description.en,
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

        await createCanonicalLmsScripts(api, metahub.id)
        await seedCanonicalLmsRecords(api, metahub.id)

        const exportResponse = await apiGet(api, `/api/v1/metahub/${metahub.id}/export`)
        expect(exportResponse.ok).toBe(true)

        const envelope = (await exportResponse.json()) as Record<string, unknown>
        validateSnapshotEnvelope(envelope)
        assertLmsFixtureEnvelopeContract(envelope)

        const fixturePath = path.join(FIXTURES_DIR, LMS_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')

        expect(fs.existsSync(fixturePath)).toBe(true)
    })
})