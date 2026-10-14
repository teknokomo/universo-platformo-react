import { LMS_WELCOME_PAGE } from './lmsFixtureDataOverview.ts'
import { readLocalizedText } from './lmsFixtureValidationHelpers.ts'
import type { SnapshotEntity } from './lmsFixtureContractTypes.ts'
import type { LmsSnapshotEnvelopeEntityContext } from './lmsSnapshotEnvelopeEntityContract.ts'

export function assertLmsSnapshotEnvelopePagesContract(entityContext: LmsSnapshotEnvelopeEntityContext, errors: string[]): void {
    const { entities, entityByCodename, findEntityByKindAndName } = entityContext
    const learnerHomeEntity = entityByCodename.get('LearnerHome')
    if (learnerHomeEntity?.kind !== 'page') {
        errors.push('LMS fixture must include LearnerHome as a Page entity')
    } else {
        const learnerHomeCodenameRu = readLocalizedText(learnerHomeEntity.codename, 'ru')
        if (!learnerHomeCodenameRu) {
            errors.push('LMS LearnerHome page must export a Russian codename value')
        }
        const learnerHomeNameEn = readLocalizedText(learnerHomeEntity.presentation?.name, 'en')
        const learnerHomeNameRu = readLocalizedText(learnerHomeEntity.presentation?.name, 'ru')
        if (learnerHomeNameEn !== 'Welcome' || learnerHomeNameRu !== 'Добро пожаловать') {
            errors.push('LMS LearnerHome page must be presented as the visible Welcome page')
        }
        const pageConfig = learnerHomeEntity as SnapshotEntity & { config?: Record<string, unknown> }
        const blockContent = pageConfig.config?.blockContent as Record<string, unknown> | undefined
        const blocks = Array.isArray(blockContent?.blocks) ? blockContent.blocks : []
        if (blockContent?.format !== 'editorjs') {
            errors.push('LMS LearnerHome page must use Editor.js-compatible block content')
        }
        if (blocks.length < 2) {
            errors.push('LMS LearnerHome page must include starter header and paragraph blocks')
        }
        if (blocks.length < 5) {
            errors.push('LMS LearnerHome page must include a complete starter page, not only a short placeholder')
        }
        const blockContentText = JSON.stringify(blockContent)
        if (!blockContentText.includes(LMS_WELCOME_PAGE.intro.en)) {
            errors.push('LMS LearnerHome page must include the full English onboarding text')
        }
        if (!blockContentText.includes(LMS_WELCOME_PAGE.intro.ru)) {
            errors.push('LMS LearnerHome page must include the full Russian onboarding text')
        }
    }
    for (const pageCodename of [
        'CourseOverview',
        'KnowledgeHome',
        'KnowledgeArticle',
        'DevelopmentHome',
        'AssignmentInstructions',
        'CertificatePolicy'
    ]) {
        const pageEntity = entityByCodename.get(pageCodename)
        if (pageEntity?.kind !== 'page') {
            errors.push(`LMS fixture must include ${pageCodename} as a Page entity`)
            continue
        }
        const pageCodenameRu = readLocalizedText(pageEntity.codename, 'ru')
        if (!pageCodenameRu) {
            errors.push(`LMS ${pageCodename} page must export a Russian codename value`)
        }
        const pageConfig = pageEntity as SnapshotEntity & { config?: Record<string, unknown> }
        const blockContent = pageConfig.config?.blockContent as Record<string, unknown> | undefined
        const blocks = Array.isArray(blockContent?.blocks) ? blockContent.blocks : []
        const blockContentText = JSON.stringify(blockContent)
        if (blockContent?.format !== 'editorjs' || blocks.length < 2) {
            errors.push(`LMS ${pageCodename} page must use Editor.js-compatible bilingual content blocks`)
        }
        if (!blockContentText.includes('"_primary":"en"') || !blockContentText.includes('"ru"')) {
            errors.push(`LMS ${pageCodename} page must include English and Russian localized content`)
        }
    }

    const shortPresetPage = entities.find(
        (entity) =>
            entity?.kind === 'page' &&
            JSON.stringify(entity?.config ?? {}).includes('Use this page to publish structured application content.')
    )
    if (shortPresetPage) {
        errors.push('LMS fixture must not expose the short Basic preset Welcome page as product content')
    }

    const lmsConfigurationEntity =
        entityByCodename.get('LmsConfiguration') ??
        entityByCodename.get('LMSConfiguration') ??
        findEntityByKindAndName('set', 'LMS Configuration')
    if (lmsConfigurationEntity?.kind !== 'set') {
        errors.push('LMS fixture must include LmsConfiguration as a Set entity')
    }
    for (const ledgerCodename of [
        'LearningActivityLedger',
        'ProgressLedger',
        'ScoreLedger',
        'EnrollmentLedger',
        'AttendanceLedger',
        'CertificateLedger',
        'PointsLedger',
        'NotificationLedger'
    ]) {
        const ledgerEntity = entityByCodename.get(ledgerCodename)
        if (ledgerEntity?.kind !== 'object') {
            errors.push(`LMS fixture must include ${ledgerCodename} as a register-enabled Object entity`)
        } else if (ledgerEntity.config?.ledger === undefined) {
            errors.push(`LMS ${ledgerCodename} must carry the canonical ledger configuration`)
        }
    }
    for (const transactionalObjectCodename of [
        'QuizResponses',
        'QuizAttempts',
        'ContentProgress',
        'Assignments',
        'AssignmentSubmissions',
        'TrainingEvents',
        'TrainingAttendance',
        'Certificates',
        'CertificateIssues',
        'DevelopmentPlanTasks',
        'NotificationOutbox',
        'PointTransactions',
        'BadgeIssues',
        'Enrollments'
    ]) {
        const objectEntity = entityByCodename.get(transactionalObjectCodename)
        const recordBehavior =
            objectEntity?.config?.recordBehavior &&
            typeof objectEntity.config.recordBehavior === 'object' &&
            !Array.isArray(objectEntity.config.recordBehavior)
                ? (objectEntity.config.recordBehavior as Record<string, unknown>)
                : null
        if (recordBehavior?.mode !== 'transactional') {
            errors.push(`LMS ${transactionalObjectCodename} object must use transactional record behavior`)
        }
    }
}
