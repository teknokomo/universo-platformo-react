import { describe, expect, it } from 'vitest'

import {
    applicationRolePolicySettingsSchema,
    lmsAcceptanceMatrixSchema,
    reportDefinitionSchema,
    resourceDefinitionSchema,
    resourceSourceSchema,
    rolePolicyTemplateSchema,
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

    it('validates Catalog-backed report definitions over runtime datasource descriptors', () => {
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
                    requiredEntities: ['LearnerHome', 'LearningResources'],
                    requiredReports: [],
                    requiredStatuses: ['NotStarted', 'InProgress', 'Completed']
                },
                {
                    area: 'reports',
                    requiredEntities: ['Reports'],
                    requiredReports: ['LearnerProgress'],
                    requiredStatuses: []
                }
            ])
        ).toHaveLength(2)
    })
})
