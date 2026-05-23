import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, createRecord, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildSnapshotEnvelope, buildVLC, validateSnapshotEnvelope } from '@universo/utils'
import { waitForMetahubObjectId, waitForMetahubEnumerationId, waitForOptionValueId } from '../../support/lmsRuntime'
import {
    assertLmsFixtureEnvelopeContract,
    buildLmsLiveMetahubCodename,
    buildLmsLiveMetahubName,
    LMS_CANONICAL_METAHUB,
    LMS_DEMO_ACCESS_LINKS,
    LMS_DEMO_BADGE_ISSUES,
    LMS_DEMO_BADGES,
    LMS_DEMO_CLASSES,
    LMS_DEMO_COURSES,
    LMS_DEMO_DEVELOPMENT_PLAN,
    LMS_DEMO_ENROLLMENTS,
    LMS_DEMO_GAMIFICATION_SETTINGS,
    LMS_DEMO_KNOWLEDGE_ARTICLE,
    LMS_DEMO_KNOWLEDGE_SPACE,
    LMS_DEMO_LEADERBOARD,
    LMS_DEMO_CONTENT_PROGRESS,
    LMS_DEMO_CONTENT_NODES,
    LMS_DEMO_POINT_AWARD_RULES,
    LMS_DEMO_POINT_TRANSACTIONS,
    LMS_DEMO_QUIZ_RESPONSES,
    LMS_DEMO_QUIZZES,
    LMS_DEMO_REPORTS,
    LMS_DEMO_RESOURCES,
    LMS_DEMO_STUDENTS,
    LMS_RUNTIME_CURRENT_USER_ID_TOKEN,
    LMS_FIXTURE_FILENAME
} from '../../support/lmsFixtureContract'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')

const buildEditorBlockContent = (blocks: Array<Record<string, unknown>>) => ({
    format: 'editorjs',
    version: '2.29.0',
    blocks
})

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
        classesObjectId,
        studentsObjectId,
        contentProjectsObjectId,
        contentAccessEntriesObjectId,
        contentStarsObjectId,
        recentContentViewsObjectId,
        learningResourcesObjectId,
        coursesObjectId,
        courseSectionsObjectId,
        courseItemsObjectId,
        learningTracksObjectId,
        trackStagesObjectId,
        trackStepsObjectId,
        quizzesObjectId,
        quizResponsesObjectId,
        contentProgressObjectId,
        accessLinksObjectId,
        enrollmentsObjectId,
        knowledgeSpacesObjectId,
        knowledgeFoldersObjectId,
        knowledgeArticlesObjectId,
        knowledgeBookmarksObjectId,
        developmentPlansObjectId,
        developmentPlanStagesObjectId,
        developmentPlanTasksObjectId,
        gamificationSettingsObjectId,
        pointAwardRulesObjectId,
        pointTransactionsObjectId,
        badgeDefinitionsObjectId,
        badgeIssuesObjectId,
        leaderboardSnapshotsObjectId,
        reportsObjectId,
        contentTypeEnumerationId,
        resourceTypeEnumerationId,
        learningResourceStatusEnumerationId,
        questionTypeEnumerationId,
        enrollmentStatusEnumerationId,
        completionStatusEnumerationId,
        publicationStatusEnumerationId,
        pointSourceTypeEnumerationId,
        reportTypeEnumerationId
    ] = await Promise.all([
        waitForMetahubObjectId(api, metahubId, 'Classes'),
        waitForMetahubObjectId(api, metahubId, 'Students'),
        waitForMetahubObjectId(api, metahubId, 'Content Projects'),
        waitForMetahubObjectId(api, metahubId, 'Content Access Entries'),
        waitForMetahubObjectId(api, metahubId, 'Content Stars'),
        waitForMetahubObjectId(api, metahubId, 'Recent Content Views'),
        waitForMetahubObjectId(api, metahubId, 'Learning Resources'),
        waitForMetahubObjectId(api, metahubId, 'Courses'),
        waitForMetahubObjectId(api, metahubId, 'Course Sections'),
        waitForMetahubObjectId(api, metahubId, 'Course Items'),
        waitForMetahubObjectId(api, metahubId, 'Learning Tracks'),
        waitForMetahubObjectId(api, metahubId, 'Track Stages'),
        waitForMetahubObjectId(api, metahubId, 'Track Steps'),
        waitForMetahubObjectId(api, metahubId, 'Quizzes'),
        waitForMetahubObjectId(api, metahubId, 'Quiz Responses'),
        waitForMetahubObjectId(api, metahubId, 'Content Progress'),
        waitForMetahubObjectId(api, metahubId, 'Access Links'),
        waitForMetahubObjectId(api, metahubId, 'Enrollments'),
        waitForMetahubObjectId(api, metahubId, 'Knowledge Spaces'),
        waitForMetahubObjectId(api, metahubId, 'Knowledge Folders'),
        waitForMetahubObjectId(api, metahubId, 'Knowledge Articles'),
        waitForMetahubObjectId(api, metahubId, 'Knowledge Bookmarks'),
        waitForMetahubObjectId(api, metahubId, 'Development Plans'),
        waitForMetahubObjectId(api, metahubId, 'Development Plan Stages'),
        waitForMetahubObjectId(api, metahubId, 'Development Plan Tasks'),
        waitForMetahubObjectId(api, metahubId, 'Gamification Settings'),
        waitForMetahubObjectId(api, metahubId, 'Point Award Rules'),
        waitForMetahubObjectId(api, metahubId, 'Point Transactions'),
        waitForMetahubObjectId(api, metahubId, 'Badge Definitions'),
        waitForMetahubObjectId(api, metahubId, 'Badge Issues'),
        waitForMetahubObjectId(api, metahubId, 'Leaderboard Snapshots'),
        waitForMetahubObjectId(api, metahubId, 'Reports'),
        waitForMetahubEnumerationId(api, metahubId, 'Content Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Resource Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Learning Resource Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Question Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Enrollment Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Completion Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Publication Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Point Source Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Report Type')
    ])

    const [
        textValueId,
        quizRefValueId,
        resourceTypeValueIds,
        publishedLearningResourceStatusValueId,
        singleChoiceValueId,
        activeEnrollmentStatusValueId,
        inProgressCompletionStatusValueId,
        publishedPublicationStatusValueId,
        pointSourceTypeValueIds,
        progressReportTypeValueId
    ] = await Promise.all([
        waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'Text'),
        waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'QuizRef'),
        Promise.all([
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Page'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Url'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Video'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Audio'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Document'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Scorm'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Xapi'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Embed'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'File')
        ]).then(([page, url, video, audio, document, scorm, xapi, embed, file]) => ({
            page,
            url,
            video,
            audio,
            document,
            scorm,
            xapi,
            embed,
            file
        })),
        waitForOptionValueId(api, metahubId, learningResourceStatusEnumerationId, 'Published'),
        waitForOptionValueId(api, metahubId, questionTypeEnumerationId, 'SingleChoice'),
        waitForOptionValueId(api, metahubId, enrollmentStatusEnumerationId, 'Active'),
        waitForOptionValueId(api, metahubId, completionStatusEnumerationId, 'InProgress'),
        waitForOptionValueId(api, metahubId, publicationStatusEnumerationId, 'Published'),
        Promise.all([
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'Course'),
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'Track'),
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'Assignment'),
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'TrainingEvent'),
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'Certificate'),
            waitForOptionValueId(api, metahubId, pointSourceTypeEnumerationId, 'Manual')
        ]).then(([course, track, assignment, trainingEvent, certificate, manual]) => ({
            Course: course,
            Track: track,
            Assignment: assignment,
            TrainingEvent: trainingEvent,
            Certificate: certificate,
            Manual: manual
        })),
        waitForOptionValueId(api, metahubId, reportTypeEnumerationId, 'Progress')
    ])

    const classRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededClass of LMS_DEMO_CLASSES) {
        const classRow = await createRecord(api, metahubId, classesObjectId, {
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
        const studentRow = await createRecord(api, metahubId, studentsObjectId, {
            data: {
                DisplayName: seededStudent.displayName.en,
                Email: seededStudent.email,
                IsGuest: false,
                GuestSessionToken: null
            }
        })
        studentRowsByKey.set(seededStudent.key, studentRow)
    }

    const contentProjectRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    const onboardingProject = await createRecord(api, metahubId, contentProjectsObjectId, {
        data: {
            Title: buildVLC('Onboarding library', 'Библиотека адаптации'),
            Description: buildVLC(
                'Workspace project for onboarding pages, links, courses, and tracks.',
                'Проект рабочего пространства для страниц, ссылок, курсов и треков адаптации.'
            ),
            AccessMode: 'workspace',
            SortOrder: 1,
            ArchivedAt: null
        }
    })
    contentProjectRowsByKey.set('onboarding-project', onboardingProject)
    const complianceProject = await createRecord(api, metahubId, contentProjectsObjectId, {
        data: {
            Title: buildVLC('Compliance library', 'Библиотека требований'),
            Description: buildVLC(
                'Workspace project for compliance and certificate policy content.',
                'Проект рабочего пространства для требований и политики сертификатов.'
            ),
            AccessMode: 'restricted',
            SortOrder: 2,
            ArchivedAt: null
        }
    })
    contentProjectRowsByKey.set('compliance-project', complianceProject)

    const resourceRowsByCodename = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededResource of LMS_DEMO_RESOURCES) {
        const resourceTypeValueId = resourceTypeValueIds[seededResource.source.type]
        const projectRow =
            seededResource.codename === 'CertificatePolicyResource'
                ? contentProjectRowsByKey.get('compliance-project')
                : contentProjectRowsByKey.get('onboarding-project')
        const resourceRow = await createRecord(api, metahubId, learningResourcesObjectId, {
            data: {
                ProjectId: projectRow?.id ?? null,
                Title: seededResource.title,
                ResourceType: resourceTypeValueId,
                Source: seededResource.source,
                Body: buildEditorBlockContent([
                    {
                        type: 'header',
                        data: { text: seededResource.title, level: 2 }
                    },
                    {
                        type: 'paragraph',
                        data: {
                            text:
                                seededResource.source.type === 'page'
                                    ? buildVLC(
                                          'This page resource is authored inside the published application.',
                                          'Этот ресурс страницы создается внутри опубликованного приложения.'
                                      )
                                    : buildVLC(
                                          `Use this ${seededResource.source.type.toLowerCase()} resource inside learning flows.`,
                                          `Используйте этот ресурс типа ${seededResource.source.type.toLowerCase()} в учебных потоках.`
                                      )
                        }
                    }
                ]),
                PublicationStatus: publishedPublicationStatusValueId,
                EstimatedTimeMinutes: seededResource.estimatedTimeMinutes ?? 0,
                Language: seededResource.language ?? 'en',
                Version: '1.0',
                CreatedBy: '{{runtime.currentUserId}}'
            }
        })
        resourceRowsByCodename.set(seededResource.codename, resourceRow)
    }

    const firstResource = resourceRowsByCodename.values().next().value as Awaited<ReturnType<typeof createRecord>> | undefined
    if (firstResource) {
        await createRecord(api, metahubId, contentStarsObjectId, {
            data: {
                TargetObjectCodename: 'LearningResources',
                TargetRecordId: firstResource.id,
                UserId: '{{runtime.currentUserId}}',
                StarredAt: '2061-02-01T07:45:00.000Z'
            }
        })
        await createRecord(api, metahubId, recentContentViewsObjectId, {
            data: {
                TargetObjectCodename: 'LearningResources',
                TargetRecordId: firstResource.id,
                UserId: '{{runtime.currentUserId}}',
                ViewedAt: '2061-02-01T08:00:00.000Z'
            }
        })
        await createRecord(api, metahubId, contentAccessEntriesObjectId, {
            data: {
                TargetObjectCodename: 'LearningResources',
                TargetRecordId: firstResource.id,
                PrincipalType: 'workspaceMember',
                PrincipalId: '{{runtime.currentUserId}}',
                AccessLevel: 'canEdit',
                InvitedBy: '{{runtime.currentUserId}}',
                InvitedAt: '2061-02-01T08:05:00.000Z'
            }
        })
    }

    const courseRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededCourse of LMS_DEMO_COURSES) {
        const projectRow =
            seededCourse.key === 'compliance-course'
                ? contentProjectRowsByKey.get('compliance-project')
                : contentProjectRowsByKey.get('onboarding-project')
        const courseRow = await createRecord(api, metahubId, coursesObjectId, {
            data: {
                ProjectId: projectRow?.id ?? null,
                Title: buildVLC(seededCourse.title.en, seededCourse.title.ru),
                Description: buildVLC(seededCourse.description.en, seededCourse.description.ru),
                Status: publishedLearningResourceStatusValueId,
                NavigationMode: 'free',
                CompletionCondition: 'allItems',
                StatusFormat: 'completeIncomplete',
                Instructor: 'Training Team',
                Tags: seededCourse.key === 'compliance-course' ? 'compliance,certificate' : 'onboarding,start',
                CatalogVisible: true,
                CatalogCategory: buildVLC(seededCourse.catalogCategory.en, seededCourse.catalogCategory.ru),
                CatalogAudience: buildVLC(seededCourse.catalogAudience.en, seededCourse.catalogAudience.ru),
                SelfEnrollmentMode: seededCourse.selfEnrollmentMode,
                EstimatedTimeMinutes: seededCourse.estimatedTimeMinutes
            }
        })
        courseRowsByKey.set(seededCourse.key, courseRow)
    }

    const quizRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededQuiz of LMS_DEMO_QUIZZES) {
        const quizRow = await createRecord(api, metahubId, quizzesObjectId, {
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

    const guestContentRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const seededContent of LMS_DEMO_CONTENT_NODES) {
        const contentRow = await createRecord(api, metahubId, learningResourcesObjectId, {
            data: {
                Title: buildVLC(seededContent.title.en, seededContent.title.ru),
                Name: buildVLC(seededContent.title.en, seededContent.title.ru),
                Description: buildVLC(seededContent.description.en, seededContent.description.ru),
                ResourceType: resourceTypeValueIds.page,
                Source: { type: 'page', pageCodename: 'CourseOverview' },
                EstimatedTimeMinutes: seededContent.estimatedDurationMinutes,
                PublicationStatus: publishedPublicationStatusValueId,
                Body: buildEditorBlockContent([
                    {
                        type: 'header',
                        data: { text: buildVLC(seededContent.title.en, seededContent.title.ru), level: 2 }
                    },
                    {
                        type: 'paragraph',
                        data: { text: buildVLC(seededContent.description.en, seededContent.description.ru) }
                    }
                ]),
                ContentItems: seededContent.contentItems.en.map((item, index) => {
                    const localizedItem = seededContent.contentItems.ru[index]
                    const isQuizRef = item.itemType === 'QuizRef'
                    return {
                        ItemType: isQuizRef ? quizRefValueId : textValueId,
                        ItemTitle: buildVLC(item.itemTitle, localizedItem.itemTitle),
                        ...(item.itemContent
                            ? { ItemContent: buildVLC(item.itemContent, localizedItem.itemContent ?? localizedItem.itemTitle) }
                            : {}),
                        ...(isQuizRef ? { QuizId: quizRowsByKey.get(seededContent.linkedQuizKey)?.id ?? null } : {}),
                        SortOrder: item.sortOrder
                    }
                })
            }
        })
        guestContentRowsByKey.set(seededContent.key, contentRow)
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
            description: buildVLC(
                'Read the overview page and complete the first content item.',
                'Прочитайте обзорную страницу и завершите первый элемент контента.'
            ),
            resource: overviewResource,
            sortOrder: 1
        },
        {
            course: onboardingCourse,
            title: buildVLC('Watch the safety intro', 'Посмотрите вводное видео по безопасности'),
            description: buildVLC(
                'Open the safety resource and continue to the course content.',
                'Откройте ресурс по безопасности и перейдите к контенту курса.'
            ),
            resource: safetyVideoResource,
            sortOrder: 2
        },
        {
            course: complianceCourse,
            title: buildVLC('Read the certificate policy', 'Изучите политику сертификатов'),
            description: buildVLC('Review the certificate policy resource.', 'Изучите ресурс с политикой сертификатов.'),
            resource: certificatePolicyResource,
            sortOrder: 1
        }
    ]

    for (const section of courseSections) {
        const sectionRow = await createRecord(api, metahubId, courseSectionsObjectId, {
            data: {
                CourseId: section.course?.id ?? null,
                Title: section.title,
                Description: section.description,
                SortOrder: section.sortOrder
            }
        })
        await createRecord(api, metahubId, courseItemsObjectId, {
            data: {
                CourseId: section.course?.id ?? null,
                SectionId: sectionRow.id,
                Title: section.title,
                TargetObjectCodename: 'LearningResources',
                TargetRecordId: section.resource?.id ?? null,
                ItemType: 'Page',
                SortOrder: section.sortOrder,
                IsRequired: true,
                CompletionWeight: 1,
                EstimatedTimeMinutes: 10
            }
        })
    }

    const trackRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    const onboardingTrack = await createRecord(api, metahubId, learningTracksObjectId, {
        data: {
            ProjectId: contentProjectRowsByKey.get('onboarding-project')?.id ?? null,
            Title: buildVLC('New learner onboarding track', 'Трек адаптации нового учащегося'),
            Description: buildVLC('A guided sequence for the first learning week.', 'Последовательный маршрут на первую учебную неделю.'),
            Status: publishedLearningResourceStatusValueId,
            OrderMode: 'sequential',
            Instructor: 'Training Team',
            Tags: 'onboarding,start',
            CatalogVisible: true,
            CatalogCategory: buildVLC('Onboarding', 'Адаптация'),
            CatalogAudience: buildVLC('New learners', 'Новые учащиеся'),
            SelfEnrollmentMode: 'open'
        }
    })
    trackRowsByKey.set('onboarding-track', onboardingTrack)

    const complianceTrack = await createRecord(api, metahubId, learningTracksObjectId, {
        data: {
            ProjectId: contentProjectRowsByKey.get('compliance-project')?.id ?? null,
            Title: buildVLC('Compliance refresh track', 'Трек обновления требований'),
            Description: buildVLC('A short periodic compliance route.', 'Короткий периодический маршрут по требованиям.'),
            Status: publishedLearningResourceStatusValueId,
            OrderMode: 'sequential',
            Instructor: 'Compliance Team',
            Tags: 'compliance,certificate',
            CatalogVisible: true,
            CatalogCategory: buildVLC('Compliance', 'Соответствие'),
            CatalogAudience: buildVLC('All learners', 'Все учащиеся'),
            SelfEnrollmentMode: 'disabled'
        }
    })
    trackRowsByKey.set('compliance-track', complianceTrack)

    const onboardingStage = await createRecord(api, metahubId, trackStagesObjectId, {
        data: {
            TrackId: onboardingTrack.id,
            Title: buildVLC('Week 1', 'Неделя 1'),
            Description: buildVLC('Required first-week onboarding courses.', 'Обязательные курсы первой недели адаптации.'),
            SortOrder: 1
        }
    })
    const complianceStage = await createRecord(api, metahubId, trackStagesObjectId, {
        data: {
            TrackId: complianceTrack.id,
            Title: buildVLC('Refresh', 'Повторение'),
            Description: buildVLC('Periodic compliance refresh courses.', 'Периодическое повторение требований.'),
            SortOrder: 1
        }
    })

    const trackSteps = [
        {
            track: onboardingTrack,
            stage: onboardingStage,
            course: onboardingCourse,
            title: buildVLC('Start onboarding', 'Начало адаптации'),
            sortOrder: 1
        },
        {
            track: onboardingTrack,
            stage: onboardingStage,
            course: complianceCourse,
            title: buildVLC('Compliance essentials', 'Основы требований'),
            sortOrder: 2
        },
        {
            track: complianceTrack,
            stage: complianceStage,
            course: complianceCourse,
            title: buildVLC('Refresh compliance', 'Повторение требований'),
            sortOrder: 1
        }
    ]

    for (const step of trackSteps) {
        await createRecord(api, metahubId, trackStepsObjectId, {
            data: {
                TrackId: step.track.id,
                StageId: step.stage.id,
                CourseId: step.course?.id ?? null,
                Title: step.title,
                SortOrder: step.sortOrder,
                EnrollmentOffsetDays: step.sortOrder - 1,
                DueOffsetDays: 7,
                RestrictAfterDueDate: false,
                IsRequired: true
            }
        })
    }

    for (const seededLink of LMS_DEMO_ACCESS_LINKS) {
        await createRecord(api, metahubId, accessLinksObjectId, {
            data: {
                Slug: seededLink.slug,
                TargetType: 'content',
                TargetId: guestContentRowsByKey.get(seededLink.contentKey)?.id ?? null,
                ContentNodeIdRef: guestContentRowsByKey.get(seededLink.contentKey)?.id ?? null,
                LinkClassId: classRowsByKey.get(seededLink.classKey)?.id ?? null,
                IsActive: true,
                MaxUses: 50,
                UseCount: 0,
                LinkTitle: buildVLC(seededLink.title.en, seededLink.title.ru)
            }
        })
    }

    for (const seededEnrollment of LMS_DEMO_ENROLLMENTS) {
        const seededContent = LMS_DEMO_CONTENT_NODES.find((content) => content.key === seededEnrollment.contentKey)
        await createRecord(api, metahubId, enrollmentsObjectId, {
            data: {
                EnrollmentStudentId: studentRowsByKey.get(seededEnrollment.studentKey)?.id ?? null,
                EnrollmentClassId: classRowsByKey.get(seededEnrollment.classKey)?.id ?? null,
                AssignedUserId: LMS_RUNTIME_CURRENT_USER_ID_TOKEN,
                TargetTitle: seededContent ? buildVLC(seededContent.title.en, seededContent.title.ru) : null,
                TargetType: 'content',
                TargetId: guestContentRowsByKey.get(seededEnrollment.contentKey)?.id ?? null,
                ContentNodeIdRef: guestContentRowsByKey.get(seededEnrollment.contentKey)?.id ?? null,
                EnrollmentStatus: activeEnrollmentStatusValueId,
                EnrolledAt: '2061-02-01T08:00:00.000Z',
                DueDateMode: 'ByDate',
                DueDate: '2061-02-07T18:00:00.000Z',
                DuePeriodDays: 7,
                RestrictAfterDueDate: false,
                CompletedAt: seededEnrollment.contentKey === 'docking-corridor' ? null : '2061-02-01T10:00:00.000Z',
                Score: seededEnrollment.contentKey === 'docking-corridor' ? 50 : 100
            }
        })
    }

    await createRecord(api, metahubId, enrollmentsObjectId, {
        data: {
            EnrollmentStudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            EnrollmentClassId: classRowsByKey.get('learning-path')?.id ?? null,
            AssignedUserId: LMS_RUNTIME_CURRENT_USER_ID_TOKEN,
            TargetTitle: buildVLC('Compliance Refresh Course', 'Курс обновления требований'),
            TargetType: 'course',
            TargetId: complianceCourse?.id ?? null,
            EnrollmentStatus: activeEnrollmentStatusValueId,
            EnrolledAt: '2061-02-01T08:00:00.000Z',
            DueDateMode: 'ByDate',
            DueDate: '2061-02-14T18:00:00.000Z',
            DuePeriodDays: 14,
            RestrictAfterDueDate: true,
            CompletedAt: null,
            Score: 0
        }
    })

    await createRecord(api, metahubId, enrollmentsObjectId, {
        data: {
            EnrollmentStudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            EnrollmentClassId: classRowsByKey.get('learning-path')?.id ?? null,
            AssignedUserId: LMS_RUNTIME_CURRENT_USER_ID_TOKEN,
            TargetTitle: buildVLC('Compliance refresh track', 'Трек повторения требований'),
            TargetType: 'track',
            TargetId: complianceTrack?.id ?? null,
            EnrollmentStatus: activeEnrollmentStatusValueId,
            EnrolledAt: '2061-02-01T08:00:00.000Z',
            DueDateMode: 'ForPeriod',
            DueDate: '2061-02-21T18:00:00.000Z',
            DuePeriodDays: 20,
            RestrictAfterDueDate: true,
            CompletedAt: null,
            Score: 0
        }
    })

    for (const seededProgress of LMS_DEMO_CONTENT_PROGRESS) {
        await createRecord(api, metahubId, contentProgressObjectId, {
            data: {
                ProgressStudentId: studentRowsByKey.get(seededProgress.studentKey)?.id ?? null,
                ContentNodeId: guestContentRowsByKey.get(seededProgress.contentKey)?.id ?? null,
                ProgressStatus: seededProgress.status,
                ProgressPercent: seededProgress.progressPercent,
                StartedAt: '2061-02-01T08:15:00.000Z',
                CompletedAt: seededProgress.status === 'completed' ? '2061-02-01T10:00:00.000Z' : null,
                LastAccessedItemIndex: seededProgress.status === 'completed' ? 2 : 1
            }
        })
    }

    for (const seededResponse of LMS_DEMO_QUIZ_RESPONSES) {
        await createRecord(api, metahubId, quizResponsesObjectId, {
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

    const knowledgeSpaceRow = await createRecord(api, metahubId, knowledgeSpacesObjectId, {
        data: {
            Title: buildVLC(LMS_DEMO_KNOWLEDGE_SPACE.title.en, LMS_DEMO_KNOWLEDGE_SPACE.title.ru),
            Description: buildVLC(LMS_DEMO_KNOWLEDGE_SPACE.description.en, LMS_DEMO_KNOWLEDGE_SPACE.description.ru),
            Visibility: 'workspace'
        }
    })
    const knowledgeFolderRow = await createRecord(api, metahubId, knowledgeFoldersObjectId, {
        data: {
            SpaceId: knowledgeSpaceRow.id,
            Title: buildVLC('Getting started articles', 'Статьи для старта'),
            SortOrder: 1
        }
    })
    const knowledgeArticleRow = await createRecord(api, metahubId, knowledgeArticlesObjectId, {
        data: {
            FolderId: knowledgeFolderRow.id,
            Title: buildVLC(LMS_DEMO_KNOWLEDGE_ARTICLE.title.en, LMS_DEMO_KNOWLEDGE_ARTICLE.title.ru),
            Body: buildEditorBlockContent([
                {
                    type: 'header',
                    data: { text: buildVLC(LMS_DEMO_KNOWLEDGE_ARTICLE.title.en, LMS_DEMO_KNOWLEDGE_ARTICLE.title.ru), level: 2 }
                },
                {
                    type: 'paragraph',
                    data: { text: buildVLC(LMS_DEMO_KNOWLEDGE_ARTICLE.body.en, LMS_DEMO_KNOWLEDGE_ARTICLE.body.ru) }
                }
            ]),
            Status: publishedLearningResourceStatusValueId
        }
    })
    await createRecord(api, metahubId, knowledgeBookmarksObjectId, {
        data: {
            StudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            ArticleId: knowledgeArticleRow.id,
            CreatedAt: '2061-02-01T09:00:00.000Z'
        }
    })

    const developmentPlanRow = await createRecord(api, metahubId, developmentPlansObjectId, {
        data: {
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.title.en, LMS_DEMO_DEVELOPMENT_PLAN.title.ru),
            StudentId: studentRowsByKey.get('ava-solaris')?.id ?? null,
            SupervisorEmail: 'supervisor@example.test',
            Status: inProgressCompletionStatusValueId
        }
    })
    const developmentStageRow = await createRecord(api, metahubId, developmentPlanStagesObjectId, {
        data: {
            PlanId: developmentPlanRow.id,
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.stageTitle.en, LMS_DEMO_DEVELOPMENT_PLAN.stageTitle.ru),
            SortOrder: 1
        }
    })
    await createRecord(api, metahubId, developmentPlanTasksObjectId, {
        data: {
            StageId: developmentStageRow.id,
            Title: buildVLC(LMS_DEMO_DEVELOPMENT_PLAN.taskTitle.en, LMS_DEMO_DEVELOPMENT_PLAN.taskTitle.ru),
            ResourceId: overviewResource?.id ?? null,
            Status: 'NotStarted'
        }
    })

    for (const setting of LMS_DEMO_GAMIFICATION_SETTINGS) {
        await createRecord(api, metahubId, gamificationSettingsObjectId, {
            data: {
                Scope: setting.scope,
                WorkspaceKey: setting.workspaceKey,
                Enabled: setting.enabled,
                LeaderboardPeriodDays: setting.leaderboardPeriodDays,
                Rules: setting.rules
            }
        })
    }

    for (const rule of LMS_DEMO_POINT_AWARD_RULES) {
        await createRecord(api, metahubId, pointAwardRulesObjectId, {
            data: {
                RuleCode: rule.ruleCode,
                Name: buildVLC(rule.name.en, rule.name.ru),
                SourceType: pointSourceTypeValueIds[rule.sourceType],
                Points: rule.points,
                IsActive: rule.isActive,
                Conditions: rule.conditions
            }
        })
    }

    for (const transaction of LMS_DEMO_POINT_TRANSACTIONS) {
        await createRecord(api, metahubId, pointTransactionsObjectId, {
            data: {
                StudentId: studentRowsByKey.get(transaction.studentKey)?.id ?? null,
                SourceType: pointSourceTypeValueIds[transaction.sourceType],
                SourceObjectId: guestContentRowsByKey.get(transaction.sourceObjectKey)?.id ?? transaction.sourceObjectKey,
                PointsDelta: transaction.pointsDelta,
                Reason: buildVLC(transaction.reason.en, transaction.reason.ru),
                AwardedAt: transaction.awardedAt,
                Status: transaction.status
            }
        })
    }

    const badgeRowsByKey = new Map<string, Awaited<ReturnType<typeof createRecord>>>()
    for (const badge of LMS_DEMO_BADGES) {
        const badgeRow = await createRecord(api, metahubId, badgeDefinitionsObjectId, {
            data: {
                BadgeCode: badge.badgeCode,
                Name: buildVLC(badge.name.en, badge.name.ru),
                Description: buildVLC(badge.description.en, badge.description.ru),
                RequiredPoints: badge.requiredPoints,
                Icon: badge.icon,
                IsActive: badge.isActive
            }
        })
        badgeRowsByKey.set(badge.key, badgeRow)
    }

    for (const issue of LMS_DEMO_BADGE_ISSUES) {
        await createRecord(api, metahubId, badgeIssuesObjectId, {
            data: {
                StudentId: studentRowsByKey.get(issue.studentKey)?.id ?? null,
                BadgeId: badgeRowsByKey.get(issue.badgeKey)?.id ?? null,
                IssuedAt: issue.issuedAt,
                RevokedAt: issue.revokedAt,
                Status: issue.status,
                Reason: buildVLC(issue.reason.en, issue.reason.ru)
            }
        })
    }

    for (const leaderboardRow of LMS_DEMO_LEADERBOARD) {
        await createRecord(api, metahubId, leaderboardSnapshotsObjectId, {
            data: {
                StudentId: studentRowsByKey.get(leaderboardRow.studentKey)?.id ?? null,
                Period: leaderboardRow.period,
                TotalPoints: leaderboardRow.totalPoints,
                Rank: leaderboardRow.rank,
                BadgeCount: leaderboardRow.badgeCount,
                CalculatedAt: leaderboardRow.calculatedAt
            }
        })
    }

    for (const reportDefinition of LMS_DEMO_REPORTS) {
        await createRecord(api, metahubId, reportsObjectId, {
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
        test.setTimeout(600_000)

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
