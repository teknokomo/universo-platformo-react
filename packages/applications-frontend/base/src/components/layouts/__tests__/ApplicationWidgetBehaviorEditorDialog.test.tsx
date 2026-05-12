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
})
