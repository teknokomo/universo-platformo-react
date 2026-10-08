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
    'Achievements'
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
        }

        const placedReportCodenames = Object.values(lmsTemplate.seed.layoutZoneWidgets)
            .flat()
            .map((placement) => placement.rendererConfig?.reportCodename)
            .filter((codename): codename is string => typeof codename === 'string')
        expect(new Set(placedReportCodenames).size).toBeGreaterThan(0)
        expect(placedReportCodenames).toEqual(expect.arrayContaining(['LearningContentSummary', 'LearnerProgress']))
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
