import { describe, expect, it } from 'vitest'

import {
    DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS,
    applicationLearningContentSettingsSchema,
    applicationRolePolicySettingsSchema,
    catalogPublicationPolicySchema,
    collectUnsupportedActiveCapabilityRules,
    contentAccessEntrySchema,
    contentProjectSchema,
    contentStarSchema,
    courseCompletionPolicySchema,
    learningContentColumnPresetSchema,
    lmsAcceptanceMatrixSchema,
    playerPresetSchema,
    recentContentViewSchema,
    reportDefinitionSchema,
    resourceDefinitionSchema,
    resourceSourceSchema,
    rolePolicyTemplateSchema,
    runtimeContentRefSchema,
    sanitizeApplicationLearningContentSettings,
    sanitizeApplicationRolePolicySettingsForSupportedScopes,
    sequencePolicySchema,
    trackOrderPolicySchema,
    trashEntrySchema,
    workflowActionSchema
} from '../index'

describe('LMS platform primitive contracts', () => {
    const projectId = '018f0000-0000-7000-8000-000000000001'
    const recordId = '018f0000-0000-7000-8000-000000000002'
    const userId = '018f0000-0000-7000-8000-000000000003'

    it('accepts resource definitions for page and URL-backed content', () => {
        expect(
            resourceDefinitionSchema.parse({
                codename: 'SafetyVideo',
                title: { en: 'Safety video', ru: 'Видео по безопасности' },
                source: {
                    type: 'video',
                    url: 'https://example.test/video.mp4',
                    mimeType: 'video/mp4',
                    launchMode: 'inline'
                },
                estimatedTimeMinutes: 8,
                language: 'en'
            })
        ).toMatchObject({
            codename: 'SafetyVideo',
            source: { type: 'video', launchMode: 'inline' }
        })

        expect(
            resourceSourceSchema.parse({
                type: 'page',
                pageCodename: 'CourseOverview'
            })
        ).toEqual({
            type: 'page',
            pageCodename: 'CourseOverview',
            launchMode: 'inline'
        })

        expect(
            resourceDefinitionSchema.parse({
                codename: 'XapiPlaceholder',
                title: { en: 'xAPI package', ru: 'Пакет xAPI' },
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
            })
        ).toMatchObject({
            codename: 'XapiPlaceholder',
            source: { type: 'xapi', launchMode: 'inline' }
        })
    })

    it('rejects ambiguous or incompatible resource source locators', () => {
        expect(() =>
            resourceSourceSchema.parse({
                type: 'page',
                url: 'https://example.test',
                pageCodename: 'CourseOverview'
            })
        ).toThrow(/exactly one source locator/)

        expect(() =>
            resourceSourceSchema.parse({
                type: 'video',
                pageCodename: 'CourseOverview'
            })
        ).toThrow(/video resources must use url/)
    })

    it('models sequence policies and workflow actions without runtime record command expansion', () => {
        expect(
            sequencePolicySchema.parse({
                mode: 'sequential',
                orderFieldCodename: 'SortOrder',
                completion: [{ kind: 'progressPercent', field: 'ProgressPercent', value: 100 }],
                maxAttempts: 3
            })
        ).toMatchObject({
            mode: 'sequential',
            completion: [{ kind: 'progressPercent', field: 'ProgressPercent', value: 100 }]
        })

        expect(
            workflowActionSchema.parse({
                codename: 'ApproveSubmission',
                title: 'Approve submission',
                from: ['PendingReview'],
                to: 'Accepted',
                requiredCapabilities: ['assignment.review'],
                scriptCodename: 'AssignmentGradingScript'
            })
        ).toMatchObject({
            codename: 'ApproveSubmission',
            to: 'Accepted'
        })
    })

    it('validates role policies as generic capability rules', () => {
        expect(
            rolePolicyTemplateSchema.parse({
                codename: 'Supervisor',
                title: { en: 'Supervisor', ru: 'Руководитель' },
                baseRole: 'member',
                rules: [
                    { capability: 'records.read', effect: 'allow', scope: 'department' },
                    { capability: 'reports.view', effect: 'allow', scope: 'department' }
                ]
            })
        ).toEqual({
            codename: 'Supervisor',
            title: { en: 'Supervisor', ru: 'Руководитель' },
            baseRole: 'member',
            rules: [
                { capability: 'records.read', effect: 'allow', scope: 'department' },
                { capability: 'reports.view', effect: 'allow', scope: 'department' }
            ]
        })

        expect(
            applicationRolePolicySettingsSchema.parse({
                templates: [
                    {
                        codename: 'Reporter',
                        title: { en: 'Reporter' },
                        baseRole: 'member',
                        rules: [{ capability: 'reports.read', effect: 'allow', scope: 'workspace' }]
                    }
                ]
            })
        ).toMatchObject({
            templates: [{ codename: 'Reporter', baseRole: 'member' }]
        })
    })

    it('downgrades unsupported scoped active role policy grants to fail closed settings', () => {
        const rolePolicies = {
            templates: [
                {
                    codename: 'reviewerPolicy',
                    title: 'Reviewer permissions',
                    baseRole: 'editor' as const,
                    rules: [
                        {
                            capability: 'assignment.review',
                            effect: 'allow' as const,
                            scope: 'recordOwner' as const
                        },
                        {
                            capability: 'reports.read',
                            effect: 'allow' as const,
                            scope: 'workspace' as const
                        }
                    ]
                }
            ]
        }

        expect(collectUnsupportedActiveCapabilityRules(rolePolicies)).toEqual([
            {
                templateCodename: 'reviewerPolicy',
                capability: 'assignment.review',
                scope: 'recordOwner'
            }
        ])
        expect(sanitizeApplicationRolePolicySettingsForSupportedScopes(rolePolicies).templates[0].rules).toEqual([
            expect.objectContaining({
                capability: 'assignment.review',
                effect: 'deny',
                scope: 'recordOwner'
            }),
            expect.objectContaining({
                capability: 'reports.read',
                effect: 'allow',
                scope: 'workspace'
            })
        ])
    })

    it('validates Object-backed report definitions over runtime datasource descriptors', () => {
        const definition = reportDefinitionSchema.parse({
            codename: 'LearnerProgress',
            title: { en: 'Learner progress', ru: 'Прогресс учащихся' },
            datasource: {
                kind: 'records.list',
                sectionCodename: 'ModuleProgress',
                query: {
                    sort: [{ field: 'CompletedAt', direction: 'desc' }]
                }
            },
            columns: [
                { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                { field: 'ProgressPercent', label: 'Progress', type: 'number' }
            ],
            filters: [{ field: 'ProgressStatus', operator: 'equals', value: 'Completed' }],
            aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
        })

        expect(definition.datasource).toMatchObject({
            kind: 'records.list',
            sectionCodename: 'ModuleProgress'
        })
    })

    it('models workspace-authored Learning Content projects and references generically', () => {
        expect(
            contentProjectSchema.parse({
                id: projectId,
                title: { en: 'Product onboarding', ru: 'Адаптация продукта' },
                description: { en: 'Workspace-authored onboarding content' },
                ownerUserId: userId,
                accessMode: 'workspace',
                sortOrder: 10
            })
        ).toMatchObject({
            id: projectId,
            accessMode: 'workspace'
        })

        expect(
            runtimeContentRefSchema.parse({
                objectCodename: 'LearningResources',
                recordId,
                displayType: 'page',
                title: { en: 'Welcome page' }
            })
        ).toMatchObject({
            objectCodename: 'LearningResources',
            recordId,
            displayType: 'page'
        })
    })

    it('keeps Learning Content sharing principals fail-closed until scoped predicates exist', () => {
        const target = {
            objectCodename: 'ContentProjects',
            recordId,
            displayType: 'page'
        }

        expect(
            contentAccessEntrySchema.parse({
                target,
                principalType: 'workspaceMember',
                principalId: userId,
                accessLevel: 'canEdit',
                invitedBy: userId,
                invitedAt: '2026-05-17T10:00:00.000Z'
            })
        ).toMatchObject({
            principalType: 'workspaceMember',
            accessLevel: 'canEdit'
        })

        expect(() =>
            contentAccessEntrySchema.parse({
                target,
                principalType: 'department',
                principalId: userId,
                accessLevel: 'canView'
            })
        ).toThrow(/Only workspace member and user principals are supported/)
    })

    it('validates Learning Content recents, stars, trash, policies, player presets, and columns', () => {
        const target = {
            objectCodename: 'Courses',
            recordId,
            displayType: 'course'
        }

        expect(contentStarSchema.parse({ target, userId, starredAt: '2026-05-17T11:00:00.000Z' })).toMatchObject({
            target,
            userId
        })
        expect(recentContentViewSchema.parse({ target, userId, viewedAt: '2026-05-17T11:05:00.000Z' })).toMatchObject({
            target,
            userId
        })
        expect(trashEntrySchema.parse({ target, deletedBy: userId, deletedAt: '2026-05-17T11:10:00.000Z' })).toMatchObject({
            restoreState: 'restorable'
        })
        expect(
            catalogPublicationPolicySchema.parse({
                visible: true,
                category: { en: 'Compliance', ru: 'Соответствие' },
                audience: 'All learners',
                selfEnrollmentMode: 'open'
            })
        ).toMatchObject({
            visible: true,
            selfEnrollmentMode: 'open'
        })
        expect(() => catalogPublicationPolicySchema.parse({ selfEnrollmentMode: 'approval' })).toThrow()
        expect(courseCompletionPolicySchema.parse({ navigationMode: 'sequential', completionCondition: 'selectedItems' })).toMatchObject({
            navigationMode: 'sequential',
            completionCondition: 'selectedItems',
            statusFormat: 'completeIncomplete'
        })
        expect(trackOrderPolicySchema.parse({ orderMode: 'byDays', restrictAfterDueDate: true })).toMatchObject({
            orderMode: 'byDays',
            restrictAfterDueDate: true
        })
        expect(playerPresetSchema.parse({ codename: 'default', title: 'Default player' })).toMatchObject({
            codename: 'default',
            showOutline: true,
            completeButtonMode: 'manual'
        })
        const columnPreset = learningContentColumnPresetSchema.parse({
            codename: 'authoring',
            title: { en: 'Authoring' },
            columns: [
                { field: 'Title', visible: true, flex: 1 },
                { field: 'UpdatedAt', visible: false, width: 160, sort: 'desc' }
            ]
        })

        expect(columnPreset).toMatchObject({
            codename: 'authoring'
        })
        expect(columnPreset.columns[0]).toMatchObject({ field: 'Title', visible: true })
        expect(columnPreset.columns[1]).toMatchObject({ field: 'UpdatedAt', visible: false, sort: 'desc' })
        expect(() =>
            learningContentColumnPresetSchema.parse({
                codename: 'authoring',
                title: { en: 'Authoring' },
                columns: [{ field: '', visible: true }]
            })
        ).toThrow()
    })

    it('sanitizes application-level Learning Content defaults without arbitrary settings', () => {
        expect(DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.defaultView).toBe('table')
        expect(DEFAULT_APPLICATION_LEARNING_CONTENT_SETTINGS.supportedResourceTypes).toContainEqual(
            expect.objectContaining({ resourceType: 'scorm', deferred: true })
        )

        expect(
            sanitizeApplicationLearningContentSettings({
                defaultView: 'cards',
                supportedResourceTypes: [
                    { resourceType: 'page', enabled: true, deferred: false },
                    { resourceType: 'url', enabled: true, deferred: false },
                    { resourceType: 'xapi', enabled: false, deferred: true }
                ],
                courseCompletionPolicy: {
                    navigationMode: 'sequential',
                    completionCondition: 'selectedItems',
                    statusFormat: 'passedFailed',
                    selectedItemIds: [recordId],
                    requiredOnly: true,
                    passingScorePercent: 80
                }
            })
        ).toMatchObject({
            defaultView: 'cards',
            courseCompletionPolicy: {
                navigationMode: 'sequential',
                completionCondition: 'selectedItems',
                statusFormat: 'passedFailed',
                passingScorePercent: 80
            },
            trackOrderPolicy: {
                orderMode: 'free'
            },
            playerPreset: {
                completeButtonMode: 'manual'
            },
            progressStore: {
                enabled: true,
                objectCodename: 'ContentProgress',
                progressPercentField: 'ProgressPercent'
            }
        })

        expect(() =>
            applicationLearningContentSettingsSchema.parse({
                supportedResourceTypes: [
                    { resourceType: 'page', enabled: true },
                    { resourceType: 'page', enabled: false }
                ]
            })
        ).toThrow(/unique/)

        expect(() =>
            applicationLearningContentSettingsSchema.parse({
                defaultView: 'kanban'
            })
        ).toThrow()
    })

    it('defines the product acceptance matrix as data, not UI component names', () => {
        expect(
            lmsAcceptanceMatrixSchema.parse([
                {
                    area: 'learnerHome',
                    gates: {
                        seeded: true,
                        visible: true,
                        actionable: true,
                        audited: false,
                        'workspace-isolated': true,
                        'covered-by-e2e': true
                    },
                    requiredEntities: ['LearnerHome', 'LearningResources'],
                    requiredReports: [],
                    requiredStatuses: ['NotStarted', 'InProgress', 'Completed'],
                    gaps: ['Dedicated learner-home audit is not required for the MVP gate']
                },
                {
                    area: 'contentProjects',
                    gates: {
                        seeded: true,
                        visible: true,
                        actionable: true,
                        audited: true,
                        'workspace-isolated': true,
                        'covered-by-e2e': true
                    },
                    requiredEntities: ['ContentProjects', 'ContentAccessEntries'],
                    evidence: ['Learning Content V2 workspace project authoring flow']
                },
                {
                    area: 'reports',
                    gates: {
                        seeded: true,
                        visible: true,
                        actionable: true,
                        audited: false,
                        'workspace-isolated': true,
                        'covered-by-e2e': true
                    },
                    requiredEntities: ['Reports'],
                    requiredReports: ['LearnerProgress'],
                    requiredStatuses: [],
                    evidence: ['runtime reports execute through the generic report runner'],
                    gaps: ['Scheduled report delivery is deferred']
                }
            ])
        ).toHaveLength(3)
    })
})
