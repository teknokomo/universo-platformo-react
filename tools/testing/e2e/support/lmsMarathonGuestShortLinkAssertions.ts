import AxeBuilder from '@axe-core/playwright'
import { errors as playwrightErrors } from '@playwright/test'
import { expect } from '../fixtures/test'
import type { Locator, Page, Request, Response } from '@playwright/test'
import { assertPublicGuestAnswerResponse } from './lmsMarathonPublicDtoContract.ts'
export {
    assertNoPrivateAnswerMaterial,
    assertPublicAssessmentAttemptState,
    assertPublicGuestAnswerResponse
} from './lmsMarathonPublicDtoContract.ts'

export type RuntimeRecord = Record<string, unknown>

function asRecord(value: unknown): RuntimeRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null
}

export function getRuntimeField(record: RuntimeRecord, field: string): unknown {
    const candidates = [
        field,
        `${field.charAt(0).toLowerCase()}${field.slice(1)}`,
        field.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`).replace(/^_/u, '')
    ]
    const containers = [record, asRecord(record.data)].filter((container): container is RuntimeRecord => container !== null)

    for (const container of containers) {
        for (const candidate of candidates) {
            if (Object.prototype.hasOwnProperty.call(container, candidate)) return container[candidate]
        }
    }

    return undefined
}

export function getRuntimeReferenceId(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) return value
    const reference = asRecord(value)
    if (!reference) return undefined
    const id = getRuntimeField(reference, 'Id')
    return typeof id === 'string' && id.length > 0 ? id : undefined
}

export function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string' && value.length > 0) return value
    const localized = asRecord(value)
    if (!localized) return undefined

    const readContent = (entry: unknown): string | undefined => {
        if (typeof entry === 'string' && entry.length > 0) return entry
        const content = asRecord(entry)?.content
        return typeof content === 'string' && content.length > 0 ? content : undefined
    }
    const locales = asRecord(localized.locales) ?? {}
    const normalizedLocale = locale.split(/[-_]/u)[0]?.toLowerCase() || 'en'
    const direct = readContent(locales[normalizedLocale]) ?? readContent(localized[normalizedLocale])
    if (direct) return direct

    const primaryLocale = typeof localized._primary === 'string' ? localized._primary : undefined
    const primary = primaryLocale ? readContent(locales[primaryLocale]) ?? readContent(localized[primaryLocale]) : undefined
    if (primary) return primary

    for (const entry of Object.values(locales)) {
        const fallback = readContent(entry)
        if (fallback) return fallback
    }
    return undefined
}

export function runtimeRecords(value: unknown): RuntimeRecord[] {
    return Array.isArray(value) ? value.map(asRecord).filter((record): record is RuntimeRecord => record !== null) : []
}

export async function acceptGuestLegalConsents(page: Page, locale: 'en' | 'ru'): Promise<void> {
    const consentLabels =
        locale === 'ru' ? [/Пользовательское соглашение/u, /Политику конфиденциальности/u] : [/Terms of Service/u, /Privacy Policy/u]
    const checkboxes = page.getByRole('checkbox')
    await expect(checkboxes, 'Guest intake must show exactly two required legal consents').toHaveCount(2)

    for (const label of consentLabels) {
        const checkbox = page.getByRole('checkbox', { name: label })
        await expect(checkbox, `Guest consent labelled ${label.source} must be unique`).toHaveCount(1)
        await checkbox.check()
    }
}

type CanonicalQuizQuestion = {
    prompt: unknown
    options: Array<{ id: string; label?: unknown; text?: unknown }>
}

/** Assert that a public attempt exposes only the expected fixture question and options. */
export function expectCurrentAttemptQuestion(
    attempt: RuntimeRecord,
    expectedQuestion: CanonicalQuizQuestion,
    index: number,
    totalQuestions: number,
    locale: string,
    label: string
): RuntimeRecord {
    expect(attempt.status, `${label} must still be in progress`).toBe('in_progress')
    expect(attempt.currentQuestionIndex, `${label} current question index`).toBe(index)
    expect(attempt.totalQuestions, `${label} total question count`).toBe(totalQuestions)
    expect(attempt.answeredCount, `${label} saved answer count`).toBe(index)

    const currentQuestions = runtimeRecords(attempt.questions)
    expect(currentQuestions, `${label} must expose exactly the current unanswered question`).toHaveLength(1)
    const currentQuestion = currentQuestions[0]
    if (!currentQuestion) throw new Error(`${label} is missing its current unanswered question`)

    const expectedPrompt = readLocalizedText(expectedQuestion.prompt, locale)
    const currentPrompt = readLocalizedText(getRuntimeField(currentQuestion, 'Prompt'), locale)
    expect(currentPrompt, `${label} prompt must match the canonical fixture`).toBe(expectedPrompt)

    const runtimeOptions = runtimeRecords(getRuntimeField(currentQuestion, 'Options'))
    expect(runtimeOptions, `${label} must expose all fixture options for this question`).toHaveLength(expectedQuestion.options.length)
    const actualIds = runtimeOptions.map((option) => getRuntimeField(option, 'Id'))
    expect(
        actualIds.every((id): id is string => typeof id === 'string'),
        `${label} option IDs must be present`
    ).toBe(true)
    expect((actualIds as string[]).sort(), `${label} option IDs must match the canonical fixture`).toEqual(
        expectedQuestion.options.map(({ id }) => id).sort()
    )

    for (const expectedOption of expectedQuestion.options) {
        const runtimeOption = runtimeOptions.find((option) => getRuntimeField(option, 'Id') === expectedOption.id)
        if (!runtimeOption) throw new Error(`${label} omitted canonical option ${expectedOption.id}`)
        const expectedOptionLabel = readLocalizedText(expectedOption.label, locale) ?? readLocalizedText(expectedOption.text, locale)
        const actualOptionLabel = readLocalizedText(
            getRuntimeField(runtimeOption, 'Label') ?? getRuntimeField(runtimeOption, 'Text'),
            locale
        )
        expect(actualOptionLabel, `${label} option ${expectedOption.id} label must match the canonical fixture`).toBe(expectedOptionLabel)
    }

    return currentQuestion
}

const GUEST_QUIZ_ANSWER_OBSERVATION_WINDOW_MS = 750

/** Observe a bounded interval and fail if a guest answer is written before or after explicit confirmation. */
export async function expectNoGuestQuizAnswerRequest(options: {
    page: Page
    applicationId: string
    label: string
    observationWindowMs?: number
}): Promise<void> {
    const answerPathPrefix = `/api/v1/public/a/${options.applicationId}/runtime/attempts/`
    let unexpectedRequest: Request | undefined

    try {
        unexpectedRequest = await options.page.waitForRequest(
            (request) =>
                request.method() === 'PUT' &&
                new URL(request.url()).pathname.startsWith(answerPathPrefix) &&
                new URL(request.url()).pathname.endsWith('/answers'),
            { timeout: options.observationWindowMs ?? GUEST_QUIZ_ANSWER_OBSERVATION_WINDOW_MS }
        )
    } catch (error) {
        if (!(error instanceof playwrightErrors.TimeoutError)) throw error
    }

    expect(unexpectedRequest, `${options.label} must not submit an answer during the observation window`).toBeUndefined()
}

/** Select a guest quiz answer and wait until the server durably accepts it. */
export async function selectGuestQuizAnswer(options: {
    page: Page
    applicationId: string
    attemptId: string
    option: Locator
    label: string
    activate?: () => Promise<void>
    confirm?: (submitButton: Locator) => Promise<void>
}): Promise<RuntimeRecord> {
    const answerUrl = `/api/v1/public/a/${options.applicationId}/runtime/attempts/${options.attemptId}/answers`
    let answerRequestCount = 0
    const observeAnswerRequest = (request: Request) => {
        if (request.method() !== 'PUT') return
        if (new URL(request.url()).pathname === answerUrl) answerRequestCount += 1
    }
    options.page.on('request', observeAnswerRequest)

    try {
        let responsePromise: Promise<Response>

        if (options.activate) {
            await options.activate()
            await expect(options.option, `${options.label} must show the selected choice before confirmation`).toBeChecked()
            expect(answerRequestCount, `${options.label} keyboard selection must not write before confirmation`).toBe(0)
            await expectNoGuestQuizAnswerRequest({ page: options.page, applicationId: options.applicationId, label: options.label })
            expect(answerRequestCount, `${options.label} must still have no write before confirmation`).toBe(0)

            const submitButton = options.page.getByRole('button', { name: /^(Submit answer|Отправить ответ)$/u })
            await expect(submitButton, `${options.label} submit action must be available`).toBeEnabled()
            responsePromise = options.page.waitForResponse((response) => {
                return response.request().method() === 'PUT' && new URL(response.url()).pathname === answerUrl
            })
            if (options.confirm) await options.confirm(submitButton)
            else await submitButton.click()
        } else {
            responsePromise = options.page.waitForResponse((response) => {
                return response.request().method() === 'PUT' && new URL(response.url()).pathname === answerUrl
            })
            await options.option.check()
            await expect(options.option, `${options.label} must show the selected choice`).toBeChecked()
        }

        const response = await responsePromise
        expect(response.status(), `${options.label} must be durably saved`).toBe(200)
        await expect.poll(() => answerRequestCount, { message: `${options.label} must issue exactly one answer write` }).toBe(1)
        if (options.activate) {
            await expectNoGuestQuizAnswerRequest({
                page: options.page,
                applicationId: options.applicationId,
                label: `${options.label} after explicit confirmation`
            })
            expect(answerRequestCount, `${options.label} must issue exactly one write after confirmation`).toBe(1)
        }
        const payload = await response.json()
        assertPublicGuestAnswerResponse(payload, `${options.label} response`)
        return payload.attempt as RuntimeRecord
    } finally {
        options.page.off('request', observeAnswerRequest)
    }
}

export async function expectNoAccessibilityViolations(page: Page, surface: string): Promise<void> {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(
        result.violations.map(({ id, impact, help, nodes }) => ({
            id,
            impact,
            help,
            nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))
        })),
        `${surface} must meet the WCAG 2.1 A/AA automated checks`
    ).toEqual([])
}

export async function collectCleanupFailure(errors: unknown[], cleanup: () => Promise<void>): Promise<void> {
    try {
        await cleanup()
    } catch (error) {
        errors.push(error)
    }
}
