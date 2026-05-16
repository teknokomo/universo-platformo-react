import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import ApplicationWidgetBehaviorEditorDialog from '../ApplicationWidgetBehaviorEditorDialog'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('@universo/template-mui', () => ({
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave
    }: {
        open: boolean
        title: string
        extraFields?: () => ReactNode
        onSave: () => void
    }) =>
        open ? (
            <div>
                <h1>{title}</h1>
                {extraFields?.()}
                <button type='button' onClick={onSave}>
                    Save
                </button>
            </div>
        ) : null
}))

describe('ApplicationWidgetBehaviorEditorDialog', () => {
    it('keeps detailsTable datasource settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    datasource: {
                        kind: 'records.list',
                        sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
                        query: { search: 'Draft' }
                    }
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Section ID'), {
            target: { value: '  017f22e2-79b0-7cc3-98c4-dc0c0c073990  ' }
        })
        fireEvent.change(screen.getByLabelText('Section codename'), { target: { value: '  ModuleProgress  ' } })
        fireEvent.change(screen.getByLabelText('Initial search'), { target: { value: '  posted  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'records.list',
                sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                sectionCodename: 'ModuleProgress',
                query: { search: 'posted' }
            }
        })
    })

    it('uses metadata-backed section options for records.list datasources', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{ datasource: { kind: 'records.list' } }}
                sectionOptions={[
                    {
                        id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
                        label: 'Module progress',
                        codename: 'ModuleProgress'
                    }
                ]}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getAllByRole('combobox')[1])
        fireEvent.click(screen.getByRole('option', { name: 'Module progress' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'records.list',
                sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
                sectionCodename: 'ModuleProgress'
            }
        })
    })

    it('does not show datasource settings for unrelated widgets', () => {
        render(<ApplicationWidgetBehaviorEditorDialog open widgetKey='menuWidget' config={{}} onSave={vi.fn()} onCancel={vi.fn()} />)

        expect(screen.queryByText('Datasource')).not.toBeInTheDocument()
    })

    it('exposes ledger datasource kinds for details tables without exposing metric datasources', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{ datasource: { kind: 'metric', metricKey: 'records.count' } }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getAllByRole('combobox')[0])

        expect(screen.getByRole('option', { name: 'Current runtime section' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Records list' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Ledger facts' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Ledger projection' })).toBeInTheDocument()
        expect(screen.queryByText('Metric')).not.toBeInTheDocument()
    })

    it('exposes only projection ledger datasource for chart widgets', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='pageViewsChart'
                config={{ datasource: { kind: 'current' } }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getAllByRole('combobox')[0])

        expect(screen.getByRole('option', { name: 'Current runtime section' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Records list' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Ledger facts' })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Ledger projection' })).toBeInTheDocument()
    })

    it('keeps chart datasource settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='pageViewsChart'
                config={{
                    datasource: {
                        kind: 'records.list',
                        sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
                        query: { search: 'Draft' }
                    },
                    xField: 'period',
                    maxRows: 12,
                    series: [{ field: 'started', label: 'Started' }]
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Section ID'), {
            target: { value: '  017f22e2-79b0-7cc3-98c4-dc0c0c073990  ' }
        })
        fireEvent.change(screen.getByLabelText('Section codename'), { target: { value: '  AssignmentSubmissions  ' } })
        fireEvent.change(screen.getByLabelText('Initial search'), { target: { value: '  cohort  ' } })
        fireEvent.change(screen.getByLabelText('X-axis field'), { target: { value: '  month  ' } })
        fireEvent.change(screen.getByLabelText('Series field'), { target: { value: '  completed  ' } })
        fireEvent.change(screen.getByLabelText('Series label'), { target: { value: '  Completed  ' } })
        fireEvent.change(screen.getByLabelText('Max rows'), { target: { value: '150' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'records.list',
                sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                sectionCodename: 'AssignmentSubmissions',
                query: { search: 'cohort' }
            },
            xField: 'month',
            maxRows: 100,
            series: [{ field: 'completed', label: 'Completed' }]
        })
    })

    it('keeps ledger projection chart datasource settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='sessionsChart'
                config={{
                    datasource: {
                        kind: 'ledger.projection',
                        ledgerCodename: 'ProgressLedger',
                        projectionCodename: 'ProgressByLearner'
                    },
                    xField: 'Learner',
                    maxRows: 12,
                    series: [{ field: 'ProgressDelta', label: 'Progress' }]
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Ledger ID'), {
            target: { value: '  017f22e2-79b0-7cc3-98c4-dc0c0c073995  ' }
        })
        fireEvent.change(screen.getByLabelText('Ledger codename'), { target: { value: '  ScoresLedger  ' } })
        fireEvent.change(screen.getByLabelText('Projection codename'), { target: { value: '  ScoresByModule  ' } })
        fireEvent.change(screen.getByLabelText('X-axis field'), { target: { value: '  Module  ' } })
        fireEvent.change(screen.getByLabelText('Series field'), { target: { value: '  Score  ' } })
        fireEvent.change(screen.getByLabelText('Series label'), { target: { value: '  Score  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'ledger.projection',
                ledgerId: '017f22e2-79b0-7cc3-98c4-dc0c0c073995',
                ledgerCodename: 'ScoresLedger',
                projectionCodename: 'ScoresByModule'
            },
            xField: 'Module',
            maxRows: 12,
            series: [{ field: 'Score', label: 'Score' }]
        })
    })

    it('previews incomplete datasource settings before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='sessionsChart'
                config={{
                    datasource: {
                        kind: 'ledger.projection'
                    }
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-datasource-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Ledger datasource needs a ledger reference or ledger codename.')).toBeInTheDocument()
        expect(screen.getByText('Ledger projection datasource needs a projection codename.')).toBeInTheDocument()
        expect(screen.getByText('Chart datasource needs an X-axis field.')).toBeInTheDocument()
        expect(screen.getByText('Chart datasource needs a series field.')).toBeInTheDocument()
    })

    it('keeps overviewCards multi-card metric settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='overviewCards'
                config={{
                    cards: [
                        {
                            title: 'Old courses',
                            value: '0',
                            trend: 'down',
                            datasource: {
                                kind: 'metric',
                                metricKey: 'records.count',
                                params: {
                                    sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
                                    search: 'Draft'
                                }
                            }
                        },
                        {
                            title: 'Unsupported',
                            datasource: {
                                kind: 'metric',
                                metricKey: 'unsupported.metric',
                                params: {
                                    sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
                                }
                            }
                        }
                    ]
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Card title 1'), { target: { value: '  Courses  ' } })
        fireEvent.change(screen.getByLabelText('Fallback value 1'), { target: { value: '  0  ' } })
        fireEvent.change(screen.getByLabelText('Interval 1'), { target: { value: '  All records  ' } })
        fireEvent.change(screen.getByLabelText('Metric section ID 1'), {
            target: { value: '  017f22e2-79b0-7cc3-98c4-dc0c0c073990  ' }
        })
        fireEvent.change(screen.getByLabelText('Metric section codename 1'), { target: { value: '  Students  ' } })
        fireEvent.change(screen.getByLabelText('Metric search 1'), { target: { value: '  safety  ' } })
        fireEvent.change(screen.getByLabelText('Card title 2'), { target: { value: '  Lessons  ' } })
        fireEvent.change(screen.getByLabelText('Metric section ID 2'), {
            target: { value: '  017f22e2-79b0-7cc3-98c4-dc0c0c073991  ' }
        })
        fireEvent.change(screen.getByLabelText('Metric section codename 2'), { target: { value: '  Modules  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            cards: [
                {
                    title: 'Courses',
                    value: '0',
                    interval: 'All records',
                    trend: 'down',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'records.count',
                        params: {
                            sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                            sectionCodename: 'Students',
                            search: 'safety'
                        }
                    }
                },
                {
                    title: 'Lessons',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'records.count',
                        params: {
                            sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            sectionCodename: 'Modules'
                        }
                    }
                }
            ]
        })
    })

    it('previews unsupported overview card metrics before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='overviewCards'
                config={{
                    cards: [
                        {
                            datasource: {
                                kind: 'metric',
                                metricKey: 'unsupported.metric'
                            }
                        }
                    ]
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-datasource-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Unsupported overview card metrics will be removed when saved.')).toBeInTheDocument()
    })

    it('keeps overviewCards report aggregation metric settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='overviewCards'
                config={{
                    cards: [
                        {
                            title: 'Average progress',
                            datasource: {
                                kind: 'metric',
                                metricKey: 'report.aggregation',
                                params: {
                                    reportCodename: 'OldReport',
                                    aggregationAlias: 'OldAverage'
                                }
                            }
                        }
                    ]
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Report codename 1'), { target: { value: '  LearnerProgress  ' } })
        fireEvent.change(screen.getByLabelText('Aggregation alias 1'), { target: { value: '  AverageProgress  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            cards: [
                {
                    title: 'Average progress',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'report.aggregation',
                        params: {
                            reportCodename: 'LearnerProgress',
                            aggregationAlias: 'AverageProgress'
                        }
                    }
                }
            ]
        })
    })

    it('keeps sequence policy settings in the detailsTable behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'CourseModules'
                    },
                    sequencePolicy: {
                        mode: 'sequential',
                        orderFieldCodename: 'SortOrder',
                        retryLimit: 1,
                        maxAttempts: 2,
                        completion: [{ kind: 'scoreAtLeast', field: 'ScorePercent', value: 75 }]
                    }
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Order field codename'), { target: { value: '  StepOrder  ' } })
        fireEvent.change(screen.getByLabelText('Retry limit'), { target: { value: '  5  ' } })
        fireEvent.change(screen.getByLabelText('Max attempts'), { target: { value: '101' } })
        fireEvent.change(screen.getByLabelText('Condition field 1'), { target: { value: '  BestScore  ' } })
        fireEvent.change(screen.getByLabelText('Condition value 1'), { target: { value: '  80  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'records.list',
                sectionCodename: 'CourseModules'
            },
            sequencePolicy: {
                mode: 'sequential',
                orderFieldCodename: 'StepOrder',
                retryLimit: 5,
                maxAttempts: 100,
                completion: [{ kind: 'scoreAtLeast', field: 'BestScore', value: 80 }]
            }
        })
    })

    it('previews incomplete sequence policy settings before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    sequencePolicy: {
                        mode: 'scheduled',
                        completion: []
                    }
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-sequence-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Scheduled mode needs at least one availability or due-date field.')).toBeInTheDocument()
        expect(screen.getByText('Sequence policy has no completion conditions yet.')).toBeInTheDocument()
    })

    it('keeps report definition settings in the detailsTable behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'ModuleProgress'
                    },
                    reportDefinition: {
                        codename: 'OldReport',
                        title: 'Old report',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'ModuleProgress'
                        },
                        columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }]
                    }
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Report codename'), { target: { value: '  LearnerProgress  ' } })
        fireEvent.change(screen.getByLabelText('Report title'), { target: { value: '  Learner progress  ' } })
        fireEvent.change(screen.getByLabelText('Report description'), { target: { value: '  Progress report  ' } })
        fireEvent.change(screen.getByLabelText('Column field 1'), { target: { value: '  ScorePercent  ' } })
        fireEvent.change(screen.getByLabelText('Column label 1'), { target: { value: '  Score  ' } })
        fireEvent.change(screen.getByLabelText('Filter field 1'), { target: { value: '  Status  ' } })
        fireEvent.change(screen.getByLabelText('Filter value 1'), { target: { value: '  completed  ' } })
        fireEvent.change(screen.getByLabelText('Aggregation field 1'), { target: { value: '  ScorePercent  ' } })
        fireEvent.change(screen.getByLabelText('Aggregation alias 1'), { target: { value: '  AverageScore  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            datasource: {
                kind: 'records.list',
                sectionCodename: 'ModuleProgress'
            },
            reportDefinition: {
                codename: 'LearnerProgress',
                title: 'Learner progress',
                description: 'Progress report',
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress'
                },
                columns: [{ field: 'ScorePercent', label: 'Score', type: 'number' }],
                filters: [{ field: 'Status', operator: 'equals', value: 'completed' }],
                aggregations: [{ field: 'ScorePercent', function: 'count', alias: 'AverageScore' }]
            }
        })
    })

    it('previews incomplete report definition settings before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    reportDefinition: {
                        codename: '',
                        title: '',
                        columns: []
                    }
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-report-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Report definition needs a codename.')).toBeInTheDocument()
        expect(screen.getByText('Report definition needs a valid datasource.')).toBeInTheDocument()
        expect(screen.getByText('Report definition needs at least one output column.')).toBeInTheDocument()
    })

    it('keeps workflow action settings in the detailsTable behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    workflowActions: [
                        {
                            codename: 'OldAction',
                            title: 'Old action',
                            from: ['Draft'],
                            to: 'Pending',
                            requiredCapabilities: ['workflow.execute']
                        }
                    ]
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Action codename 1'), { target: { value: '  AcceptSubmission  ' } })
        fireEvent.change(screen.getByLabelText('Action title 1'), { target: { value: '  Accept submission  ' } })
        fireEvent.change(screen.getByLabelText('Source statuses 1'), { target: { value: '  PendingReview, Escalated  ' } })
        fireEvent.change(screen.getByLabelText('Target status 1'), { target: { value: '  Accepted  ' } })
        fireEvent.change(screen.getByLabelText('Required capabilities 1'), { target: { value: '  workflow.execute, reports.read  ' } })
        fireEvent.change(screen.getByLabelText('Status field codename 1'), { target: { value: '  ReviewStatus  ' } })
        fireEvent.change(screen.getByLabelText('Status column name 1'), { target: { value: '  review_status  ' } })
        fireEvent.change(screen.getByLabelText('Script codename 1'), { target: { value: '  AssignmentReviewScript  ' } })
        fireEvent.mouseDown(screen.getByLabelText('Posting command 1'))
        fireEvent.click(screen.getByRole('option', { name: 'Post' }))
        fireEvent.mouseDown(screen.getByLabelText('Confirmation required 1'))
        fireEvent.click(screen.getByRole('option', { name: 'Yes' }))
        fireEvent.change(screen.getByLabelText('Confirmation title 1'), { target: { value: '  Accept submission?  ' } })
        fireEvent.change(screen.getByLabelText('Confirmation message 1'), { target: { value: '  This updates the review status.  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            workflowActions: [
                {
                    codename: 'AcceptSubmission',
                    title: 'Accept submission',
                    from: ['PendingReview', 'Escalated'],
                    to: 'Accepted',
                    statusFieldCodename: 'ReviewStatus',
                    statusColumnName: 'review_status',
                    requiredCapabilities: ['workflow.execute', 'reports.read'],
                    confirmation: {
                        required: true,
                        title: 'Accept submission?',
                        message: 'This updates the review status.'
                    },
                    scriptCodename: 'AssignmentReviewScript',
                    postingCommand: 'post'
                }
            ]
        })
    })

    it('previews incomplete workflow action settings before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='detailsTable'
                config={{
                    workflowActions: [
                        {
                            codename: '',
                            title: '',
                            from: [],
                            to: '',
                            requiredCapabilities: []
                        }
                    ]
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-workflow-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Workflow action 1 needs a codename.')).toBeInTheDocument()
        expect(screen.getByText('Workflow action 1 needs at least one source status.')).toBeInTheDocument()
        expect(screen.getByText('Workflow action 1 needs at least one required capability.')).toBeInTheDocument()
    })

    it('keeps resource preview settings in the shared behavior editor', () => {
        const onSave = vi.fn()
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='resourcePreview'
                config={{
                    title: 'Old resource',
                    description: 'Old description',
                    source: {
                        type: 'url',
                        url: 'https://example.com/old',
                        launchMode: 'newTab'
                    }
                }}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.change(screen.getByLabelText('Display title'), { target: { value: '  Intro video  ' } })
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  Watch before the course.  ' } })
        fireEvent.mouseDown(screen.getByLabelText('Resource type'))
        fireEvent.click(screen.getByRole('option', { name: 'Video' }))
        fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://cdn.example.com/intro.mp4  ' } })
        fireEvent.change(screen.getByLabelText('MIME type'), { target: { value: '  video/mp4  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            title: 'Intro video',
            description: 'Watch before the course.',
            source: {
                type: 'video',
                url: 'https://cdn.example.com/intro.mp4',
                mimeType: 'video/mp4',
                launchMode: 'newTab'
            }
        })
    })

    it('previews invalid resource source settings before save', () => {
        render(
            <ApplicationWidgetBehaviorEditorDialog
                open
                widgetKey='resourcePreview'
                config={{
                    source: {
                        type: 'embed',
                        url: 'https://evil.example.com/embed',
                        launchMode: 'inline'
                    }
                }}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByTestId('application-widget-resource-validation-warning')).toBeInTheDocument()
        expect(screen.getByText('Invalid resource source will be removed when saved.')).toBeInTheDocument()
    })
})
