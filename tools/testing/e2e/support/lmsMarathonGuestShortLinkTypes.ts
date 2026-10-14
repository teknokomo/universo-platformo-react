import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import type { E2ERunManifest } from '../fixtures/test'
import type { createLoggedInApiContext } from './backend/api-session.mjs'

export type LmsMarathonApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
export type LmsMarathonQuiz = typeof import('./lmsMarathonFixtureContract').LMS_LYCEUM_MARATHON_QUIZZES[number]
export type LmsMarathonAccessLink = typeof import('./lmsMarathonFixtureContract').LMS_LYCEUM_MARATHON_ACCESS_LINKS[number]
export type LmsMarathonAuthoredQuizLink = {
    title: string
    quizId: string
    accessLinkSlug: string
    accessLinkId: string
    correctAnswers: Array<{ prompt: string; label: string }>
    completionText: string
}

export type LmsMarathonFlowResources = {
    api?: LmsMarathonApiContext
    guestContext?: BrowserContext
    russianContext?: BrowserContext
    timeoutContext?: BrowserContext
    gradeTenContext?: BrowserContext
    createdGlobalShortLinkIds?: string[]
    cleanupErrors: unknown[]
}

export type LmsMarathonBaseContext = {
    browser: Browser
    page: Page
    testInfo: TestInfo
    runManifest: E2ERunManifest
    resources: LmsMarathonFlowResources
}

export type LmsMarathonApplicationContext = LmsMarathonBaseContext & {
    api: LmsMarathonApiContext
    applicationId: string
    publicWorkspaceId: string
    accessLink: LmsMarathonAccessLink
    gradeQuiz: LmsMarathonQuiz
    gradeTenAccessLink: LmsMarathonAccessLink
    gradeTenQuiz: LmsMarathonQuiz
    gradeQuestionCount: number
}

export type LmsMarathonPreparedFlow = LmsMarathonApplicationContext & {
    shortLinkSlug: string
    gradeTenShortLinkSlug: string
    gradeShortLinks: Array<{ grade: number; slug: string; id: string; accessLinkId: string; accessLinkSlug: string; workspaceId: string }>
    authoredQuizShortLink: LmsMarathonAuthoredQuizLink & { slug: string; id: string }
    origin: string
}
