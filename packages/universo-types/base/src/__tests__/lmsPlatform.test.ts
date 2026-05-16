import { describe, expect, it } from 'vitest'

import {
    applicationRolePolicySettingsSchema,
    collectUnsupportedActiveCapabilityRules,
    lmsAcceptanceMatrixSchema,
    reportDefinitionSchema,
    resourceDefinitionSchema,
    resourceSourceSchema,
    rolePolicyTemplateSchema,
    sanitizeApplicationRolePolicySettingsForSupportedScopes,
    sequencePolicySchema,
    workflowActionSchema
} from '../index'

describe('LMS platform primitive contracts', () => {
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
        ).toHaveLength(2)
    })
})
