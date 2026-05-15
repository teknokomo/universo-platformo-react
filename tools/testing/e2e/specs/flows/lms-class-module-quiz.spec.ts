import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createRuntimeRow, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    setupPublishedLmsApplication,
    waitForApplicationCatalogId,
    waitForApplicationRuntimeRow,
    waitForApplicationRuntimeRowCount,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'

test('@flow lms public guest runtime completes a class module quiz and records progress rows', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const lms = await setupPublishedLmsApplication(api, {
            runId: runManifest.runId,
            label: 'Journey',
            isPublic: true,
            workspacesEnabled: true
        })

        await recordCreatedMetahub({
            id: lms.metahub.id,
            name: `E2E ${runManifest.runId} Journey LMS`,
            codename: `${runManifest.runId}-journey-lms`
        })
        await recordCreatedPublication({
            id: lms.publication.id,
            metahubId: lms.metahub.id,
            schemaName: lms.publication.schemaName
        })
        await recordCreatedApplication({
            id: lms.applicationId,
            slug: lms.applicationSlug
        })

        const classesCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Classes')
        const studentsCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Students')
        const modulesCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Modules')
        const quizzesCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Quizzes')
        const quizResponsesCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Quiz Responses')
        const moduleProgressCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Module Progress')
        const accessLinksCatalogId = await waitForApplicationCatalogId(api, lms.applicationId, 'Access Links')

        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Content Type')
        const moduleStatusEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Module Status')
        const questionTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Question Type')
        const textValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'Text')
        const quizRefValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'QuizRef')
        const publishedModuleStatusValueId = await waitForOptionValueId(api, lms.metahub.id, moduleStatusEnumerationId, 'Published')
        const singleChoiceValueId = await waitForOptionValueId(api, lms.metahub.id, questionTypeEnumerationId, 'SingleChoice')

        const classRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: classesCatalogId,
            data: {
                Name: `Biology Class ${runManifest.runId}`,
                Description: 'Public LMS class for browser verification'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, classesCatalogId, classRow.id)

        const quizRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: quizzesCatalogId,
            data: {
                Title: `Photosynthesis Quiz ${runManifest.runId}`,
                Description: 'Two-question guest quiz',
                PassingScorePercent: 50,
                MaxAttempts: 3,
                Questions: [
                    {
                        Prompt: 'Which organelle is primarily responsible for photosynthesis?',
                        QuestionDescription: 'Choose one answer.',
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: 'Photosynthesis occurs in chloroplasts.',
                        Options: [
                            { id: 'q1-opt-a', label: 'Chloroplast', isCorrect: true },
                            { id: 'q1-opt-b', label: 'Mitochondrion', isCorrect: false }
                        ],
                        SortOrder: 1
                    },
                    {
                        Prompt: 'Plants need sunlight, water, and which gas to complete photosynthesis?',
                        QuestionDescription: 'Choose one answer.',
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: 'Carbon dioxide is consumed during photosynthesis.',
                        Options: [
                            { id: 'q2-opt-a', label: 'Carbon dioxide', isCorrect: true },
                            { id: 'q2-opt-b', label: 'Nitrogen', isCorrect: false }
                        ],
                        SortOrder: 2
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, quizzesCatalogId, quizRow.id)

        const moduleSlug = `journey-module-${runManifest.runId}`
        const moduleRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: modulesCatalogId,
            data: {
                Title: `Photosynthesis Module ${runManifest.runId}`,
                Description: 'Guest LMS lesson with embedded quiz hand-off',
                Status: publishedModuleStatusValueId,
                EstimatedDurationMinutes: 10,
                AccessLinkSlug: moduleSlug,
                ContentItems: [
                    {
                        ItemType: textValueId,
                        ItemTitle: 'Lesson overview',
                        ItemContent: 'Plants use sunlight to convert water and carbon dioxide into glucose and oxygen.',
                        SortOrder: 1
                    },
                    {
                        ItemType: quizRefValueId,
                        ItemTitle: 'Knowledge check',
                        QuizId: quizRow.id,
                        SortOrder: 2
                    }
                ]
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, modulesCatalogId, moduleRow.id)

        const accessLinkRow = await createRuntimeRow(api, lms.applicationId, {
            linkedCollectionId: accessLinksCatalogId,
            data: {
                Slug: moduleSlug,
                TargetType: 'module',
                TargetId: moduleRow.id,
                LinkClassId: classRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: 'Photosynthesis journey'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, accessLinksCatalogId, accessLinkRow.id)

        const guestSessionResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/public/a/${lms.applicationId}/guest-session`)
        )

        await page.goto(`/public/a/${lms.applicationId}/links/${moduleSlug}`)
        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Guest learner journey')
        await page.getByRole('button', { name: 'Start learning' }).click()

        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status()).toBe(201)

        await expect(page.getByText(`Photosynthesis Module ${runManifest.runId}`)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Plants use sunlight to convert water and carbon dioxide into glucose and oxygen.')).toBeVisible()

        const storageKey = `apps-template-mui:guest-session:${lms.applicationId}:${moduleSlug}`
        await expect.poll(async () => page.evaluate((key) => window.sessionStorage.getItem(key), storageKey)).toContain('sessionToken')
        await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(null)

        await page.getByRole('button', { name: 'Next' }).click()
        await expect(page.getByText('Knowledge check')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Open quiz' }).click()

        await expect(page.getByText('Which organelle is primarily responsible for photosynthesis?')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Chloroplast').check()
        await page.getByLabel('Carbon dioxide').check()
        await page.getByRole('button', { name: 'Submit quiz' }).click()
        await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: 'Back to module' }).click()
        await page.getByRole('button', { name: 'Complete module' }).click()
        await expect(page.getByText('Module complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })

        const studentRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, studentsCatalogId, 1)
        expect(studentRows).toHaveLength(1)

        const quizResponseRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, quizResponsesCatalogId, 2)
        expect(quizResponseRows).toHaveLength(2)

        const moduleProgressRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, moduleProgressCatalogId, 1)
        expect(moduleProgressRows).toHaveLength(1)
    } finally {
        await disposeApiContext(api)
    }
})
