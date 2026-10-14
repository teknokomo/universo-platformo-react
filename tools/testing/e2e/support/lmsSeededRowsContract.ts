import {
    catalogPublicationPolicySchema,
    isDeferredResourceSource,
    reportDefinitionSchema,
    resourceDefinitionSchema
} from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import {
    LMS_DEMO_ACCESS_LINKS,
    LMS_DEMO_BADGES,
    LMS_DEMO_BADGE_ISSUES,
    LMS_DEMO_CONTENT_PROGRESS,
    LMS_DEMO_COURSES,
    LMS_DEMO_ENROLLMENTS,
    LMS_DEMO_GAMIFICATION_SETTINGS,
    LMS_DEMO_LEADERBOARD,
    LMS_DEMO_POINT_AWARD_RULES,
    LMS_DEMO_POINT_TRANSACTIONS,
    LMS_DEMO_RESOURCES,
    LMS_FIXTURE_REPORTS,
    LMS_RUNTIME_CURRENT_USER_ID_TOKEN
} from './lmsFixtureDataPortal.ts'
import { LMS_DEMO_CONTENT_NODES, LMS_DEMO_STUDENTS, LMS_FIXTURE_CLASSES } from './lmsFixtureDataLearning.ts'
import { LMS_PRODUCT_ACCEPTANCE_MATRIX } from './lmsFixtureDataAcceptance.ts'
import {
    assertLmsMarathonSeedRowsContract,
    LMS_LYCEUM_MARATHON_ACCESS_LINKS,
    LMS_LYCEUM_MARATHON_QUIZ_COUNT,
    LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS
} from './lmsMarathonFixtureContract.ts'
import {
    assertEditorBlockTextLocalized,
    assertLocalizedFixtureValue,
    findRowByField,
    getSeededRows,
    readLocalizedText,
    readRecord
} from './lmsFixtureValidationHelpers.ts'
import type { SnapshotElement, SnapshotEntity, SnapshotEnvelope } from './lmsFixtureContractTypes.ts'

const assertLmsReportSeedRows = (
    errors: string[],
    reportRows: SnapshotElement[],
    expectedReports: ReadonlyArray<{ codename: string }>,
    progressReportTypeId: unknown
): Map<string, SnapshotElement> => {
    const reportRowsByCodename = new Map<string, SnapshotElement>()

    for (const expectedReport of expectedReports) {
        const reportMatches = reportRows.filter((row) => readRecord(row?.data?.__templateSeed)?.codename === expectedReport.codename)
        if (reportMatches.length !== 1) {
            errors.push(
                `LMS fixture must contain exactly one template-seeded Reports row for ${expectedReport.codename}; found ${reportMatches.length}`
            )
            continue
        }

        const reportRow = reportMatches[0]
        reportRowsByCodename.set(expectedReport.codename, reportRow)

        if (!isUuidV7(reportRow.id)) {
            errors.push(`LMS report ${expectedReport.codename} must keep its UUID v7 identity`)
        }
        if (typeof progressReportTypeId !== 'string' || reportRow.data?.ReportType !== progressReportTypeId) {
            errors.push(`LMS report ${expectedReport.codename} must resolve ReportType to the seeded Progress option`)
        }

        const reportDefinition = reportDefinitionSchema.safeParse(reportRow.data?.Definition)
        if (!reportDefinition.success) {
            errors.push(`LMS report ${expectedReport.codename} must store a valid generic report definition`)
            continue
        }
        if (reportDefinition.data.codename !== expectedReport.codename) {
            errors.push(`LMS report ${expectedReport.codename} must keep its canonical report codename`)
        }

        const title = {
            en: readLocalizedText(reportDefinition.data.title, 'en') ?? '',
            ru: readLocalizedText(reportDefinition.data.title, 'ru') ?? ''
        }
        assertLocalizedFixtureValue(errors, reportRow.data?.Name, title, `LMS report ${expectedReport.codename} name`)

        if (expectedReport.codename === 'LearningContentSummary') {
            if (reportDefinition.data.datasource.kind !== 'records.union') {
                errors.push('LMS LearningContentSummary report must use the generic records.union datasource')
            } else {
                const targetDisplayTypes = new Set(
                    reportDefinition.data.datasource.targets
                        .map((target) => target.displayType)
                        .filter((value): value is string => typeof value === 'string')
                )
                for (const displayType of ['resource', 'course', 'track']) {
                    if (!targetDisplayTypes.has(displayType)) {
                        errors.push(`LMS LearningContentSummary report must include the ${displayType} union target`)
                    }
                }
                if (!reportDefinition.data.datasource.projectedFields?.includes('Instructor')) {
                    errors.push('LMS LearningContentSummary report must project the generic Instructor component')
                }
                const columnFields = new Set(reportDefinition.data.columns.map((column) => column.field))
                for (const field of ['type', 'title', 'status', 'Instructor', 'project']) {
                    if (!columnFields.has(field)) {
                        errors.push(`LMS LearningContentSummary report must expose the safe ${field} column`)
                    }
                }
            }
        } else if (expectedReport.codename === 'LearnerProgress') {
            const datasource = reportDefinition.data.datasource
            if (datasource.kind !== 'records.list' || datasource.sectionCodename !== 'ContentProgress') {
                errors.push('LMS LearnerProgress report must list entity-backed ContentProgress records')
            }

            const requiredAggregation = reportDefinition.data.aggregations.some(
                (aggregation) =>
                    aggregation.field === 'ProgressPercent' && aggregation.function === 'avg' && aggregation.alias === 'AverageProgress'
            )
            if (!requiredAggregation) {
                errors.push('LMS LearnerProgress report must aggregate ProgressPercent as AverageProgress')
            }

            const requiredColumns = [
                { field: 'ProgressStudentId', type: 'text' },
                { field: 'ProgressPercent', type: 'number' },
                { field: 'ProgressStatus', type: 'status' }
            ] as const
            for (const requiredColumn of requiredColumns) {
                const column = reportDefinition.data.columns.find(({ field }) => field === requiredColumn.field)
                if (!column || column.type !== requiredColumn.type) {
                    errors.push(`LMS LearnerProgress report must include the ${requiredColumn.type} ${requiredColumn.field} column`)
                }
            }
        } else if (reportDefinition.data.datasource.kind !== 'records.list') {
            errors.push(`LMS report ${expectedReport.codename} must use an existing generic records.list datasource`)
        }
    }

    return reportRowsByCodename
}

export function assertLmsSeededRowsContract(options: {
    envelope: SnapshotEnvelope
    entityByCodename: Map<string, SnapshotEntity>
    errors: string[]
}): void {
    const { envelope, entityByCodename, errors } = options
    const elementsByEntityId = envelope.snapshot?.elements ?? {}
    const classRows = getSeededRows(elementsByEntityId, entityByCodename.get('Classes')?.id)
    const studentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Students')?.id)
    const guestStudentRows = studentRows.filter((row) => row.data?.IsGuest === true)
    const contentProjectRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentProjects')?.id)
    const contentAccessRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentAccessEntries')?.id)
    const contentStarRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentStars')?.id)
    const recentContentRows = getSeededRows(elementsByEntityId, entityByCodename.get('RecentContentViews')?.id)
    const resourceRows = getSeededRows(elementsByEntityId, entityByCodename.get('LearningResources')?.id)
    const courseRows = getSeededRows(elementsByEntityId, entityByCodename.get('Courses')?.id)
    const courseSectionRows = getSeededRows(elementsByEntityId, entityByCodename.get('CourseSections')?.id)
    const courseItemRows = getSeededRows(elementsByEntityId, entityByCodename.get('CourseItems')?.id)
    const learningTrackRows = getSeededRows(elementsByEntityId, entityByCodename.get('LearningTracks')?.id)
    const trackStageRows = getSeededRows(elementsByEntityId, entityByCodename.get('TrackStages')?.id)
    const trackStepRows = getSeededRows(elementsByEntityId, entityByCodename.get('TrackSteps')?.id)
    const quizRows = getSeededRows(elementsByEntityId, entityByCodename.get('Quizzes')?.id)
    const quizAttemptRows = getSeededRows(elementsByEntityId, entityByCodename.get('QuizAttempts')?.id)
    const quizResponseRows = getSeededRows(elementsByEntityId, entityByCodename.get('QuizResponses')?.id)
    const contentProgressRows = getSeededRows(elementsByEntityId, entityByCodename.get('ContentProgress')?.id)
    const accessLinkRows = getSeededRows(elementsByEntityId, entityByCodename.get('AccessLinks')?.id)
    const enrollmentRows = getSeededRows(elementsByEntityId, entityByCodename.get('Enrollments')?.id)
    const knowledgeSpaceRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeSpaces')?.id)
    const knowledgeFolderRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeFolders')?.id)
    const knowledgeArticleRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeArticles')?.id)
    const knowledgeBookmarkRows = getSeededRows(elementsByEntityId, entityByCodename.get('KnowledgeBookmarks')?.id)
    const developmentPlanRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlans')?.id)
    const developmentPlanStageRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlanStages')?.id)
    const developmentPlanTaskRows = getSeededRows(elementsByEntityId, entityByCodename.get('DevelopmentPlanTasks')?.id)
    const gamificationSettingRows = getSeededRows(elementsByEntityId, entityByCodename.get('GamificationSettings')?.id)
    const pointAwardRuleRows = getSeededRows(elementsByEntityId, entityByCodename.get('PointAwardRules')?.id)
    const pointTransactionRows = getSeededRows(elementsByEntityId, entityByCodename.get('PointTransactions')?.id)
    const badgeDefinitionRows = getSeededRows(elementsByEntityId, entityByCodename.get('BadgeDefinitions')?.id)
    const badgeIssueRows = getSeededRows(elementsByEntityId, entityByCodename.get('BadgeIssues')?.id)
    const leaderboardRows = getSeededRows(elementsByEntityId, entityByCodename.get('LeaderboardSnapshots')?.id)
    const reportRows = getSeededRows(elementsByEntityId, entityByCodename.get('Reports')?.id)
    const reportTypeEntityId = entityByCodename.get('ReportType')?.id
    const progressReportType = reportTypeEntityId
        ? (envelope.snapshot?.optionValues?.[reportTypeEntityId] ?? []).find(
              (optionValue) => readLocalizedText(optionValue.codename, 'en') === 'Progress'
          )
        : undefined
    if (typeof progressReportType?.id !== 'string') {
        errors.push('LMS ReportType enumeration must export the seeded Progress option')
    }

    const expectedCounts = [
        ['class', classRows.length, LMS_FIXTURE_CLASSES.length],
        ['student', studentRows.length, LMS_DEMO_STUDENTS.length],
        ['seeded guest student', guestStudentRows.length, LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.guestStudents],
        ['content project', contentProjectRows.length, 2],
        ['content access entry', contentAccessRows.length, 1],
        ['content star', contentStarRows.length, 1],
        ['recent content view', recentContentRows.length, 1],
        ['resource', resourceRows.length, LMS_DEMO_RESOURCES.length + LMS_DEMO_CONTENT_NODES.length],
        ['course', courseRows.length, LMS_DEMO_COURSES.length],
        ['course section', courseSectionRows.length, 3],
        ['course item', courseItemRows.length, 3],
        ['learning track', learningTrackRows.length, 2],
        ['track stage', trackStageRows.length, 2],
        ['track step', trackStepRows.length, 3],
        ['quiz', quizRows.length, LMS_LYCEUM_MARATHON_QUIZ_COUNT],
        ['quiz attempt', quizAttemptRows.length, LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.quizAttempts],
        ['quiz response', quizResponseRows.length, LMS_LYCEUM_MARATHON_SEEDED_RESULT_COUNTS.quizResponses],
        ['content progress', contentProgressRows.length, LMS_DEMO_CONTENT_PROGRESS.length],
        ['access link', accessLinkRows.length, LMS_DEMO_ACCESS_LINKS.length + LMS_LYCEUM_MARATHON_ACCESS_LINKS.length],
        ['enrollment', enrollmentRows.length, LMS_DEMO_ENROLLMENTS.length + 2],
        ['knowledge space', knowledgeSpaceRows.length, 1],
        ['knowledge folder', knowledgeFolderRows.length, 1],
        ['knowledge article', knowledgeArticleRows.length, 1],
        ['knowledge bookmark', knowledgeBookmarkRows.length, 1],
        ['development plan', developmentPlanRows.length, 1],
        ['development plan stage', developmentPlanStageRows.length, 1],
        ['development plan task', developmentPlanTaskRows.length, 1],
        ['gamification setting', gamificationSettingRows.length, LMS_DEMO_GAMIFICATION_SETTINGS.length],
        ['point award rule', pointAwardRuleRows.length, LMS_DEMO_POINT_AWARD_RULES.length],
        ['point transaction', pointTransactionRows.length, LMS_DEMO_POINT_TRANSACTIONS.length],
        ['badge definition', badgeDefinitionRows.length, LMS_DEMO_BADGES.length],
        ['badge issue', badgeIssueRows.length, LMS_DEMO_BADGE_ISSUES.length],
        ['leaderboard snapshot', leaderboardRows.length, LMS_DEMO_LEADERBOARD.length],
        ['report', reportRows.length, LMS_FIXTURE_REPORTS.length]
    ] as const

    for (const [label, actual, expected] of expectedCounts) {
        if (actual !== expected) {
            errors.push(`LMS fixture must seed exactly ${expected} ${label} row(s), received ${actual}`)
        }
    }

    if (resourceRows.some((row) => !row.data?.Body)) {
        errors.push('LMS fixture must seed authored LearningResources.Body content for direct app-side editing')
    }
    for (const resourceRow of resourceRows) {
        const label = readLocalizedText(resourceRow.data?.Title, 'en') ?? resourceRow.id
        assertEditorBlockTextLocalized(errors, resourceRow.data?.Body, `LMS learning resource ${label}`)
    }
    if (!knowledgeArticleRows[0]?.data?.Body) {
        errors.push('LMS fixture must seed at least one authored KnowledgeArticles.Body document')
    }
    if (knowledgeArticleRows.some((row) => typeof row.data?.SortOrder !== 'number')) {
        errors.push('LMS fixture KnowledgeArticles rows must include their required numeric SortOrder')
    }
    for (const articleRow of knowledgeArticleRows) {
        const label = readLocalizedText(articleRow.data?.Title, 'en') ?? articleRow.id
        assertEditorBlockTextLocalized(errors, articleRow.data?.Body, `LMS knowledge article ${label}`)
    }
    if (!knowledgeBookmarkRows[0]?.data?.ArticleId || knowledgeBookmarkRows[0]?.data?.FolderId) {
        errors.push('LMS fixture knowledge bookmarks must point at KnowledgeArticles instead of folders')
    }

    for (const seededCourse of LMS_DEMO_COURSES) {
        const courseRow = courseRows.find((row) => readLocalizedText(row?.data?.Title, 'en') === seededCourse.title.en)
        if (!courseRow) continue
        const parsedCatalogPolicy = catalogPublicationPolicySchema.safeParse({
            visible: courseRow.data?.CatalogVisible,
            category: courseRow.data?.CatalogCategory,
            audience: courseRow.data?.CatalogAudience,
            selfEnrollmentMode: courseRow.data?.SelfEnrollmentMode
        })
        if (!parsedCatalogPolicy.success) {
            errors.push(`LMS course ${seededCourse.key} must expose valid catalog-ready metadata`)
        } else if (
            parsedCatalogPolicy.data.visible !== true ||
            readLocalizedText(parsedCatalogPolicy.data.category, 'en') !== seededCourse.catalogCategory.en ||
            readLocalizedText(parsedCatalogPolicy.data.audience, 'en') !== seededCourse.catalogAudience.en ||
            parsedCatalogPolicy.data.selfEnrollmentMode !== seededCourse.selfEnrollmentMode
        ) {
            errors.push(`LMS course ${seededCourse.key} must keep deterministic catalog policy metadata`)
        }
    }

    for (const expectedTrack of [
        {
            title: 'New learner onboarding track',
            category: 'Onboarding',
            audience: 'New learners',
            selfEnrollmentMode: 'open'
        },
        {
            title: 'Compliance refresh track',
            category: 'Compliance',
            audience: 'All learners',
            selfEnrollmentMode: 'disabled'
        }
    ] as const) {
        const trackRow = learningTrackRows.find((row) => readLocalizedText(row?.data?.Title, 'en') === expectedTrack.title)
        if (!trackRow) continue
        const parsedCatalogPolicy = catalogPublicationPolicySchema.safeParse({
            visible: trackRow.data?.CatalogVisible,
            category: trackRow.data?.CatalogCategory,
            audience: trackRow.data?.CatalogAudience,
            selfEnrollmentMode: trackRow.data?.SelfEnrollmentMode
        })
        if (!parsedCatalogPolicy.success) {
            errors.push(`LMS learning track ${expectedTrack.title} must expose valid catalog-ready metadata`)
        } else if (
            parsedCatalogPolicy.data.visible !== true ||
            readLocalizedText(parsedCatalogPolicy.data.category, 'en') !== expectedTrack.category ||
            readLocalizedText(parsedCatalogPolicy.data.audience, 'en') !== expectedTrack.audience ||
            parsedCatalogPolicy.data.selfEnrollmentMode !== expectedTrack.selfEnrollmentMode
        ) {
            errors.push(`LMS learning track ${expectedTrack.title} must keep deterministic catalog policy metadata`)
        }
    }

    const enabledGamificationSetting = gamificationSettingRows.find((row) => row.data?.Scope === 'application')
    if (enabledGamificationSetting?.data?.Enabled !== true) {
        errors.push('LMS fixture must seed enabled application-level gamification settings')
    }
    const pointRuleCodes = new Set(pointAwardRuleRows.map((row) => row.data?.RuleCode).filter(Boolean))
    for (const requiredRuleCode of ['content.completed', 'assignment.accepted', 'manual.adjustment']) {
        if (!pointRuleCodes.has(requiredRuleCode)) {
            errors.push(`LMS fixture must seed point award rule ${requiredRuleCode}`)
        }
    }
    const approvedPoints = pointTransactionRows.reduce((sum, row) => {
        if (row.data?.Status !== 'Approved') return sum
        const value = typeof row.data?.PointsDelta === 'number' ? row.data.PointsDelta : Number(row.data?.PointsDelta)
        return Number.isFinite(value) ? sum + value : sum
    }, 0)
    const currentLeaderboardTotal = leaderboardRows.reduce((sum, row) => {
        if (row.data?.Period !== 'current') return sum
        const value = typeof row.data?.TotalPoints === 'number' ? row.data.TotalPoints : Number(row.data?.TotalPoints)
        return Number.isFinite(value) ? sum + value : sum
    }, 0)
    if (approvedPoints !== 40 || currentLeaderboardTotal !== 50) {
        errors.push('LMS fixture must keep deterministic approved points and current leaderboard totals for achievements')
    }
    const issuedBadgeCount = badgeIssueRows.filter((row) => row.data?.Status === 'Issued').length
    if (issuedBadgeCount < 1) {
        errors.push('LMS fixture must seed at least one issued learner badge')
    }
    const topLeaderboardRow = leaderboardRows.find((row) => row.data?.Rank === 1)
    if (!topLeaderboardRow || topLeaderboardRow.data?.TotalPoints !== 35 || topLeaderboardRow.data?.BadgeCount !== 1) {
        errors.push('LMS fixture must seed the deterministic top leaderboard achievement row')
    }

    const exportedResourceSourceTypes = new Set<string>()
    let hasDeferredScormPlaceholder = false
    let hasDeferredXapiPlaceholder = false
    for (const expectedResource of LMS_DEMO_RESOURCES) {
        const resourceRow = resourceRows.find(
            (row) => readLocalizedText(row?.data?.Title, 'en') === readLocalizedText(expectedResource.title, 'en')
        )
        if (!resourceRow) {
            errors.push(`LMS fixture is missing learning resource ${expectedResource.codename}`)
            continue
        }
        const resourceDefinition = resourceDefinitionSchema.safeParse({
            codename: expectedResource.codename,
            title: resourceRow.data?.Title,
            source: resourceRow.data?.Source,
            estimatedTimeMinutes: resourceRow.data?.EstimatedTimeMinutes,
            language: resourceRow.data?.Language
        })
        if (!resourceDefinition.success) {
            errors.push(`LMS learning resource ${expectedResource.codename} must match the generic resource contract`)
            continue
        }
        exportedResourceSourceTypes.add(resourceDefinition.data.source.type)
        if (resourceDefinition.data.source.type === 'scorm' && isDeferredResourceSource(resourceDefinition.data.source)) {
            hasDeferredScormPlaceholder = true
        }
        if (resourceDefinition.data.source.type === 'xapi' && isDeferredResourceSource(resourceDefinition.data.source)) {
            hasDeferredXapiPlaceholder = true
        }
        if (resourceDefinition.data.source.type !== expectedResource.source.type) {
            errors.push(
                `LMS learning resource ${expectedResource.codename} must keep source type ${expectedResource.source.type}, received ${resourceDefinition.data.source.type}`
            )
        }
    }
    for (const requiredResourceType of ['page', 'url', 'video', 'audio', 'document', 'embed', 'scorm', 'xapi']) {
        if (!exportedResourceSourceTypes.has(requiredResourceType)) {
            errors.push(`LMS fixture must seed a realistic ${requiredResourceType} learning resource source`)
        }
    }
    if (!hasDeferredScormPlaceholder) {
        errors.push('LMS fixture must keep SCORM as an explicit deferred placeholder, not a silently supported runtime player')
    }
    if (!hasDeferredXapiPlaceholder) {
        errors.push('LMS fixture must keep xAPI as an explicit deferred placeholder, not a silently supported runtime player')
    }

    const reportRowsByCodename = assertLmsReportSeedRows(errors, reportRows, LMS_FIXTURE_REPORTS, progressReportType?.id)

    for (const acceptanceArea of LMS_PRODUCT_ACCEPTANCE_MATRIX) {
        for (const reportCodename of acceptanceArea.requiredReports) {
            if (!reportRowsByCodename.has(reportCodename)) {
                errors.push(`LMS acceptance area ${acceptanceArea.area} is missing report ${reportCodename}`)
            }
        }
    }

    const classRowsByKey = new Map<string, SnapshotElement>()
    for (const seededClass of LMS_FIXTURE_CLASSES) {
        const classRow = findRowByField(classRows, 'Name', seededClass.name.en)
        if (!classRow) {
            errors.push(`LMS fixture is missing class ${seededClass.name.en}`)
            continue
        }
        classRowsByKey.set(seededClass.key, classRow)

        const classData = classRow.data ?? {}
        assertLocalizedFixtureValue(errors, classData.Name, seededClass.name, `LMS class ${seededClass.name.en} name`)
        assertLocalizedFixtureValue(errors, classData.Description, seededClass.description, `LMS class ${seededClass.name.en} description`)
        if (classData.SchoolYear !== seededClass.schoolYear) {
            errors.push(`LMS class ${seededClass.name.en} must use SchoolYear=${seededClass.schoolYear}`)
        }
        if (classData.StudentCountLimit !== seededClass.studentCountLimit) {
            errors.push(`LMS class ${seededClass.name.en} must use StudentCountLimit=${seededClass.studentCountLimit}`)
        }
    }

    const studentRowsByKey = new Map<string, SnapshotElement>()
    for (const seededStudent of LMS_DEMO_STUDENTS) {
        const studentRow = studentRows.find((row) => row?.data?.Email === seededStudent.email)
        if (!studentRow) {
            errors.push(`LMS fixture is missing student ${seededStudent.email}`)
            continue
        }
        studentRowsByKey.set(seededStudent.key, studentRow)

        const studentData = studentRow.data ?? {}
        if (readLocalizedText(studentData.DisplayName, 'en') !== seededStudent.displayName.en) {
            errors.push(`LMS student ${seededStudent.email} is missing the canonical English display name`)
        }
    }

    const quizRowsByKey = assertLmsMarathonSeedRowsContract({
        quizRows,
        accessLinkRows,
        classRowsByKey,
        errors,
        readLocalizedText,
        assertLocalizedFixtureValue
    })

    const guestContentRowsByKey = new Map<string, SnapshotElement>()
    for (const seededContent of LMS_DEMO_CONTENT_NODES) {
        const contentRow = findRowByField(resourceRows, 'Title', seededContent.title.en)
        if (!contentRow) {
            errors.push(`LMS fixture is missing guest content ${seededContent.title.en}`)
            continue
        }
        guestContentRowsByKey.set(seededContent.key, contentRow)

        const contentData = contentRow.data ?? {}
        if (readLocalizedText(contentData.Title, 'ru') !== seededContent.title.ru) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical Russian title`)
        }
        if (readLocalizedText(contentData.Description, 'en') !== seededContent.description.en) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical English description`)
        }
        if (readLocalizedText(contentData.Description, 'ru') !== seededContent.description.ru) {
            errors.push(`LMS guest content ${seededContent.title.en} is missing the canonical Russian description`)
        }
        if (contentData.EstimatedTimeMinutes !== seededContent.estimatedDurationMinutes) {
            errors.push(
                `LMS guest content ${seededContent.title.en} must keep EstimatedTimeMinutes=${seededContent.estimatedDurationMinutes}`
            )
        }

        const contentItems = Array.isArray(contentData.ContentItems) ? contentData.ContentItems : []
        if (contentItems.length !== seededContent.contentItems.en.length) {
            errors.push(`LMS guest content ${seededContent.title.en} must contain ${seededContent.contentItems.en.length} content item(s)`)
        }
        if (seededContent.contentItems.ru.length !== seededContent.contentItems.en.length) {
            errors.push(`LMS guest content ${seededContent.title.en} must define equal English and Russian content item counts`)
        }
        for (const [index, expectedEnItem] of seededContent.contentItems.en.entries()) {
            const expectedRuItem = seededContent.contentItems.ru[index]
            const actualItem = readRecord(contentItems[index])
            if (!actualItem || !expectedRuItem) {
                continue
            }

            assertLocalizedFixtureValue(
                errors,
                actualItem.ItemTitle,
                { en: expectedEnItem.itemTitle, ru: expectedRuItem.itemTitle },
                `LMS guest content ${seededContent.title.en} item ${index + 1} title`
            )
            const expectedEnContent = 'itemContent' in expectedEnItem ? expectedEnItem.itemContent : undefined
            const expectedRuContent = 'itemContent' in expectedRuItem ? expectedRuItem.itemContent : undefined
            if (expectedEnContent || expectedRuContent) {
                assertLocalizedFixtureValue(
                    errors,
                    actualItem.ItemContent,
                    { en: expectedEnContent ?? '', ru: expectedRuContent ?? '' },
                    `LMS guest content ${seededContent.title.en} item ${index + 1} content`
                )
            }
            if (actualItem.SortOrder !== expectedEnItem.sortOrder || actualItem.SortOrder !== expectedRuItem.sortOrder) {
                errors.push(`LMS guest content ${seededContent.title.en} item ${index + 1} must keep the same sort order in both locales`)
            }
        }

        const quizRefItem = contentItems.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).QuizId)
        const linkedQuizRow = quizRowsByKey.get(seededContent.linkedQuizKey)
        if (!quizRefItem || !linkedQuizRow?.id) {
            errors.push(`LMS guest content ${seededContent.title.en} must include a quiz_ref item linked to ${seededContent.linkedQuizKey}`)
        } else if ((quizRefItem as Record<string, unknown>).QuizId !== linkedQuizRow.id) {
            errors.push(`LMS guest content ${seededContent.title.en} quiz_ref item must point at the canonical seeded quiz row id`)
        }
    }

    for (const seededLink of LMS_DEMO_ACCESS_LINKS) {
        const accessLinkRow = accessLinkRows.find((row) => row?.data?.Slug === seededLink.slug)
        if (!accessLinkRow) {
            errors.push(`LMS fixture is missing access link ${seededLink.slug}`)
            continue
        }

        const accessLinkData = accessLinkRow.data ?? {}
        if (readLocalizedText(accessLinkData.LinkTitle, 'en') !== seededLink.title.en) {
            errors.push(`LMS access link ${seededLink.slug} is missing the canonical English title`)
        }
        if (readLocalizedText(accessLinkData.LinkTitle, 'ru') !== seededLink.title.ru) {
            errors.push(`LMS access link ${seededLink.slug} is missing the canonical Russian title`)
        }
        if (accessLinkData.TargetType !== 'content') {
            errors.push(`LMS access link ${seededLink.slug} must target the guest content journey`)
        }

        const linkedContentRow = guestContentRowsByKey.get(seededLink.contentKey)
        const linkedClassRow = classRowsByKey.get(seededLink.classKey)
        if (accessLinkData.TargetId !== undefined && accessLinkData.TargetId !== null) {
            errors.push(`LMS content access link ${seededLink.slug} must not store a content id in the quiz-only TargetId reference`)
        }
        if (linkedContentRow?.id && accessLinkData.ContentNodeIdRef !== linkedContentRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must reference the seeded guest content row through ContentNodeIdRef`)
        }
        if (linkedClassRow?.id && accessLinkData.LinkClassId !== linkedClassRow.id) {
            errors.push(`LMS access link ${seededLink.slug} must reference the seeded class row id`)
        }
    }

    for (const seededEnrollment of LMS_DEMO_ENROLLMENTS) {
        const expectedStudentRow = studentRowsByKey.get(seededEnrollment.studentKey)
        const expectedClassRow = classRowsByKey.get(seededEnrollment.classKey)
        const expectedContentRow = guestContentRowsByKey.get(seededEnrollment.contentKey)
        const enrollmentRow = enrollmentRows.find(
            (row) =>
                row?.data?.EnrollmentStudentId === expectedStudentRow?.id &&
                row?.data?.EnrollmentClassId === expectedClassRow?.id &&
                row?.data?.TargetType === 'content' &&
                row?.data?.TargetId === expectedContentRow?.id &&
                row?.data?.ContentNodeIdRef === expectedContentRow?.id
        )

        if (!enrollmentRow) {
            errors.push(`LMS fixture is missing enrollment ${seededEnrollment.key}`)
        } else {
            if (enrollmentRow.data?.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN) {
                errors.push(`LMS enrollment ${seededEnrollment.key} must use the runtime current-user seed token`)
            }
            if (!readLocalizedText(enrollmentRow.data?.TargetTitle, 'en')) {
                errors.push(`LMS enrollment ${seededEnrollment.key} must expose a learner-facing TargetTitle`)
            }
            if (enrollmentRow.data?.DueDateMode !== 'ByDate' || typeof enrollmentRow.data?.DuePeriodDays !== 'number') {
                errors.push(`LMS enrollment ${seededEnrollment.key} must seed due-date mode and period metadata`)
            }
        }
    }

    const courseEnrollment = enrollmentRows.find((row) => row?.data?.TargetType === 'course')
    if (
        !courseEnrollment?.data?.TargetId ||
        !courseEnrollment.data.DueDate ||
        courseEnrollment.data.DueDateMode !== 'ByDate' ||
        courseEnrollment.data.DuePeriodDays !== 14 ||
        courseEnrollment.data.RestrictAfterDueDate !== true ||
        courseEnrollment.data.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN ||
        readLocalizedText(courseEnrollment.data.TargetTitle, 'en') !== 'Compliance Refresh Course'
    ) {
        errors.push('LMS fixture must seed at least one due-date restricted course enrollment')
    }
    const trackEnrollment = enrollmentRows.find((row) => row?.data?.TargetType === 'track')
    if (
        !trackEnrollment?.data?.TargetId ||
        !trackEnrollment.data.DueDate ||
        trackEnrollment.data.DueDateMode !== 'ForPeriod' ||
        trackEnrollment.data.DuePeriodDays !== 20 ||
        trackEnrollment.data.RestrictAfterDueDate !== true ||
        trackEnrollment.data.AssignedUserId !== LMS_RUNTIME_CURRENT_USER_ID_TOKEN ||
        readLocalizedText(trackEnrollment.data.TargetTitle, 'en') !== 'Compliance refresh track'
    ) {
        errors.push('LMS fixture must seed at least one due-date restricted track enrollment')
    }

    for (const seededProgress of LMS_DEMO_CONTENT_PROGRESS) {
        const expectedStudentRow = studentRowsByKey.get(seededProgress.studentKey)
        const expectedContentRow = guestContentRowsByKey.get(seededProgress.contentKey)
        const contentProgressRow = contentProgressRows.find(
            (row) => row?.data?.ProgressStudentId === expectedStudentRow?.id && row?.data?.ContentNodeId === expectedContentRow?.id
        )

        if (!contentProgressRow) {
            errors.push(`LMS fixture is missing content progress ${seededProgress.key}`)
            continue
        }

        const contentProgressData = contentProgressRow.data ?? {}
        if (contentProgressData.ProgressStatus !== seededProgress.status) {
            errors.push(`LMS content progress ${seededProgress.key} must keep ProgressStatus=${seededProgress.status}`)
        }
        if (contentProgressData.ProgressPercent !== seededProgress.progressPercent) {
            errors.push(`LMS content progress ${seededProgress.key} must keep ProgressPercent=${seededProgress.progressPercent}`)
        }
    }
}
