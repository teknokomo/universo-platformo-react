import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createRuntimeRow, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    setupPublishedLmsApplication,
    waitForApplicationObjectId,
    waitForApplicationRuntimeRow,
    waitForApplicationRuntimeRowCount,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'

test('@flow lms public guest runtime completes a class learning resource quiz and records progress rows', async ({ page, runManifest }) => {
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

        const classesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Classes')
        const studentsObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Students')
        const learningResourcesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Learning Resources')
        const quizzesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Quizzes')
        const quizResponsesObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Quiz Responses')
        const contentProgressObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Content Progress')
        const accessLinksObjectId = await waitForApplicationObjectId(api, lms.applicationId, 'Access Links')

        const contentTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Content Type')
        const resourceTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Resource Type')
        const publicationStatusEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Publication Status')
        const questionTypeEnumerationId = await waitForMetahubEnumerationId(api, lms.metahub.id, 'Question Type')
        const textValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'Text')
        const quizRefValueId = await waitForOptionValueId(api, lms.metahub.id, contentTypeEnumerationId, 'QuizRef')
        const pageResourceTypeValueId = await waitForOptionValueId(api, lms.metahub.id, resourceTypeEnumerationId, 'Page')
        const publishedPublicationStatusValueId = await waitForOptionValueId(
            api,
            lms.metahub.id,
            publicationStatusEnumerationId,
            'Published'
        )
        const singleChoiceValueId = await waitForOptionValueId(api, lms.metahub.id, questionTypeEnumerationId, 'SingleChoice')

        const classRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: classesObjectId,
            data: {
                Name: `Biology Class ${runManifest.runId}`,
                Description: 'Public LMS class for browser verification'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, classesObjectId, classRow.id)

        const quizRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: quizzesObjectId,
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
        await waitForApplicationRuntimeRow(api, lms.applicationId, quizzesObjectId, quizRow.id)

        const contentSlug = `journey-content-${runManifest.runId}`
        const contentRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: learningResourcesObjectId,
            data: {
                Title: `Photosynthesis Learning Resource ${runManifest.runId}`,
                Description: 'Guest LMS lesson with embedded quiz hand-off',
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'LearnerHome' },
                PublicationStatus: publishedPublicationStatusValueId,
                EstimatedTimeMinutes: 10,
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
        await waitForApplicationRuntimeRow(api, lms.applicationId, learningResourcesObjectId, contentRow.id)

        const accessLinkRow = await createRuntimeRow(api, lms.applicationId, {
            objectCollectionId: accessLinksObjectId,
            data: {
                Slug: contentSlug,
                TargetType: 'content',
                TargetId: contentRow.id,
                ContentNodeIdRef: contentRow.id,
                LinkClassId: classRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: 'Photosynthesis journey'
            }
        })
        await waitForApplicationRuntimeRow(api, lms.applicationId, accessLinksObjectId, accessLinkRow.id)

        const guestSessionResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/public/a/${lms.applicationId}/guest-session`)
        )

        await page.goto(`/public/a/${lms.applicationId}/links/${contentSlug}`)
        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Guest learner journey')
        await page.getByRole('button', { name: 'Start learning' }).click()

        const guestSessionResponse = await guestSessionResponsePromise
        expect(guestSessionResponse.status()).toBe(201)

        await expect(page.getByText(`Photosynthesis Learning Resource ${runManifest.runId}`)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Plants use sunlight to convert water and carbon dioxide into glucose and oxygen.')).toBeVisible()

        const storageKey = `apps-template-mui:guest-session:${lms.applicationId}:${contentSlug}`
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

        await page.getByRole('button', { name: 'Back to content' }).click()
        await page.getByRole('button', { name: 'Complete content' }).click()
        await expect(page.getByText('Content complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })

        const studentRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, studentsObjectId, 1)
        expect(studentRows).toHaveLength(1)

        const quizResponseRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, quizResponsesObjectId, 2)
        expect(quizResponseRows).toHaveLength(2)

        const contentProgressRows = await waitForApplicationRuntimeRowCount(api, lms.applicationId, contentProgressObjectId, 1)
        expect(contentProgressRows).toHaveLength(1)
    } finally {
        await disposeApiContext(api)
    }
})
