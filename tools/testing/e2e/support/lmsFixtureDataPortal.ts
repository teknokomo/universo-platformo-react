import { resourceDefinitionSchema } from '@universo-react/types'
import { buildVLC } from '@universo-react/utils'
import { LMS_SAMPLE_LINK, LMS_SECONDARY_LINK } from './lmsFixtureDataOverview.ts'

export const LMS_DEMO_RESOURCES = [
    resourceDefinitionSchema.parse({
        codename: 'CourseOverviewPageResource',
        title: buildVLC('Course overview page', 'Страница обзора курса'),
        source: { type: 'page', pageCodename: 'CourseOverview' },
        estimatedTimeMinutes: 5,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'SafetyVideoResource',
        title: buildVLC('Safety intro video', 'Вводное видео по безопасности'),
        source: { type: 'video', url: 'https://example.test/lms/safety-intro.mp4', mimeType: 'video/mp4' },
        estimatedTimeMinutes: 8,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'LearningPortalLinkResource',
        title: buildVLC('Learning portal web link', 'Веб-ссылка учебного портала'),
        source: { type: 'url', url: 'https://example.test/lms/portal-guide', launchMode: 'newTab' },
        estimatedTimeMinutes: 3,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'SafetyAudioBriefingResource',
        title: buildVLC('Safety audio briefing', 'Аудиобрифинг по безопасности'),
        source: { type: 'audio', url: 'https://example.test/lms/safety-briefing.mp3', mimeType: 'audio/mpeg' },
        estimatedTimeMinutes: 4,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'CertificatePolicyDocumentResource',
        title: buildVLC('Certificate policy PDF', 'PDF политики сертификатов'),
        source: { type: 'document', url: 'https://example.test/lms/certificate-policy.pdf', mimeType: 'application/pdf' },
        estimatedTimeMinutes: 6,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'EmbeddedOrientationResource',
        title: buildVLC('Embedded orientation video', 'Встроенное вводное видео'),
        source: { type: 'embed', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
        estimatedTimeMinutes: 5,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'ScormPlaceholderResource',
        title: buildVLC('SCORM package placeholder', 'Заполнитель SCORM-пакета'),
        source: {
            type: 'scorm',
            packageDescriptor: {
                standard: 'SCORM 2004',
                status: 'deferred',
                manifest: 'imsmanifest.xml'
            }
        },
        estimatedTimeMinutes: 15,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'XapiPlaceholderResource',
        title: buildVLC('xAPI package placeholder', 'Заполнитель пакета xAPI'),
        source: {
            type: 'xapi',
            packageDescriptor: {
                standard: 'xAPI',
                status: 'deferred',
                launch: 'index.html'
            }
        },
        estimatedTimeMinutes: 12,
        language: 'en'
    }),
    resourceDefinitionSchema.parse({
        codename: 'CertificatePolicyResource',
        title: buildVLC('Certificate policy page', 'Страница политики сертификатов'),
        source: { type: 'page', pageCodename: 'CertificatePolicy' },
        estimatedTimeMinutes: 4,
        language: 'en'
    })
] as const

export const LMS_DEMO_COURSES = [
    {
        key: 'onboarding-course',
        title: { en: 'Learner Onboarding Course', ru: 'Курс адаптации учащегося' },
        description: { en: 'A short course for the first learner journey.', ru: 'Короткий курс для первого учебного маршрута.' },
        instructor: { en: 'Training Team', ru: 'Команда обучения' },
        estimatedTimeMinutes: 22,
        catalogCategory: { en: 'Onboarding', ru: 'Адаптация' },
        catalogAudience: { en: 'New learners', ru: 'Новые учащиеся' },
        selfEnrollmentMode: 'open'
    },
    {
        key: 'compliance-course',
        title: { en: 'Compliance Refresh Course', ru: 'Курс обновления требований' },
        description: { en: 'Required refresher materials and checks.', ru: 'Обязательные материалы и проверки.' },
        instructor: { en: 'Training Team', ru: 'Команда обучения' },
        estimatedTimeMinutes: 18,
        catalogCategory: { en: 'Compliance', ru: 'Соответствие' },
        catalogAudience: { en: 'All learners', ru: 'Все учащиеся' },
        selfEnrollmentMode: 'disabled'
    }
] as const

export const LMS_DEMO_KNOWLEDGE_SPACE = {
    key: 'operations-knowledge',
    title: { en: 'Operations Knowledge', ru: 'Операционные знания' },
    description: { en: 'Shared articles for daily learning support.', ru: 'Общие статьи для ежедневной поддержки обучения.' }
} as const

export const LMS_DEMO_KNOWLEDGE_ARTICLE = {
    key: 'getting-started',
    title: { en: 'Getting started with learning', ru: 'Как начать обучение' },
    body: {
        en: 'Open your assigned content, review the brief, and complete the readiness check.',
        ru: 'Откройте назначенный контент, изучите брифинг и завершите проверку готовности.'
    }
} as const

export const LMS_DEMO_DEVELOPMENT_PLAN = {
    key: 'ava-onboarding-plan',
    title: { en: 'Ava onboarding plan', ru: 'План адаптации Авы' },
    stageTitle: { en: 'First week', ru: 'Первая неделя' },
    taskTitle: { en: 'Complete the learner onboarding course', ru: 'Завершить курс адаптации учащегося' }
} as const

export const LMS_DEMO_GAMIFICATION_SETTINGS = [
    {
        key: 'application-default',
        scope: 'application',
        workspaceKey: null,
        enabled: true,
        leaderboardPeriodDays: 30,
        rules: {
            leaderboard: { period: 'rolling_30_days', tieBreaker: 'completed_at' },
            achievementsPage: { showCertificates: true, showBadges: true, showRank: true }
        }
    }
] as const

export const LMS_DEMO_POINT_AWARD_RULES = [
    {
        key: 'content-completed',
        ruleCode: 'content.completed',
        name: { en: 'Content completed', ru: 'Контент завершён' },
        sourceType: 'Course',
        points: 25,
        isActive: true,
        conditions: { completionStatus: 'Completed' }
    },
    {
        key: 'assignment-accepted',
        ruleCode: 'assignment.accepted',
        name: { en: 'Assignment accepted', ru: 'Задание принято' },
        sourceType: 'Assignment',
        points: 15,
        isActive: true,
        conditions: { status: 'Accepted' }
    },
    {
        key: 'manual-adjustment',
        ruleCode: 'manual.adjustment',
        name: { en: 'Manual adjustment', ru: 'Ручная корректировка' },
        sourceType: 'Manual',
        points: 10,
        isActive: true,
        conditions: { requiresApproval: true }
    }
] as const

export const LMS_DEMO_POINT_TRANSACTIONS = [
    {
        key: 'ava-content-completion',
        studentKey: 'ava-solaris',
        sourceType: 'Course',
        sourceObjectKey: 'learning-path',
        pointsDelta: 25,
        reason: { en: 'Completed Learning Path 101', ru: 'Завершён Учебный маршрут 101' },
        awardedAt: '2061-02-01T10:05:00.000Z',
        status: 'Approved'
    },
    {
        key: 'ava-manual-bonus',
        studentKey: 'ava-solaris',
        sourceType: 'Manual',
        sourceObjectKey: 'manual-adjustment',
        pointsDelta: 10,
        reason: { en: 'Instructor bonus for early completion', ru: 'Бонус преподавателя за раннее завершение' },
        awardedAt: '2061-02-01T10:10:00.000Z',
        status: 'Pending'
    },
    {
        key: 'maksim-assignment-credit',
        studentKey: 'maksim-vega',
        sourceType: 'Assignment',
        sourceObjectKey: 'assignment-accepted',
        pointsDelta: 15,
        reason: { en: 'Accepted assignment submission', ru: 'Принятая сдача задания' },
        awardedAt: '2061-02-01T11:00:00.000Z',
        status: 'Approved'
    }
] as const

export const LMS_DEMO_BADGES = [
    {
        key: 'first-content',
        badgeCode: 'first.content',
        name: { en: 'First content completed', ru: 'Первый контент завершён' },
        description: { en: 'Awarded after the first completed content.', ru: 'Выдаётся после первого завершённого контента.' },
        requiredPoints: 25,
        icon: 'WorkspacePremium',
        isActive: true
    },
    {
        key: 'fast-starter',
        badgeCode: 'fast.starter',
        name: { en: 'Fast starter', ru: 'Быстрый старт' },
        description: {
            en: 'Awarded for early completion or instructor bonus.',
            ru: 'Выдаётся за раннее завершение или бонус преподавателя.'
        },
        requiredPoints: 35,
        icon: 'Bolt',
        isActive: true
    }
] as const

export const LMS_DEMO_BADGE_ISSUES = [
    {
        key: 'ava-first-content',
        studentKey: 'ava-solaris',
        badgeKey: 'first-content',
        issuedAt: '2061-02-01T10:15:00.000Z',
        revokedAt: null,
        status: 'Issued',
        reason: { en: 'Completed the first content item.', ru: 'Завершён первый элемент контента.' }
    },
    {
        key: 'ava-fast-starter',
        studentKey: 'ava-solaris',
        badgeKey: 'fast-starter',
        issuedAt: '2061-02-01T10:20:00.000Z',
        revokedAt: null,
        status: 'Eligible',
        reason: { en: 'Pending manual bonus approval.', ru: 'Ожидается подтверждение ручного бонуса.' }
    }
] as const

export const LMS_DEMO_LEADERBOARD = [
    {
        key: 'ava-current',
        studentKey: 'ava-solaris',
        period: 'current',
        totalPoints: 35,
        rank: 1,
        badgeCount: 1,
        calculatedAt: '2061-02-01T12:00:00.000Z'
    },
    {
        key: 'maksim-current',
        studentKey: 'maksim-vega',
        period: 'current',
        totalPoints: 15,
        rank: 2,
        badgeCount: 0,
        calculatedAt: '2061-02-01T12:00:00.000Z'
    }
] as const

/** Report identities covered by the fixture contract; definitions live in the LMS template seed. */
export const LMS_DEMO_REPORTS = [
    { codename: 'LearningContentSummary' },
    { codename: 'LearnerProgress' },
    { codename: 'CourseProgress' },
    { codename: 'CourseBuilderOutline' },
    { codename: 'TrackBuilderOutline' },
    { codename: 'Leaderboard' },
    { codename: 'Achievements' }
] as const

export const LMS_FIXTURE_REPORTS = [...LMS_DEMO_REPORTS, { codename: 'QuizAttemptResults' }] as const

export const LMS_DEMO_ACCESS_LINKS = [
    {
        key: 'demo-content',
        slug: LMS_SAMPLE_LINK.slug,
        title: LMS_SAMPLE_LINK.title,
        contentKey: 'learning-path',
        classKey: 'learning-path'
    },
    {
        key: 'docking-drill',
        slug: LMS_SECONDARY_LINK.slug,
        title: LMS_SECONDARY_LINK.title,
        contentKey: 'docking-corridor',
        classKey: 'learning-path'
    }
] as const

export const LMS_DEMO_ENROLLMENTS = [
    {
        key: 'ava-learning-path',
        studentKey: 'ava-solaris',
        classKey: 'learning-path',
        contentKey: 'learning-path'
    },
    {
        key: 'ava-docking-corridor',
        studentKey: 'ava-solaris',
        classKey: 'learning-path',
        contentKey: 'docking-corridor'
    },
    {
        key: 'maksim-lunar-logistics',
        studentKey: 'maksim-vega',
        classKey: 'lunar-logistics',
        contentKey: 'lunar-logistics'
    }
] as const

export const LMS_RUNTIME_CURRENT_USER_ID_TOKEN = '{{runtime.currentUserId}}'

export const LMS_DEMO_CONTENT_PROGRESS = [
    {
        key: 'ava-learning-path-progress',
        studentKey: 'ava-solaris',
        contentKey: 'learning-path',
        status: 'completed',
        progressPercent: 100
    },
    {
        key: 'ava-docking-corridor-progress',
        studentKey: 'ava-solaris',
        contentKey: 'docking-corridor',
        status: 'in_progress',
        progressPercent: 50
    },
    {
        key: 'maksim-lunar-logistics-progress',
        studentKey: 'maksim-vega',
        contentKey: 'lunar-logistics',
        status: 'completed',
        progressPercent: 100
    }
] as const
