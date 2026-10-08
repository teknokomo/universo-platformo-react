import { reportDefinitionSchema, type TemplateSeedElement } from '@universo-react/types'
import { vlc } from './basic.template'

const reportDefinitions = [
    reportDefinitionSchema.parse({
        codename: 'LearningContentSummary',
        title: vlc('Learning Content summary', 'Сводка учебного контента'),
        datasource: {
            kind: 'records.union',
            projectedFields: ['Instructor'],
            targets: [
                {
                    sectionCodename: 'LearningResources',
                    displayType: 'resource',
                    titleField: 'Title',
                    statusField: 'PublicationStatus',
                    projectField: 'ProjectId'
                },
                {
                    sectionCodename: 'Courses',
                    displayType: 'course',
                    titleField: 'Title',
                    statusField: 'Status',
                    projectField: 'ProjectId'
                },
                {
                    sectionCodename: 'LearningTracks',
                    displayType: 'track',
                    titleField: 'Title',
                    statusField: 'Status',
                    projectField: 'ProjectId'
                }
            ],
            query: {
                lifecycleState: 'active',
                libraryView: 'all',
                sort: [{ field: 'title', direction: 'asc' }]
            }
        },
        columns: [
            { field: 'type', label: vlc('Type', 'Тип'), type: 'text' },
            { field: 'title', label: vlc('Title', 'Заголовок'), type: 'text' },
            { field: 'status', label: vlc('Status', 'Статус'), type: 'status' },
            { field: 'Instructor', label: vlc('Instructor', 'Преподаватель'), type: 'text' },
            { field: 'project', label: vlc('Project', 'Проект'), type: 'text' }
        ],
        filters: [],
        aggregations: []
    }),
    reportDefinitionSchema.parse({
        codename: 'LearnerProgress',
        title: vlc('Learner progress', 'Прогресс учащихся'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'ContentProgress',
            query: { sort: [{ field: 'CompletedAt', direction: 'desc' }] }
        },
        columns: [
            { field: 'ProgressStudentId', label: vlc('Learner', 'Учащийся'), type: 'text' },
            { field: 'ProgressPercent', label: vlc('Progress', 'Прогресс'), type: 'number' },
            { field: 'ProgressStatus', label: vlc('Status', 'Статус'), type: 'status' }
        ],
        filters: [],
        aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
    }),
    reportDefinitionSchema.parse({
        codename: 'CourseProgress',
        title: vlc('Course progress', 'Прогресс курсов'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'Enrollments',
            query: { sort: [{ field: 'EnrolledAt', direction: 'desc' }] }
        },
        columns: [
            { field: 'EnrollmentStudentId', label: vlc('Learner', 'Учащийся'), type: 'text' },
            { field: 'TargetId', label: vlc('Learning Item', 'Учебный объект'), type: 'text' },
            { field: 'Score', label: vlc('Score', 'Балл'), type: 'number' }
        ],
        filters: [],
        aggregations: [{ field: 'Score', function: 'avg', alias: 'AverageScore' }]
    }),
    reportDefinitionSchema.parse({
        codename: 'CourseBuilderOutline',
        title: vlc('Course outline report', 'Отчет по структуре курса'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'CourseItems',
            query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
        },
        columns: [
            { field: 'Title', label: vlc('Title', 'Название'), type: 'text' },
            { field: 'ItemType', label: vlc('Type', 'Тип'), type: 'text' },
            { field: 'IsRequired', label: vlc('Required', 'Обязательный'), type: 'boolean' },
            { field: 'CompletionWeight', label: vlc('Weight', 'Вес'), type: 'number' }
        ],
        filters: [],
        aggregations: []
    }),
    reportDefinitionSchema.parse({
        codename: 'TrackBuilderOutline',
        title: vlc('Track outline report', 'Отчет по структуре трека'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'TrackSteps',
            query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
        },
        columns: [
            { field: 'Title', label: vlc('Title', 'Название'), type: 'text' },
            { field: 'CourseId', label: vlc('Course', 'Курс'), type: 'text' },
            { field: 'EnrollmentOffsetDays', label: vlc('Start offset', 'Смещение старта'), type: 'number' },
            { field: 'DueOffsetDays', label: vlc('Due offset', 'Смещение срока'), type: 'number' }
        ],
        filters: [],
        aggregations: []
    }),
    reportDefinitionSchema.parse({
        codename: 'Leaderboard',
        title: vlc('Leaderboard', 'Рейтинг'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'LeaderboardSnapshots',
            query: { sort: [{ field: 'Rank', direction: 'asc' }] }
        },
        columns: [
            { field: 'StudentId', label: vlc('Learner', 'Учащийся'), type: 'text' },
            { field: 'Period', label: vlc('Period', 'Период'), type: 'text' },
            { field: 'TotalPoints', label: vlc('Points', 'Баллы'), type: 'number' },
            { field: 'Rank', label: vlc('Rank', 'Место'), type: 'number' },
            { field: 'BadgeCount', label: vlc('Badges', 'Бейджи'), type: 'number' }
        ],
        filters: [],
        aggregations: [{ field: 'TotalPoints', function: 'sum', alias: 'TotalAwardedPoints' }]
    }),
    reportDefinitionSchema.parse({
        codename: 'Achievements',
        title: vlc('Achievements', 'Достижения'),
        datasource: {
            kind: 'records.list',
            sectionCodename: 'BadgeIssues',
            query: { sort: [{ field: 'IssuedAt', direction: 'desc' }] }
        },
        columns: [
            { field: 'StudentId', label: vlc('Learner', 'Учащийся'), type: 'text' },
            { field: 'BadgeId', label: vlc('Badge', 'Бейдж'), type: 'text' },
            { field: 'Status', label: vlc('Status', 'Статус'), type: 'status' }
        ],
        filters: [],
        aggregations: []
    })
] as const

const savedFilterName = vlc('All active learners', 'Все активные учащиеся')

export const lmsSavedReportElements: TemplateSeedElement[] = reportDefinitions.map((definition, index) => ({
    codename: definition.codename,
    sortOrder: index + 1,
    data: {
        Name: definition.title,
        ReportType: 'Progress',
        Filters: definition.filters,
        Definition: definition,
        SavedFilters: [{ name: savedFilterName, filters: definition.filters }]
    }
}))
