import { reportDefinitionSchema } from '@universo-react/types'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { buildTemplateSeedComponentMap, resolveTemplateSeedElementData } from '../../domains/templates/services/templateSeedElements'

const expectedReportCodenames = [
    'LearningContentSummary',
    'LearnerProgress',
    'CourseProgress',
    'CourseBuilderOutline',
    'TrackBuilderOutline',
    'Leaderboard',
    'Achievements',
    'QuizAttemptResults'
]

describe('LMS saved report seed', () => {
    it('stores runtime-schema-valid report definitions as stable Reports entity seed elements', () => {
        const reportElements = lmsTemplate.seed.elements?.Reports ?? []
        const reportsEntity = lmsTemplate.seed.entities?.find((entity) => entity.codename === 'Reports')
        const reportTypeComponent = reportsEntity?.components?.find((component) => component.codename === 'ReportType')
        const reportTypeOptions = lmsTemplate.seed.optionValues?.ReportType ?? []

        expect(reportElements.map((element) => element.codename)).toEqual(expectedReportCodenames)
        expect(new Set(reportElements.map((element) => element.sortOrder)).size).toBe(reportElements.length)
        expect(reportTypeComponent).toMatchObject({
            dataType: 'REF',
            targetEntityCodename: 'ReportType',
            targetEntityKind: 'enumeration'
        })
        expect(reportTypeOptions).toEqual(expect.arrayContaining([expect.objectContaining({ codename: 'Progress' })]))

        for (const element of reportElements) {
            const definition = reportDefinitionSchema.parse(element.data.Definition)

            expect(element.codename).toBe(definition.codename)
            expect(element.data.Name).toEqual(definition.title)
            expect(element.data.ReportType).toBe('Progress')
            expect(element.data.Filters).toEqual(definition.filters)
            expect(element.sortOrder).toBeGreaterThan(0)

            if (element.codename === 'LearnerProgress') {
                expect(definition.datasource).toMatchObject({ kind: 'records.list', sectionCodename: 'ContentProgress' })
                expect(definition.aggregations).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' })
                    ])
                )
                expect(definition.columns).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ field: 'ProgressStudentId', type: 'text' }),
                        expect.objectContaining({ field: 'ProgressPercent', type: 'number' }),
                        expect.objectContaining({ field: 'ProgressStatus', type: 'status' })
                    ])
                )
            }

            if (element.codename === 'QuizAttemptResults') {
                expect(definition.datasource).toMatchObject({
                    kind: 'records.list',
                    sectionCodename: 'QuizAttempts',
                    query: { sort: [{ field: 'SubmittedAt', direction: 'desc' }] }
                })
                expect(definition.filters).toEqual([{ field: 'SubmittedAt', operator: 'isNotEmpty' }])
                expect(definition.columns).toEqual([
                    { field: 'QuizId', label: expect.any(Object), type: 'text' },
                    { field: 'StudentId', label: expect.any(Object), type: 'text' },
                    { field: 'StartedAt', label: expect.any(Object), type: 'date' },
                    { field: 'SubmittedAt', label: expect.any(Object), type: 'date' },
                    { field: 'Score', label: expect.any(Object), type: 'number' },
                    { field: 'Passed', label: expect.any(Object), type: 'boolean' },
                    { field: 'TotalQuestions', label: expect.any(Object), type: 'number' },
                    { field: 'Status', label: expect.any(Object), type: 'status' },
                    { field: 'FinishedReason', label: expect.any(Object), type: 'status' }
                ])
                expect(definition.columns.map(({ label }) => label)).toEqual([
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) }),
                    expect.objectContaining({ locales: expect.objectContaining({ en: expect.any(Object), ru: expect.any(Object) }) })
                ])

                const quizEntity = lmsTemplate.seed.entities?.find((entity) => entity.codename === 'Quizzes')
                const studentEntity = lmsTemplate.seed.entities?.find((entity) => entity.codename === 'Students')
                expect(quizEntity?.components.find((component) => component.codename === 'Title')?.isDisplayComponent).toBe(true)
                expect(studentEntity?.components.find((component) => component.codename === 'DisplayName')?.isDisplayComponent).toBe(true)
                expect(studentEntity?.components.map((component) => component.codename)).toEqual(
                    expect.arrayContaining(['FirstName', 'LastName'])
                )
            }
        }

        const placedReportCodenames = Object.values(lmsTemplate.seed.layoutZoneWidgets)
            .flat()
            .map((placement) => placement.rendererConfig?.reportCodename)
            .filter((codename): codename is string => typeof codename === 'string')
        expect(new Set(placedReportCodenames).size).toBeGreaterThan(0)
        expect(placedReportCodenames).toEqual(expect.arrayContaining(['LearningContentSummary', 'LearnerProgress', 'QuizAttemptResults']))
        expect(reportElements.map(({ codename }) => codename)).toEqual(expect.arrayContaining(placedReportCodenames))
    })

    it('resolves the seeded ReportType codename through the standard enumeration reference map', () => {
        const entities = lmsTemplate.seed.entities ?? []
        const reportComponentMap = buildTemplateSeedComponentMap(entities).get('Reports')
        const reportElement = lmsTemplate.seed.elements?.Reports?.[0]

        expect(reportComponentMap).toBeDefined()
        expect(reportElement).toBeDefined()

        const resolvedData = resolveTemplateSeedElementData(
            reportElement!.data,
            reportComponentMap!,
            new Map([['ReportType:Progress', '019ccefc-2f7b-7b36-82f4-85cdb1312268']]),
            new Map()
        )

        expect(resolvedData.ReportType).toBe('019ccefc-2f7b-7b36-82f4-85cdb1312268')
    })
})
