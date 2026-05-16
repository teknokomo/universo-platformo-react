import { useEffect, useState } from 'react'
import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { EntityFormDialog } from '@universo/template-mui'
import {
    RESOURCE_LAUNCH_MODES,
    RESOURCE_TYPES,
    SEQUENCE_POLICY_MODES,
    WORKFLOW_POSTING_COMMANDS,
    isDeferredResourceSource,
    resourceSourceSchema,
    reportDefinitionSchema,
    sequencePolicySchema,
    workflowActionSchema,
    type CompletionCondition,
    type ReportAggregation,
    type ReportColumn,
    type ReportDefinition,
    type ReportFilter,
    type ResourceLaunchMode,
    type ResourceSource,
    type ResourceType,
    type RuntimeDatasourceDescriptor,
    type SequencePolicy,
    type SequencePolicyMode,
    type WorkflowAction,
    type WorkflowPostingCommand
} from '@universo/types'
import { useTranslation } from 'react-i18next'

import ApplicationLayoutSharedBehaviorFields from './ApplicationLayoutSharedBehaviorFields'

const normalizeConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}

type Props = {
    open: boolean
    widgetKey?: string | null
    config?: Record<string, unknown> | null
    sectionOptions?: DatasourceSectionOption[]
    onSave: (config: Record<string, unknown>) => void
    onCancel: () => void
}

type EditableDatasourceKind = 'current' | 'records.list' | 'ledger.facts' | 'ledger.projection'
type DatasourceSectionOption = {
    id: string
    label: string
    codename?: string | null
}
type EditableResourceSourcePatch = Partial<ResourceSource> & { type?: ResourceType; launchMode?: ResourceLaunchMode }
type CompletionConditionKind = CompletionCondition['kind']
type ReportColumnType = ReportColumn['type']
type ReportFilterOperator = ReportFilter['operator']
type ReportAggregationFunction = ReportAggregation['function']
type OverviewCardMetricKey = 'records.count' | 'report.aggregation'
type EditableWorkflowAction = Omit<Partial<WorkflowAction>, 'from' | 'requiredCapabilities'> & {
    postingCommand?: WorkflowPostingCommand | ''
    from?: string[] | string
    requiredCapabilities?: string[] | string
    confirmation?: Partial<WorkflowAction['confirmation']>
}
type EditableCompletionCondition = Partial<CompletionCondition> & { kind?: CompletionConditionKind }
type EditableReportColumn = Partial<ReportColumn> & { type?: ReportColumnType }
type EditableReportFilter = Partial<ReportFilter> & { operator?: ReportFilterOperator }
type EditableReportAggregation = Partial<ReportAggregation> & { function?: ReportAggregationFunction }
type EditableReportDefinition = Omit<Partial<ReportDefinition>, 'columns' | 'filters' | 'aggregations'> & {
    columns?: EditableReportColumn[]
    filters?: EditableReportFilter[]
    aggregations?: EditableReportAggregation[]
}
type EditableSequencePolicy = Omit<Partial<SequencePolicy>, 'completion' | 'maxAttempts' | 'retryLimit'> & {
    mode?: SequencePolicyMode
    maxAttempts?: unknown
    retryLimit?: unknown
    completion?: EditableCompletionCondition[]
}

const DETAILS_TABLE_DATASOURCE_KIND_OPTIONS: Array<{ value: EditableDatasourceKind; labelKey: string; fallback: string }> = [
    { value: 'current', labelKey: 'layouts.datasource.currentSection', fallback: 'Current runtime section' },
    { value: 'records.list', labelKey: 'layouts.datasource.recordsList', fallback: 'Records list' },
    { value: 'ledger.facts', labelKey: 'layouts.datasource.ledgerFacts', fallback: 'Ledger facts' },
    { value: 'ledger.projection', labelKey: 'layouts.datasource.ledgerProjection', fallback: 'Ledger projection' }
]
const CHART_DATASOURCE_KIND_OPTIONS = DETAILS_TABLE_DATASOURCE_KIND_OPTIONS.filter((option) => option.value !== 'ledger.facts')

const CHART_WIDGET_KEYS = new Set(['sessionsChart', 'pageViewsChart'])
const OVERVIEW_CARD_EDITOR_SLOTS = 4
const SEQUENCE_COMPLETION_EDITOR_SLOTS = 3
const REPORT_COLUMN_EDITOR_SLOTS = 4
const REPORT_FILTER_EDITOR_SLOTS = 2
const REPORT_AGGREGATION_EDITOR_SLOTS = 2
const WORKFLOW_ACTION_EDITOR_SLOTS = 3
const TREND_OPTIONS = ['up', 'down', 'neutral'] as const
const OVERVIEW_CARD_METRIC_KEY_OPTIONS: Array<{ value: OverviewCardMetricKey; labelKey: string; fallback: string }> = [
    { value: 'records.count', labelKey: 'layouts.datasource.cardMetricRecordsCount', fallback: 'Records count' },
    { value: 'report.aggregation', labelKey: 'layouts.datasource.cardMetricReportAggregation', fallback: 'Report aggregation' }
]
const REPORT_COLUMN_TYPE_OPTIONS: ReportColumnType[] = ['text', 'number', 'date', 'status', 'boolean']
const REPORT_FILTER_OPERATOR_OPTIONS: ReportFilterOperator[] = [
    'contains',
    'equals',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual'
]
const REPORT_AGGREGATION_FUNCTION_OPTIONS: ReportAggregationFunction[] = ['count', 'sum', 'avg', 'min', 'max']
const WORKFLOW_POSTING_COMMAND_OPTIONS: Array<WorkflowPostingCommand | ''> = ['', ...WORKFLOW_POSTING_COMMANDS]
const COMPLETION_CONDITION_KIND_OPTIONS: CompletionConditionKind[] = [
    'manual',
    'progressPercent',
    'scoreAtLeast',
    'allStepsCompleted',
    'attendanceMarked',
    'certificateIssued'
]
const URL_RESOURCE_TYPES = new Set<ResourceType>(['url', 'video', 'audio', 'document', 'embed'])
const MIME_RESOURCE_TYPES = new Set<ResourceType>(['video', 'audio', 'document'])
const STORAGE_RESOURCE_TYPES = new Set<ResourceType>(['document', 'file', 'scorm'])
const SEQUENCE_MODE_FALLBACK_LABELS: Record<SequencePolicyMode, string> = {
    free: 'Free',
    sequential: 'Sequential',
    scheduled: 'Scheduled',
    prerequisite: 'Prerequisite'
}
const COMPLETION_CONDITION_KIND_FALLBACK_LABELS: Record<CompletionConditionKind, string> = {
    manual: 'Manual field',
    progressPercent: 'Progress percent',
    scoreAtLeast: 'Score at least',
    allStepsCompleted: 'All steps completed',
    attendanceMarked: 'Attendance marked',
    certificateIssued: 'Certificate issued'
}
const REPORT_COLUMN_TYPE_FALLBACK_LABELS: Record<ReportColumnType, string> = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    status: 'Status',
    boolean: 'Boolean'
}
const REPORT_FILTER_OPERATOR_FALLBACK_LABELS: Record<ReportFilterOperator, string> = {
    contains: 'Contains',
    equals: 'Equals',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
    greaterThan: 'Greater than',
    greaterThanOrEqual: 'Greater than or equal',
    lessThan: 'Less than',
    lessThanOrEqual: 'Less than or equal'
}
const REPORT_AGGREGATION_FUNCTION_FALLBACK_LABELS: Record<ReportAggregationFunction, string> = {
    count: 'Count',
    sum: 'Sum',
    avg: 'Average',
    min: 'Minimum',
    max: 'Maximum'
}
const WORKFLOW_POSTING_COMMAND_FALLBACK_LABELS: Record<WorkflowPostingCommand | '', string> = {
    '': 'No posting command',
    post: 'Post',
    unpost: 'Unpost',
    void: 'Void'
}
const RESOURCE_TYPE_FALLBACK_LABELS: Record<ResourceType, string> = {
    page: 'Page',
    url: 'URL',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    scorm: 'SCORM placeholder',
    embed: 'Embed',
    file: 'File placeholder'
}
const RESOURCE_LAUNCH_MODE_FALLBACK_LABELS: Record<ResourceLaunchMode, string> = {
    inline: 'Inline',
    newTab: 'New tab',
    download: 'Download'
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readDatasource = (config: Record<string, unknown>): Partial<RuntimeDatasourceDescriptor> | null => {
    const value = config.datasource
    return isRecord(value) ? (value as Partial<RuntimeDatasourceDescriptor>) : null
}

const readResourceSource = (config: Record<string, unknown>): EditableResourceSourcePatch | null => {
    const value = config.source
    return isRecord(value) ? (value as EditableResourceSourcePatch) : null
}

const readSequencePolicy = (config: Record<string, unknown>): EditableSequencePolicy | null => {
    const value = config.sequencePolicy
    return isRecord(value) ? (value as EditableSequencePolicy) : null
}

const readReportDefinition = (config: Record<string, unknown>): EditableReportDefinition | null => {
    const value = config.reportDefinition
    return isRecord(value) ? (value as EditableReportDefinition) : null
}

const readWorkflowActions = (config: Record<string, unknown>): EditableWorkflowAction[] => {
    const value = config.workflowActions
    return Array.isArray(value) ? value.map((item) => (isRecord(item) ? (item as EditableWorkflowAction) : {})) : []
}

const normalizeDatasourceText = (value: unknown): string => (typeof value === 'string' ? value : '')
const normalizeDatasourceScalarText = (value: unknown): string =>
    typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
const normalizeEditorScalarText = (value: unknown): string =>
    typeof value === 'boolean'
        ? String(value)
        : typeof value === 'string'
        ? value
        : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : ''

const normalizeBoundedInt = (value: unknown, min: number, max: number): number | undefined => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    if (!Number.isInteger(parsed) || parsed < min) return undefined
    return Math.min(parsed, max)
}

const normalizePositiveInt = (value: unknown): number | undefined => {
    return normalizeBoundedInt(value, 1, 100)
}

const setDraftDatasource = (draft: Record<string, unknown>, next: Partial<RuntimeDatasourceDescriptor> | null): Record<string, unknown> => {
    if (!next || next.kind === undefined) {
        const { datasource: _datasource, ...rest } = draft
        return rest
    }

    return {
        ...draft,
        datasource: next
    }
}

const setDraftResourceSource = (draft: Record<string, unknown>, next: EditableResourceSourcePatch | null): Record<string, unknown> => {
    if (!next) {
        const { source: _source, ...rest } = draft
        return rest
    }

    return {
        ...draft,
        source: next
    }
}

const setDraftSequencePolicy = (draft: Record<string, unknown>, next: EditableSequencePolicy | null): Record<string, unknown> => {
    if (!next) {
        const { sequencePolicy: _sequencePolicy, ...rest } = draft
        return rest
    }

    return {
        ...draft,
        sequencePolicy: next
    }
}

const setDraftReportDefinition = (draft: Record<string, unknown>, next: EditableReportDefinition | null): Record<string, unknown> => {
    if (!next) {
        const { reportDefinition: _reportDefinition, ...rest } = draft
        return rest
    }

    return {
        ...draft,
        reportDefinition: next
    }
}

const setDraftWorkflowActions = (draft: Record<string, unknown>, next: EditableWorkflowAction[]): Record<string, unknown> => {
    if (next.length === 0) {
        const { workflowActions: _workflowActions, ...rest } = draft
        return rest
    }

    return {
        ...draft,
        workflowActions: next
    }
}

const normalizeLocalizedWidgetText = (value: unknown): unknown => {
    if (typeof value === 'string') return value.trim() || undefined
    return isRecord(value) ? value : undefined
}

const normalizeResourcePreviewConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const source = readResourceSource(config)
    const title = normalizeLocalizedWidgetText(config.title)
    const description = normalizeLocalizedWidgetText(config.description)
    const next: Record<string, unknown> = {
        ...(title ? { title } : {}),
        ...(description ? { description } : {})
    }

    if (isRecord(config.sharedBehavior)) {
        next.sharedBehavior = config.sharedBehavior
    }

    if (!source?.type || !RESOURCE_TYPES.includes(source.type)) {
        return next
    }

    const candidate: EditableResourceSourcePatch = {
        type: source.type,
        launchMode: RESOURCE_LAUNCH_MODES.includes(source.launchMode as ResourceLaunchMode) ? source.launchMode : 'inline'
    }
    const url = normalizeDatasourceText(source.url).trim()
    const pageCodename = normalizeDatasourceText(source.pageCodename).trim()
    const storageKey = normalizeDatasourceText(source.storageKey).trim()
    const mimeType = normalizeDatasourceText(source.mimeType).trim()

    if (source.type === 'page' && pageCodename) {
        candidate.pageCodename = pageCodename
    }
    if (URL_RESOURCE_TYPES.has(source.type) && url) {
        candidate.url = url
    }
    if (STORAGE_RESOURCE_TYPES.has(source.type) && storageKey) {
        candidate.storageKey = storageKey
    }
    if (source.type === 'scorm' && isRecord(source.packageDescriptor)) {
        candidate.packageDescriptor = source.packageDescriptor
    }
    if (MIME_RESOURCE_TYPES.has(source.type) && mimeType) {
        candidate.mimeType = mimeType
    }

    const parsed = resourceSourceSchema.safeParse(candidate)
    if (parsed.success) {
        next.source = parsed.data
    }

    return next
}

const normalizeCompletionConditionValue = (kind: CompletionConditionKind, value: unknown): unknown | undefined => {
    if (kind === 'progressPercent' || kind === 'scoreAtLeast') {
        const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
        return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 100)) : undefined
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '') return undefined
        if (trimmed === 'true') return true
        if (trimmed === 'false') return false
        return trimmed
    }

    return value
}

const normalizeSequencePolicyConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const sequencePolicy = readSequencePolicy(config)
    if (!sequencePolicy) return config

    const mode = SEQUENCE_POLICY_MODES.includes(sequencePolicy.mode as SequencePolicyMode) ? sequencePolicy.mode : 'free'
    const completion = Array.isArray(sequencePolicy.completion)
        ? sequencePolicy.completion.slice(0, 16).flatMap((condition): CompletionCondition[] => {
              if (!condition?.kind || !COMPLETION_CONDITION_KIND_OPTIONS.includes(condition.kind)) return []
              const field = normalizeDatasourceText(condition.field).trim()
              const value = normalizeCompletionConditionValue(condition.kind, condition.value)
              return [
                  {
                      kind: condition.kind,
                      ...(field ? { field } : {}),
                      ...(value !== undefined ? { value } : {})
                  }
              ]
          })
        : []
    const candidate: SequencePolicy = {
        mode,
        ...(normalizeDatasourceText(sequencePolicy.prerequisiteFieldCodename).trim()
            ? { prerequisiteFieldCodename: normalizeDatasourceText(sequencePolicy.prerequisiteFieldCodename).trim() }
            : {}),
        ...(normalizeDatasourceText(sequencePolicy.orderFieldCodename).trim()
            ? { orderFieldCodename: normalizeDatasourceText(sequencePolicy.orderFieldCodename).trim() }
            : {}),
        ...(normalizeDatasourceText(sequencePolicy.availableFromFieldCodename).trim()
            ? { availableFromFieldCodename: normalizeDatasourceText(sequencePolicy.availableFromFieldCodename).trim() }
            : {}),
        ...(normalizeDatasourceText(sequencePolicy.availableToFieldCodename).trim()
            ? { availableToFieldCodename: normalizeDatasourceText(sequencePolicy.availableToFieldCodename).trim() }
            : {}),
        ...(normalizeDatasourceText(sequencePolicy.dueAtFieldCodename).trim()
            ? { dueAtFieldCodename: normalizeDatasourceText(sequencePolicy.dueAtFieldCodename).trim() }
            : {}),
        ...(normalizeBoundedInt(sequencePolicy.retryLimit, 0, 100) !== undefined
            ? { retryLimit: normalizeBoundedInt(sequencePolicy.retryLimit, 0, 100) }
            : {}),
        ...(normalizePositiveInt(sequencePolicy.maxAttempts) !== undefined
            ? { maxAttempts: normalizePositiveInt(sequencePolicy.maxAttempts) }
            : {}),
        completion
    }
    const parsed = sequencePolicySchema.safeParse(candidate)
    if (!parsed.success) {
        return setDraftSequencePolicy(config, null)
    }

    return setDraftSequencePolicy(config, parsed.data)
}

const normalizeReportDefinitionConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const reportDefinition = readReportDefinition(config)
    if (!reportDefinition) return config

    const datasource = isRecord(reportDefinition.datasource) ? reportDefinition.datasource : readDatasource(config)
    const columns = Array.isArray(reportDefinition.columns)
        ? reportDefinition.columns.slice(0, 64).flatMap((column): ReportColumn[] => {
              const field = normalizeDatasourceText(column.field).trim()
              const label = normalizeDatasourceText(column.label).trim()
              const type = REPORT_COLUMN_TYPE_OPTIONS.includes(column.type as ReportColumnType) ? column.type : 'text'
              if (!field || !label) return []
              return [{ field, label, type }]
          })
        : []
    const filters = Array.isArray(reportDefinition.filters)
        ? reportDefinition.filters.slice(0, 32).flatMap((filter): ReportFilter[] => {
              const field = normalizeDatasourceText(filter.field).trim()
              const operator = REPORT_FILTER_OPERATOR_OPTIONS.includes(filter.operator as ReportFilterOperator) ? filter.operator : 'equals'
              if (!field) return []
              return [
                  {
                      field,
                      operator,
                      ...(normalizeEditorScalarText(filter.value).trim()
                          ? { value: normalizeCompletionConditionValue('manual', filter.value) }
                          : {})
                  }
              ]
          })
        : []
    const aggregations = Array.isArray(reportDefinition.aggregations)
        ? reportDefinition.aggregations.slice(0, 16).flatMap((aggregation): ReportAggregation[] => {
              const field = normalizeDatasourceText(aggregation.field).trim()
              const fn = REPORT_AGGREGATION_FUNCTION_OPTIONS.includes(aggregation.function as ReportAggregationFunction)
                  ? aggregation.function
                  : 'count'
              const alias = normalizeDatasourceText(aggregation.alias).trim()
              if (!field) return []
              return [
                  {
                      field,
                      function: fn,
                      ...(alias ? { alias } : {})
                  }
              ]
          })
        : []
    const candidate = {
        codename: normalizeDatasourceText(reportDefinition.codename).trim(),
        title: normalizeDatasourceText(reportDefinition.title).trim(),
        ...(normalizeDatasourceText(reportDefinition.description).trim()
            ? { description: normalizeDatasourceText(reportDefinition.description).trim() }
            : {}),
        datasource,
        columns,
        filters,
        aggregations
    }
    const parsed = reportDefinitionSchema.safeParse(candidate)
    if (!parsed.success) {
        return setDraftReportDefinition(config, null)
    }

    return setDraftReportDefinition(config, parsed.data)
}

const splitWorkflowList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap((item) => splitWorkflowList(item))
    }
    if (typeof value !== 'string') return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 32)
}

const normalizeWorkflowActionsConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const actions = readWorkflowActions(config)
        .slice(0, 16)
        .flatMap((action): WorkflowAction[] => {
            const codename = normalizeDatasourceText(action.codename).trim()
            const title = normalizeDatasourceText(action.title).trim()
            const to = normalizeDatasourceText(action.to).trim()
            const from = splitWorkflowList(action.from)
            const requiredCapabilities = splitWorkflowList(action.requiredCapabilities)
            if (!codename || !title || !to || from.length === 0 || requiredCapabilities.length === 0) return []

            const statusFieldCodename = normalizeDatasourceText(action.statusFieldCodename).trim()
            const statusColumnName = normalizeDatasourceText(action.statusColumnName).trim()
            const scriptCodename = normalizeDatasourceText(action.scriptCodename).trim()
            const postingCommand = WORKFLOW_POSTING_COMMANDS.includes(action.postingCommand as WorkflowPostingCommand)
                ? action.postingCommand
                : undefined
            const confirmation = action.confirmation
            const confirmationTitle = normalizeDatasourceText(confirmation?.title).trim()
            const confirmationMessage = normalizeDatasourceText(confirmation?.message).trim()
            const confirmLabel = normalizeDatasourceText(confirmation?.confirmLabel).trim()
            const candidate = {
                codename,
                title,
                from,
                to,
                requiredCapabilities,
                ...(statusFieldCodename ? { statusFieldCodename } : {}),
                ...(statusColumnName ? { statusColumnName } : {}),
                ...(scriptCodename ? { scriptCodename } : {}),
                ...(postingCommand ? { postingCommand } : {}),
                ...(confirmation?.required || confirmationTitle || confirmationMessage || confirmLabel
                    ? {
                          confirmation: {
                              required: confirmation?.required === true,
                              ...(confirmationTitle ? { title: confirmationTitle } : {}),
                              ...(confirmationMessage ? { message: confirmationMessage } : {}),
                              ...(confirmLabel ? { confirmLabel } : {})
                          }
                      }
                    : {})
            }
            const parsed = workflowActionSchema.safeParse(candidate)
            return parsed.success ? [parsed.data] : []
        })

    return setDraftWorkflowActions(config, actions)
}

const normalizeDetailsTableDatasourceConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const datasource = readDatasource(config)
    if (!datasource?.kind) {
        return setDraftDatasource(config, null)
    }

    if (datasource.kind === 'records.list') {
        const sectionId = normalizeDatasourceText((datasource as { sectionId?: unknown }).sectionId).trim()
        const sectionCodename = normalizeDatasourceText((datasource as { sectionCodename?: unknown }).sectionCodename).trim()
        const search = normalizeDatasourceText((datasource as { query?: { search?: unknown } }).query?.search).trim()
        return setDraftDatasource(config, {
            kind: 'records.list',
            ...(sectionId ? { sectionId } : {}),
            ...(sectionCodename ? { sectionCodename } : {}),
            ...(search ? { query: { search } } : {})
        })
    }

    if (datasource.kind === 'ledger.facts') {
        const ledgerId = normalizeDatasourceText((datasource as { ledgerId?: unknown }).ledgerId).trim()
        const ledgerCodename = normalizeDatasourceText((datasource as { ledgerCodename?: unknown }).ledgerCodename).trim()
        return setDraftDatasource(config, {
            kind: 'ledger.facts',
            ...(ledgerId ? { ledgerId } : {}),
            ...(ledgerCodename ? { ledgerCodename } : {})
        })
    }

    if (datasource.kind === 'ledger.projection') {
        const ledgerId = normalizeDatasourceText((datasource as { ledgerId?: unknown }).ledgerId).trim()
        const ledgerCodename = normalizeDatasourceText((datasource as { ledgerCodename?: unknown }).ledgerCodename).trim()
        const projectionCodename = normalizeDatasourceText((datasource as { projectionCodename?: unknown }).projectionCodename).trim()
        if (!projectionCodename) {
            return setDraftDatasource(config, null)
        }
        return setDraftDatasource(config, {
            kind: 'ledger.projection',
            ...(ledgerId ? { ledgerId } : {}),
            ...(ledgerCodename ? { ledgerCodename } : {}),
            projectionCodename
        })
    }

    return setDraftDatasource(config, null)
}

const normalizeDetailsTableConfig = (config: Record<string, unknown>): Record<string, unknown> =>
    normalizeWorkflowActionsConfig(
        normalizeReportDefinitionConfig(normalizeSequencePolicyConfig(normalizeDetailsTableDatasourceConfig(config)))
    )

const readFirstSeries = (config: Record<string, unknown>): Record<string, unknown> => {
    const value = config.series
    return Array.isArray(value) && value[0] && typeof value[0] === 'object' && !Array.isArray(value[0])
        ? { ...(value[0] as Record<string, unknown>) }
        : {}
}

const normalizeRecordsListDatasource = (config: Record<string, unknown>): Record<string, unknown> => {
    const datasource = readDatasource(config)
    if (datasource?.kind !== 'records.list') {
        return setDraftDatasource(config, null)
    }

    const sectionId = normalizeDatasourceText((datasource as { sectionId?: unknown }).sectionId).trim()
    const sectionCodename = normalizeDatasourceText((datasource as { sectionCodename?: unknown }).sectionCodename).trim()
    const search = normalizeDatasourceText((datasource as { query?: { search?: unknown } }).query?.search).trim()
    return setDraftDatasource(config, {
        kind: 'records.list',
        ...(sectionId ? { sectionId } : {}),
        ...(sectionCodename ? { sectionCodename } : {}),
        ...(search ? { query: { search } } : {})
    })
}

const normalizeLedgerProjectionDatasource = (config: Record<string, unknown>): Record<string, unknown> => {
    const datasource = readDatasource(config)
    if (datasource?.kind !== 'ledger.projection') {
        return setDraftDatasource(config, null)
    }

    const ledgerId = normalizeDatasourceText((datasource as { ledgerId?: unknown }).ledgerId).trim()
    const ledgerCodename = normalizeDatasourceText((datasource as { ledgerCodename?: unknown }).ledgerCodename).trim()
    const projectionCodename = normalizeDatasourceText((datasource as { projectionCodename?: unknown }).projectionCodename).trim()
    if (!projectionCodename) {
        return setDraftDatasource(config, null)
    }
    return setDraftDatasource(config, {
        kind: 'ledger.projection',
        ...(ledgerId ? { ledgerId } : {}),
        ...(ledgerCodename ? { ledgerCodename } : {}),
        projectionCodename
    })
}

const normalizeChartDatasource = (config: Record<string, unknown>): Record<string, unknown> => {
    const datasource = readDatasource(config)
    if (datasource?.kind === 'ledger.projection') {
        return normalizeLedgerProjectionDatasource(config)
    }
    return normalizeRecordsListDatasource(config)
}

const normalizeChartConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const base = normalizeChartDatasource(config)
    const xField = normalizeDatasourceText(base.xField).trim()
    const maxRows = normalizePositiveInt(base.maxRows)
    const firstSeries = readFirstSeries(base)
    const seriesField = normalizeDatasourceText(firstSeries.field).trim()
    const seriesLabel = normalizeDatasourceText(firstSeries.label).trim()
    const next: Record<string, unknown> = {
        ...base,
        ...(xField ? { xField } : {})
    }

    if (!xField) {
        delete next.xField
    }
    if (maxRows) {
        next.maxRows = maxRows
    } else {
        delete next.maxRows
    }
    if (seriesField) {
        next.series = [
            {
                field: seriesField,
                ...(seriesLabel ? { label: seriesLabel } : {})
            }
        ]
    } else {
        delete next.series
    }

    return next
}

const readOverviewCards = (config: Record<string, unknown>): Record<string, unknown>[] => {
    const value = config.cards
    return Array.isArray(value) ? value.map((item) => (isRecord(item) ? { ...item } : {})) : []
}

const readOverviewCard = (config: Record<string, unknown>, index: number): Record<string, unknown> => readOverviewCards(config)[index] ?? {}

const readOverviewCardMetricKey = (card: Record<string, unknown>): OverviewCardMetricKey | undefined => {
    const datasource = card.datasource
    if (!isRecord(datasource) || datasource.kind !== 'metric') return undefined
    return datasource.metricKey === 'records.count' || datasource.metricKey === 'report.aggregation' ? datasource.metricKey : undefined
}

const readOverviewCardDatasourceParams = (card: Record<string, unknown>): Record<string, unknown> => {
    const datasource = card.datasource
    if (!isRecord(datasource) || datasource.kind !== 'metric') return {}
    return isRecord(datasource.params) ? datasource.params : {}
}

const normalizeTrend = (value: unknown): (typeof TREND_OPTIONS)[number] | undefined =>
    TREND_OPTIONS.includes(value as (typeof TREND_OPTIONS)[number]) ? (value as (typeof TREND_OPTIONS)[number]) : undefined

const normalizeOverviewCardsConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    const cards = readOverviewCards(config)
        .slice(0, 8)
        .map((card) => {
            const title = normalizeDatasourceText(card.title).trim()
            const value = normalizeDatasourceText(card.value).trim()
            const interval = normalizeDatasourceText(card.interval).trim()
            const trend = normalizeTrend(card.trend)
            const metricKey = readOverviewCardMetricKey(card) ?? 'records.count'
            const params = readOverviewCardDatasourceParams(card)
            const sectionId = normalizeDatasourceText(params.sectionId).trim()
            const sectionCodename = normalizeDatasourceText(params.sectionCodename).trim()
            const objectCollectionId = normalizeDatasourceText(params.objectCollectionId).trim()
            const objectCollectionCodename = normalizeDatasourceText(params.objectCollectionCodename).trim()
            const search = normalizeDatasourceText(params.search).trim()
            const reportId = normalizeDatasourceText(params.reportId).trim()
            const reportCodename = normalizeDatasourceText(params.reportCodename).trim()
            const aggregationAlias = normalizeDatasourceText(params.aggregationAlias).trim()
            const hasRecordsCountDatasource = Boolean(
                sectionId || sectionCodename || objectCollectionId || objectCollectionCodename || search
            )
            const hasReportAggregationDatasource = Boolean((reportId || reportCodename) && aggregationAlias)
            const next: Record<string, unknown> = {
                ...(title ? { title } : {}),
                ...(value ? { value } : {}),
                ...(interval ? { interval } : {}),
                ...(trend ? { trend } : {})
            }

            if (Array.isArray(card.data) && card.data.every((item) => typeof item === 'number' && Number.isFinite(item))) {
                next.data = card.data
            }
            if (metricKey === 'report.aggregation' && hasReportAggregationDatasource) {
                next.datasource = {
                    kind: 'metric',
                    metricKey: 'report.aggregation',
                    params: {
                        ...(reportId ? { reportId } : {}),
                        ...(reportCodename ? { reportCodename } : {}),
                        aggregationAlias
                    }
                }
            } else if (metricKey === 'records.count' && hasRecordsCountDatasource) {
                next.datasource = {
                    kind: 'metric',
                    metricKey: 'records.count',
                    params: {
                        ...(sectionId ? { sectionId } : {}),
                        ...(sectionCodename ? { sectionCodename } : {}),
                        ...(objectCollectionId ? { objectCollectionId } : {}),
                        ...(objectCollectionCodename ? { objectCollectionCodename } : {}),
                        ...(search ? { search } : {})
                    }
                }
            }
            return next
        })
        .filter((card) => Object.keys(card).length > 0)

    const next = { ...config }
    if (cards.length > 0) {
        next.cards = cards
    } else {
        delete next.cards
    }
    return next
}

type DatasourceValidationWarning = {
    labelKey: string
    fallback: string
}

type ResourceValidationWarning = {
    labelKey: string
    fallback: string
}

type SequenceValidationWarning = {
    labelKey: string
    fallback: string
}

type ReportValidationWarning = {
    labelKey: string
    fallback: string
}

type WorkflowValidationWarning = {
    labelKey: string
    fallback: string
}

const collectDatasourceValidationWarnings = (
    widgetKey: string | null | undefined,
    config: Record<string, unknown>
): DatasourceValidationWarning[] => {
    const warnings: DatasourceValidationWarning[] = []
    const datasource = readDatasource(config)
    const datasourceKind: EditableDatasourceKind =
        datasource?.kind === 'records.list' || datasource?.kind === 'ledger.facts' || datasource?.kind === 'ledger.projection'
            ? datasource.kind
            : 'current'
    const isChartWidget = Boolean(widgetKey && CHART_WIDGET_KEYS.has(widgetKey))
    const isDatasourceWidget = widgetKey === 'detailsTable' || isChartWidget

    if (isDatasourceWidget && datasourceKind === 'records.list') {
        const sectionId = normalizeDatasourceText((datasource as { sectionId?: unknown } | null)?.sectionId).trim()
        const sectionCodename = normalizeDatasourceText((datasource as { sectionCodename?: unknown } | null)?.sectionCodename).trim()
        if (!sectionId && !sectionCodename) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.recordsListTarget',
                fallback: 'Records list datasource needs a section reference or section codename.'
            })
        }
    }

    if (isDatasourceWidget && (datasourceKind === 'ledger.facts' || datasourceKind === 'ledger.projection')) {
        const ledgerId = normalizeDatasourceText((datasource as { ledgerId?: unknown } | null)?.ledgerId).trim()
        const ledgerCodename = normalizeDatasourceText((datasource as { ledgerCodename?: unknown } | null)?.ledgerCodename).trim()
        if (!ledgerId && !ledgerCodename) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.ledgerTarget',
                fallback: 'Ledger datasource needs a ledger reference or ledger codename.'
            })
        }
    }

    if (isDatasourceWidget && datasourceKind === 'ledger.projection') {
        const projectionCodename = normalizeDatasourceText(
            (datasource as { projectionCodename?: unknown } | null)?.projectionCodename
        ).trim()
        if (!projectionCodename) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.projectionCodename',
                fallback: 'Ledger projection datasource needs a projection codename.'
            })
        }
    }

    if (isChartWidget && datasourceKind !== 'current') {
        const firstSeries = readFirstSeries(config)
        if (!normalizeDatasourceText(config.xField).trim()) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.chartXField',
                fallback: 'Chart datasource needs an X-axis field.'
            })
        }
        if (!normalizeDatasourceText(firstSeries.field).trim()) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.chartSeriesField',
                fallback: 'Chart datasource needs a series field.'
            })
        }
    }

    if (widgetKey === 'overviewCards') {
        const cards = readOverviewCards(config)
        const hasUnsupportedMetric = cards.some((card) => {
            const datasourceValue = card.datasource
            return (
                isRecord(datasourceValue) &&
                datasourceValue.kind === 'metric' &&
                datasourceValue.metricKey !== 'records.count' &&
                datasourceValue.metricKey !== 'report.aggregation'
            )
        })
        if (hasUnsupportedMetric) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.unsupportedOverviewMetric',
                fallback: 'Unsupported overview card metrics will be removed when saved.'
            })
        }
        const hasIncompleteReportMetric = cards.some((card) => {
            if (readOverviewCardMetricKey(card) !== 'report.aggregation') return false
            const params = readOverviewCardDatasourceParams(card)
            const reportId = normalizeDatasourceText(params.reportId).trim()
            const reportCodename = normalizeDatasourceText(params.reportCodename).trim()
            const aggregationAlias = normalizeDatasourceText(params.aggregationAlias).trim()
            return !(reportId || reportCodename) || !aggregationAlias
        })
        if (hasIncompleteReportMetric) {
            warnings.push({
                labelKey: 'layouts.datasource.validation.reportAggregationMetric',
                fallback: 'Report aggregation metrics need a report reference and aggregation alias.'
            })
        }
    }

    return warnings
}

const collectResourceValidationWarnings = (
    widgetKey: string | null | undefined,
    config: Record<string, unknown>
): ResourceValidationWarning[] => {
    if (widgetKey !== 'resourcePreview') return []

    const source = readResourceSource(config)
    if (!source) {
        return [
            {
                labelKey: 'layouts.resourcePreview.validation.missingSource',
                fallback: 'Resource preview needs a valid resource source.'
            }
        ]
    }

    const parsed = resourceSourceSchema.safeParse(source)
    if (!parsed.success) {
        return [
            {
                labelKey: 'layouts.resourcePreview.validation.invalidSource',
                fallback: 'Invalid resource source will be removed when saved.'
            }
        ]
    }

    if (isDeferredResourceSource(parsed.data)) {
        return [
            {
                labelKey: 'layouts.resourcePreview.validation.deferredSource',
                fallback: 'Storage, file, and SCORM resources are saved as placeholders until runtime players are implemented.'
            }
        ]
    }

    return []
}

const collectSequenceValidationWarnings = (
    widgetKey: string | null | undefined,
    config: Record<string, unknown>
): SequenceValidationWarning[] => {
    if (widgetKey !== 'detailsTable') return []

    const sequencePolicy = readSequencePolicy(config)
    if (!sequencePolicy) return []

    const warnings: SequenceValidationWarning[] = []
    if (!sequencePolicySchema.safeParse(normalizeSequencePolicyConfig(config).sequencePolicy).success) {
        warnings.push({
            labelKey: 'layouts.sequencePolicy.validation.invalidPolicy',
            fallback: 'Invalid sequence policy will be removed when saved.'
        })
        return warnings
    }

    const mode = SEQUENCE_POLICY_MODES.includes(sequencePolicy.mode as SequencePolicyMode) ? sequencePolicy.mode : 'free'
    if (mode === 'sequential' && !normalizeDatasourceText(sequencePolicy.orderFieldCodename).trim()) {
        warnings.push({
            labelKey: 'layouts.sequencePolicy.validation.sequentialOrder',
            fallback: 'Sequential mode needs an order field codename.'
        })
    }
    if (
        mode === 'scheduled' &&
        !normalizeDatasourceText(sequencePolicy.availableFromFieldCodename).trim() &&
        !normalizeDatasourceText(sequencePolicy.availableToFieldCodename).trim() &&
        !normalizeDatasourceText(sequencePolicy.dueAtFieldCodename).trim()
    ) {
        warnings.push({
            labelKey: 'layouts.sequencePolicy.validation.scheduledFields',
            fallback: 'Scheduled mode needs at least one availability or due-date field.'
        })
    }
    if (mode === 'prerequisite' && !normalizeDatasourceText(sequencePolicy.prerequisiteFieldCodename).trim()) {
        warnings.push({
            labelKey: 'layouts.sequencePolicy.validation.prerequisiteField',
            fallback: 'Prerequisite mode needs a prerequisite field codename.'
        })
    }
    if (mode !== 'free' && (!Array.isArray(sequencePolicy.completion) || sequencePolicy.completion.length === 0)) {
        warnings.push({
            labelKey: 'layouts.sequencePolicy.validation.emptyCompletion',
            fallback: 'Sequence policy has no completion conditions yet.'
        })
    }

    return warnings
}

const collectReportValidationWarnings = (
    widgetKey: string | null | undefined,
    config: Record<string, unknown>
): ReportValidationWarning[] => {
    if (widgetKey !== 'detailsTable') return []

    const reportDefinition = readReportDefinition(config)
    if (!reportDefinition) return []

    const warnings: ReportValidationWarning[] = []
    if (!normalizeDatasourceText(reportDefinition.codename).trim()) {
        warnings.push({
            labelKey: 'layouts.reportDefinition.validation.codename',
            fallback: 'Report definition needs a codename.'
        })
    }
    if (!normalizeDatasourceText(reportDefinition.title).trim()) {
        warnings.push({
            labelKey: 'layouts.reportDefinition.validation.title',
            fallback: 'Report definition needs a title.'
        })
    }
    if (!readDatasource(config) && !isRecord(reportDefinition.datasource)) {
        warnings.push({
            labelKey: 'layouts.reportDefinition.validation.datasource',
            fallback: 'Report definition needs a valid datasource.'
        })
    }
    if (!Array.isArray(reportDefinition.columns) || reportDefinition.columns.length === 0) {
        warnings.push({
            labelKey: 'layouts.reportDefinition.validation.columns',
            fallback: 'Report definition needs at least one output column.'
        })
    }
    if (!reportDefinitionSchema.safeParse(normalizeReportDefinitionConfig(config).reportDefinition).success) {
        warnings.push({
            labelKey: 'layouts.reportDefinition.validation.invalidDefinition',
            fallback: 'Invalid report definition will be removed when saved.'
        })
    }

    return warnings
}

const collectWorkflowValidationWarnings = (
    widgetKey: string | null | undefined,
    config: Record<string, unknown>
): WorkflowValidationWarning[] => {
    if (widgetKey !== 'detailsTable') return []

    const actions = readWorkflowActions(config)
    if (actions.length === 0) return []

    const warnings: WorkflowValidationWarning[] = []
    actions.forEach((action, index) => {
        const slotNumber = index + 1
        if (!normalizeDatasourceText(action.codename).trim()) {
            warnings.push({
                labelKey: `layouts.workflowActions.validation.codename.${slotNumber}`,
                fallback: `Workflow action ${slotNumber} needs a codename.`
            })
        }
        if (!normalizeDatasourceText(action.title).trim()) {
            warnings.push({
                labelKey: `layouts.workflowActions.validation.title.${slotNumber}`,
                fallback: `Workflow action ${slotNumber} needs a title.`
            })
        }
        if (splitWorkflowList(action.from).length === 0) {
            warnings.push({
                labelKey: `layouts.workflowActions.validation.from.${slotNumber}`,
                fallback: `Workflow action ${slotNumber} needs at least one source status.`
            })
        }
        if (!normalizeDatasourceText(action.to).trim()) {
            warnings.push({
                labelKey: `layouts.workflowActions.validation.to.${slotNumber}`,
                fallback: `Workflow action ${slotNumber} needs a target status.`
            })
        }
        if (splitWorkflowList(action.requiredCapabilities).length === 0) {
            warnings.push({
                labelKey: `layouts.workflowActions.validation.requiredCapabilities.${slotNumber}`,
                fallback: `Workflow action ${slotNumber} needs at least one required capability.`
            })
        }
    })

    if (readWorkflowActions(normalizeWorkflowActionsConfig(config)).length !== actions.length) {
        warnings.push({
            labelKey: 'layouts.workflowActions.validation.invalidActions',
            fallback: 'Invalid workflow actions will be removed when saved.'
        })
    }

    return warnings
}

export default function ApplicationWidgetBehaviorEditorDialog({ open, widgetKey, config, sectionOptions = [], onSave, onCancel }: Props) {
    const { t } = useTranslation(['applications', 'common'])
    const [draft, setDraft] = useState<Record<string, unknown>>(() => normalizeConfig(config))

    useEffect(() => {
        if (!open) return
        setDraft(normalizeConfig(config))
    }, [config, open])

    const datasource = readDatasource(draft)
    const datasourceKind: EditableDatasourceKind =
        datasource?.kind === 'records.list' || datasource?.kind === 'ledger.facts' || datasource?.kind === 'ledger.projection'
            ? datasource.kind
            : 'current'
    const firstSeries = readFirstSeries(draft)
    const updateDatasource = (patch: Partial<RuntimeDatasourceDescriptor> | null) => {
        setDraft((current) => {
            const currentDatasource = readDatasource(current)
            if (!patch) {
                return setDraftDatasource(current, null)
            }
            return setDraftDatasource(current, {
                ...(currentDatasource ?? {}),
                ...patch
            })
        })
    }
    const updateRecordsDatasourceSection = (sectionId: string) => {
        const selected = sectionOptions.find((option) => option.id === sectionId)
        updateDatasource({
            kind: 'records.list',
            sectionId,
            ...(selected?.codename ? { sectionCodename: selected.codename } : {})
        } as Partial<RuntimeDatasourceDescriptor>)
    }
    const updateFirstSeries = (patch: Record<string, unknown>) => {
        setDraft((current) => ({
            ...current,
            series: [
                {
                    ...readFirstSeries(current),
                    ...patch
                }
            ]
        }))
    }
    const isDetailsTableWidget = widgetKey === 'detailsTable'
    const isChartWidget = Boolean(widgetKey && CHART_WIDGET_KEYS.has(widgetKey))
    const isOverviewCardsWidget = widgetKey === 'overviewCards'
    const isResourcePreviewWidget = widgetKey === 'resourcePreview'
    const showDatasourceFields = isDetailsTableWidget || isChartWidget
    const datasourceKindOptions = isChartWidget ? CHART_DATASOURCE_KIND_OPTIONS : DETAILS_TABLE_DATASOURCE_KIND_OPTIONS
    const datasourceWarnings = collectDatasourceValidationWarnings(widgetKey, draft)
    const resourceWarnings = collectResourceValidationWarnings(widgetKey, draft)
    const sequenceWarnings = collectSequenceValidationWarnings(widgetKey, draft)
    const reportWarnings = collectReportValidationWarnings(widgetKey, draft)
    const workflowWarnings = collectWorkflowValidationWarnings(widgetKey, draft)
    const resourceSource = readResourceSource(draft)
    const resourceType: ResourceType = resourceSource?.type && RESOURCE_TYPES.includes(resourceSource.type) ? resourceSource.type : 'page'
    const resourceLaunchMode: ResourceLaunchMode =
        resourceSource?.launchMode && RESOURCE_LAUNCH_MODES.includes(resourceSource.launchMode) ? resourceSource.launchMode : 'inline'
    const sequencePolicy = readSequencePolicy(draft)
    const reportDefinition = readReportDefinition(draft)
    const workflowActions = readWorkflowActions(draft)
    const sequenceMode: SequencePolicyMode =
        sequencePolicy?.mode && SEQUENCE_POLICY_MODES.includes(sequencePolicy.mode) ? sequencePolicy.mode : 'free'
    const updateOverviewCard = (index: number, patch: Record<string, unknown>) => {
        setDraft((current) => {
            const cards = readOverviewCards(current)
            while (cards.length <= index) {
                cards.push({})
            }
            cards[index] = {
                ...cards[index],
                ...patch
            }
            return {
                ...current,
                cards
            }
        })
    }
    const updateOverviewCardMetricParams = (index: number, patch: Record<string, unknown>, metricKey?: OverviewCardMetricKey) => {
        setDraft((current) => {
            const cards = readOverviewCards(current)
            while (cards.length <= index) {
                cards.push({})
            }
            const card = cards[index]
            const resolvedMetricKey = metricKey ?? readOverviewCardMetricKey(card) ?? 'records.count'
            const params = readOverviewCardDatasourceParams(card)
            cards[index] = {
                ...card,
                datasource: {
                    kind: 'metric',
                    metricKey: resolvedMetricKey,
                    params: {
                        ...params,
                        ...patch
                    }
                }
            }
            return {
                ...current,
                cards
            }
        })
    }
    const updateOverviewCardMetricKey = (index: number, metricKey: OverviewCardMetricKey) => {
        updateOverviewCardMetricParams(index, {}, metricKey)
    }
    const updateOverviewCardMetricSection = (index: number, sectionId: string) => {
        const selected = sectionOptions.find((option) => option.id === sectionId)
        updateOverviewCardMetricParams(index, {
            sectionId,
            ...(selected?.codename ? { sectionCodename: selected.codename } : {})
        })
    }
    const normalizeDraft = () => {
        if (isDetailsTableWidget) return normalizeDetailsTableConfig(draft)
        if (isChartWidget) return normalizeChartConfig(draft)
        if (isOverviewCardsWidget) return normalizeOverviewCardsConfig(draft)
        if (isResourcePreviewWidget) return normalizeResourcePreviewConfig(draft)
        return draft
    }
    const updateResourceSource = (patch: EditableResourceSourcePatch | null) => {
        setDraft((current) => {
            const currentSource = readResourceSource(current)
            if (!patch) {
                return setDraftResourceSource(current, null)
            }
            return setDraftResourceSource(current, {
                ...(currentSource ?? {}),
                ...patch
            })
        })
    }
    const updateSequencePolicy = (patch: EditableSequencePolicy | null) => {
        setDraft((current) => {
            const currentPolicy = readSequencePolicy(current)
            if (!patch) {
                return setDraftSequencePolicy(current, null)
            }
            return setDraftSequencePolicy(current, {
                ...(currentPolicy ?? { mode: 'free', completion: [] }),
                ...patch
            })
        })
    }
    const updateCompletionCondition = (index: number, patch: EditableCompletionCondition) => {
        setDraft((current) => {
            const currentPolicy = readSequencePolicy(current) ?? { mode: 'free', completion: [] }
            const completion = Array.isArray(currentPolicy.completion) ? [...currentPolicy.completion] : []
            while (completion.length <= index) {
                completion.push({ kind: 'manual' })
            }
            completion[index] = {
                ...completion[index],
                ...patch
            }
            return setDraftSequencePolicy(current, {
                ...currentPolicy,
                completion
            })
        })
    }
    const updateReportDefinition = (patch: EditableReportDefinition | null) => {
        setDraft((current) => {
            const currentDefinition = readReportDefinition(current)
            if (!patch) {
                return setDraftReportDefinition(current, null)
            }
            return setDraftReportDefinition(current, {
                ...(currentDefinition ?? {}),
                ...patch
            })
        })
    }
    const updateReportColumn = (index: number, patch: EditableReportColumn) => {
        setDraft((current) => {
            const currentDefinition = readReportDefinition(current) ?? {}
            const columns = Array.isArray(currentDefinition.columns) ? [...currentDefinition.columns] : []
            while (columns.length <= index) {
                columns.push({ type: 'text' })
            }
            columns[index] = {
                ...columns[index],
                ...patch
            }
            return setDraftReportDefinition(current, {
                ...currentDefinition,
                columns
            })
        })
    }
    const updateReportFilter = (index: number, patch: EditableReportFilter) => {
        setDraft((current) => {
            const currentDefinition = readReportDefinition(current) ?? {}
            const filters = Array.isArray(currentDefinition.filters) ? [...currentDefinition.filters] : []
            while (filters.length <= index) {
                filters.push({ operator: 'equals' })
            }
            filters[index] = {
                ...filters[index],
                ...patch
            }
            return setDraftReportDefinition(current, {
                ...currentDefinition,
                filters
            })
        })
    }
    const updateReportAggregation = (index: number, patch: EditableReportAggregation) => {
        setDraft((current) => {
            const currentDefinition = readReportDefinition(current) ?? {}
            const aggregations = Array.isArray(currentDefinition.aggregations) ? [...currentDefinition.aggregations] : []
            while (aggregations.length <= index) {
                aggregations.push({ function: 'count' })
            }
            aggregations[index] = {
                ...aggregations[index],
                ...patch
            }
            return setDraftReportDefinition(current, {
                ...currentDefinition,
                aggregations
            })
        })
    }
    const updateWorkflowAction = (index: number, patch: EditableWorkflowAction) => {
        setDraft((current) => {
            const actions = readWorkflowActions(current)
            while (actions.length <= index) {
                actions.push({})
            }
            actions[index] = {
                ...actions[index],
                ...patch
            }
            return setDraftWorkflowActions(current, actions)
        })
    }
    const updateWorkflowConfirmation = (index: number, patch: Partial<WorkflowAction['confirmation']>) => {
        setDraft((current) => {
            const actions = readWorkflowActions(current)
            while (actions.length <= index) {
                actions.push({})
            }
            actions[index] = {
                ...actions[index],
                confirmation: {
                    ...(actions[index].confirmation ?? {}),
                    ...patch
                }
            }
            return setDraftWorkflowActions(current, actions)
        })
    }

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.widgetBehaviorEditor.title', 'Widget behavior')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(normalizeDraft())}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('layouts.widgetBehaviorEditor.description', 'Configure how inherited layouts can override this widget.')}
                    </Typography>
                    {datasourceWarnings.length > 0 ? (
                        <Alert severity='warning' data-testid='application-widget-datasource-validation-warning'>
                            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {datasourceWarnings.map((warning) => (
                                    <Typography key={warning.labelKey} component='li' variant='body2'>
                                        {t(warning.labelKey, warning.fallback)}
                                    </Typography>
                                ))}
                            </Stack>
                        </Alert>
                    ) : null}
                    {resourceWarnings.length > 0 ? (
                        <Alert severity='warning' data-testid='application-widget-resource-validation-warning'>
                            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {resourceWarnings.map((warning) => (
                                    <Typography key={warning.labelKey} component='li' variant='body2'>
                                        {t(warning.labelKey, warning.fallback)}
                                    </Typography>
                                ))}
                            </Stack>
                        </Alert>
                    ) : null}
                    {sequenceWarnings.length > 0 ? (
                        <Alert severity='warning' data-testid='application-widget-sequence-validation-warning'>
                            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {sequenceWarnings.map((warning) => (
                                    <Typography key={warning.labelKey} component='li' variant='body2'>
                                        {t(warning.labelKey, warning.fallback)}
                                    </Typography>
                                ))}
                            </Stack>
                        </Alert>
                    ) : null}
                    {reportWarnings.length > 0 ? (
                        <Alert severity='warning' data-testid='application-widget-report-validation-warning'>
                            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {reportWarnings.map((warning) => (
                                    <Typography key={warning.labelKey} component='li' variant='body2'>
                                        {t(warning.labelKey, warning.fallback)}
                                    </Typography>
                                ))}
                            </Stack>
                        </Alert>
                    ) : null}
                    {workflowWarnings.length > 0 ? (
                        <Alert severity='warning' data-testid='application-widget-workflow-validation-warning'>
                            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {workflowWarnings.map((warning) => (
                                    <Typography key={warning.labelKey} component='li' variant='body2'>
                                        {t(warning.labelKey, warning.fallback)}
                                    </Typography>
                                ))}
                            </Stack>
                        </Alert>
                    ) : null}
                    {showDatasourceFields ? (
                        <Stack spacing={1.5}>
                            <Typography variant='subtitle2'>{t('layouts.datasource.title', 'Datasource')}</Typography>
                            <FormControl size='small' fullWidth>
                                <InputLabel>{t('layouts.datasource.kind', 'Datasource')}</InputLabel>
                                <Select
                                    value={datasourceKind}
                                    label={t('layouts.datasource.kind', 'Datasource')}
                                    onChange={(event) => {
                                        const value = event.target.value as EditableDatasourceKind
                                        if (value === 'current') {
                                            updateDatasource(null)
                                            return
                                        }
                                        updateDatasource({ kind: value } as Partial<RuntimeDatasourceDescriptor>)
                                    }}
                                >
                                    {datasourceKindOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {t(option.labelKey, option.fallback)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {datasourceKind === 'records.list' ? (
                                <>
                                    {sectionOptions.length > 0 ? (
                                        <FormControl size='small' fullWidth>
                                            <InputLabel>{t('layouts.datasource.sectionPicker', 'Section')}</InputLabel>
                                            <Select
                                                value={
                                                    sectionOptions.some(
                                                        (option) =>
                                                            option.id ===
                                                            normalizeDatasourceText(
                                                                (datasource as { sectionId?: unknown } | null)?.sectionId
                                                            )
                                                    )
                                                        ? normalizeDatasourceText((datasource as { sectionId?: unknown } | null)?.sectionId)
                                                        : ''
                                                }
                                                label={t('layouts.datasource.sectionPicker', 'Section')}
                                                onChange={(event) => updateRecordsDatasourceSection(event.target.value)}
                                            >
                                                <MenuItem value=''>
                                                    {t('layouts.datasource.sectionManual', 'Manual section reference')}
                                                </MenuItem>
                                                {sectionOptions.map((option) => (
                                                    <MenuItem key={option.id} value={option.id}>
                                                        {option.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    ) : null}
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.sectionId', 'Section ID')}
                                        value={normalizeDatasourceText((datasource as { sectionId?: unknown } | null)?.sectionId)}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: 'records.list',
                                                sectionId: event.target.value
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.sectionCodename', 'Section codename')}
                                        value={normalizeDatasourceText(
                                            (datasource as { sectionCodename?: unknown } | null)?.sectionCodename
                                        )}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: 'records.list',
                                                sectionCodename: event.target.value
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.search', 'Initial search')}
                                        value={normalizeDatasourceText(
                                            (datasource as { query?: { search?: unknown } } | null)?.query?.search
                                        )}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: 'records.list',
                                                query: { search: event.target.value }
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                    {isChartWidget ? (
                                        <>
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.xField', 'X-axis field')}
                                                value={normalizeDatasourceText(draft.xField)}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        xField: event.target.value
                                                    }))
                                                }
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.seriesField', 'Series field')}
                                                value={normalizeDatasourceText(firstSeries.field)}
                                                onChange={(event) => updateFirstSeries({ field: event.target.value })}
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.seriesLabel', 'Series label')}
                                                value={normalizeDatasourceText(firstSeries.label)}
                                                onChange={(event) => updateFirstSeries({ label: event.target.value })}
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                type='number'
                                                label={t('layouts.datasource.maxRows', 'Max rows')}
                                                value={normalizeDatasourceScalarText(draft.maxRows)}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        maxRows: event.target.value
                                                    }))
                                                }
                                                inputProps={{ min: 1, max: 100 }}
                                                fullWidth
                                            />
                                        </>
                                    ) : null}
                                </>
                            ) : null}
                            {datasourceKind === 'ledger.facts' || datasourceKind === 'ledger.projection' ? (
                                <>
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.ledgerId', 'Ledger ID')}
                                        value={normalizeDatasourceText((datasource as { ledgerId?: unknown } | null)?.ledgerId)}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: datasourceKind,
                                                ledgerId: event.target.value
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.ledgerCodename', 'Ledger codename')}
                                        value={normalizeDatasourceText((datasource as { ledgerCodename?: unknown } | null)?.ledgerCodename)}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: datasourceKind,
                                                ledgerCodename: event.target.value
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                </>
                            ) : null}
                            {datasourceKind === 'ledger.projection' ? (
                                <>
                                    <TextField
                                        size='small'
                                        label={t('layouts.datasource.projectionCodename', 'Projection codename')}
                                        value={normalizeDatasourceText(
                                            (datasource as { projectionCodename?: unknown } | null)?.projectionCodename
                                        )}
                                        onChange={(event) =>
                                            updateDatasource({
                                                kind: 'ledger.projection',
                                                projectionCodename: event.target.value
                                            } as Partial<RuntimeDatasourceDescriptor>)
                                        }
                                        fullWidth
                                    />
                                    {isChartWidget ? (
                                        <>
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.xField', 'X-axis field')}
                                                value={normalizeDatasourceText(draft.xField)}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        xField: event.target.value
                                                    }))
                                                }
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.seriesField', 'Series field')}
                                                value={normalizeDatasourceText(firstSeries.field)}
                                                onChange={(event) => updateFirstSeries({ field: event.target.value })}
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                label={t('layouts.datasource.seriesLabel', 'Series label')}
                                                value={normalizeDatasourceText(firstSeries.label)}
                                                onChange={(event) => updateFirstSeries({ label: event.target.value })}
                                                fullWidth
                                            />
                                            <TextField
                                                size='small'
                                                type='number'
                                                label={t('layouts.datasource.maxRows', 'Max rows')}
                                                value={normalizeDatasourceScalarText(draft.maxRows)}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        maxRows: event.target.value
                                                    }))
                                                }
                                                inputProps={{ min: 1, max: 100 }}
                                                fullWidth
                                            />
                                        </>
                                    ) : null}
                                </>
                            ) : null}
                        </Stack>
                    ) : null}
                    {isDetailsTableWidget ? (
                        <Stack spacing={1.5}>
                            <Typography variant='subtitle2'>{t('layouts.workflowActions.title', 'Workflow actions')}</Typography>
                            {Array.from({ length: WORKFLOW_ACTION_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const action = workflowActions[index] ?? {}
                                const postingCommand = WORKFLOW_POSTING_COMMAND_OPTIONS.includes(
                                    action.postingCommand as WorkflowPostingCommand | ''
                                )
                                    ? action.postingCommand ?? ''
                                    : ''
                                const postingCommandLabelId = `workflow-action-posting-command-${slotNumber}-label`
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.workflowActions.action', 'Action')} {slotNumber}
                                        </Typography>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.codename', 'Action codename')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.codename)}
                                            onChange={(event) => updateWorkflowAction(index, { codename: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.displayTitle', 'Action title')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.title)}
                                            onChange={(event) => updateWorkflowAction(index, { title: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.fromStatuses', 'Source statuses')} ${slotNumber}`}
                                            value={
                                                Array.isArray(action.from) ? action.from.join(', ') : normalizeDatasourceText(action.from)
                                            }
                                            onChange={(event) => updateWorkflowAction(index, { from: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.toStatus', 'Target status')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.to)}
                                            onChange={(event) => updateWorkflowAction(index, { to: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t(
                                                'layouts.workflowActions.requiredCapabilities',
                                                'Required capabilities'
                                            )} ${slotNumber}`}
                                            value={
                                                Array.isArray(action.requiredCapabilities)
                                                    ? action.requiredCapabilities.join(', ')
                                                    : normalizeDatasourceText(action.requiredCapabilities)
                                            }
                                            onChange={(event) => updateWorkflowAction(index, { requiredCapabilities: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t(
                                                'layouts.workflowActions.statusFieldCodename',
                                                'Status field codename'
                                            )} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.statusFieldCodename)}
                                            onChange={(event) => updateWorkflowAction(index, { statusFieldCodename: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.statusColumnName', 'Status column name')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.statusColumnName)}
                                            onChange={(event) => updateWorkflowAction(index, { statusColumnName: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.scriptCodename', 'Script codename')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.scriptCodename)}
                                            onChange={(event) => updateWorkflowAction(index, { scriptCodename: event.target.value })}
                                            fullWidth
                                        />
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={postingCommandLabelId}>
                                                {`${t('layouts.workflowActions.postingCommand', 'Posting command')} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={postingCommandLabelId}
                                                value={postingCommand}
                                                label={`${t('layouts.workflowActions.postingCommand', 'Posting command')} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateWorkflowAction(index, {
                                                        postingCommand: event.target.value as WorkflowPostingCommand | ''
                                                    })
                                                }
                                            >
                                                {WORKFLOW_POSTING_COMMAND_OPTIONS.map((command) => (
                                                    <MenuItem key={command || 'none'} value={command}>
                                                        {t(
                                                            `layouts.workflowActions.postingCommands.${command || 'none'}`,
                                                            WORKFLOW_POSTING_COMMAND_FALLBACK_LABELS[command]
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={`workflow-action-confirmation-required-${slotNumber}-label`}>
                                                {`${t(
                                                    'layouts.workflowActions.confirmationRequired',
                                                    'Confirmation required'
                                                )} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={`workflow-action-confirmation-required-${slotNumber}-label`}
                                                value={action.confirmation?.required === true ? 'true' : 'false'}
                                                label={`${t(
                                                    'layouts.workflowActions.confirmationRequired',
                                                    'Confirmation required'
                                                )} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateWorkflowConfirmation(index, { required: event.target.value === 'true' })
                                                }
                                            >
                                                <MenuItem value='false'>{t('common:no', 'No')}</MenuItem>
                                                <MenuItem value='true'>{t('common:yes', 'Yes')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.workflowActions.confirmationTitle', 'Confirmation title')} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.confirmation?.title)}
                                            onChange={(event) => updateWorkflowConfirmation(index, { title: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t(
                                                'layouts.workflowActions.confirmationMessage',
                                                'Confirmation message'
                                            )} ${slotNumber}`}
                                            value={normalizeDatasourceText(action.confirmation?.message)}
                                            onChange={(event) => updateWorkflowConfirmation(index, { message: event.target.value })}
                                            fullWidth
                                        />
                                    </Stack>
                                )
                            })}
                        </Stack>
                    ) : null}
                    {isDetailsTableWidget ? (
                        <Stack spacing={1.5}>
                            <Typography variant='subtitle2'>{t('layouts.reportDefinition.title', 'Report definition')}</Typography>
                            <TextField
                                size='small'
                                label={t('layouts.reportDefinition.codename', 'Report codename')}
                                value={normalizeDatasourceText(reportDefinition?.codename)}
                                onChange={(event) => updateReportDefinition({ codename: event.target.value })}
                                fullWidth
                            />
                            <TextField
                                size='small'
                                label={t('layouts.reportDefinition.displayTitle', 'Report title')}
                                value={normalizeDatasourceText(reportDefinition?.title)}
                                onChange={(event) => updateReportDefinition({ title: event.target.value })}
                                fullWidth
                            />
                            <TextField
                                size='small'
                                label={t('layouts.reportDefinition.description', 'Report description')}
                                value={normalizeDatasourceText(reportDefinition?.description)}
                                onChange={(event) => updateReportDefinition({ description: event.target.value })}
                                fullWidth
                                multiline
                                minRows={2}
                            />
                            <Typography variant='caption' color='text.secondary'>
                                {t('layouts.reportDefinition.columns', 'Output columns')}
                            </Typography>
                            {Array.from({ length: REPORT_COLUMN_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const column = Array.isArray(reportDefinition?.columns) ? reportDefinition.columns[index] : undefined
                                const columnType = column?.type && REPORT_COLUMN_TYPE_OPTIONS.includes(column.type) ? column.type : 'text'
                                const columnTypeLabelId = `report-definition-column-type-${slotNumber}-label`
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.reportDefinition.column', 'Column')} {slotNumber}
                                        </Typography>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.columnField', 'Column field')} ${slotNumber}`}
                                            value={normalizeDatasourceText(column?.field)}
                                            onChange={(event) => updateReportColumn(index, { field: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.columnLabel', 'Column label')} ${slotNumber}`}
                                            value={normalizeDatasourceText(column?.label)}
                                            onChange={(event) => updateReportColumn(index, { label: event.target.value })}
                                            fullWidth
                                        />
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={columnTypeLabelId}>
                                                {`${t('layouts.reportDefinition.columnType', 'Column type')} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={columnTypeLabelId}
                                                value={columnType}
                                                label={`${t('layouts.reportDefinition.columnType', 'Column type')} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateReportColumn(index, { type: event.target.value as ReportColumnType })
                                                }
                                            >
                                                {REPORT_COLUMN_TYPE_OPTIONS.map((type) => (
                                                    <MenuItem key={type} value={type}>
                                                        {t(
                                                            `layouts.reportDefinition.columnTypes.${type}`,
                                                            REPORT_COLUMN_TYPE_FALLBACK_LABELS[type]
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                )
                            })}
                            <Typography variant='caption' color='text.secondary'>
                                {t('layouts.reportDefinition.filters', 'Filters')}
                            </Typography>
                            {Array.from({ length: REPORT_FILTER_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const filter = Array.isArray(reportDefinition?.filters) ? reportDefinition.filters[index] : undefined
                                const operator =
                                    filter?.operator && REPORT_FILTER_OPERATOR_OPTIONS.includes(filter.operator)
                                        ? filter.operator
                                        : 'equals'
                                const operatorLabelId = `report-definition-filter-operator-${slotNumber}-label`
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.reportDefinition.filter', 'Filter')} {slotNumber}
                                        </Typography>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.filterField', 'Filter field')} ${slotNumber}`}
                                            value={normalizeDatasourceText(filter?.field)}
                                            onChange={(event) => updateReportFilter(index, { field: event.target.value })}
                                            fullWidth
                                        />
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={operatorLabelId}>
                                                {`${t('layouts.reportDefinition.filterOperator', 'Filter operator')} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={operatorLabelId}
                                                value={operator}
                                                label={`${t('layouts.reportDefinition.filterOperator', 'Filter operator')} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateReportFilter(index, { operator: event.target.value as ReportFilterOperator })
                                                }
                                            >
                                                {REPORT_FILTER_OPERATOR_OPTIONS.map((item) => (
                                                    <MenuItem key={item} value={item}>
                                                        {t(
                                                            `layouts.reportDefinition.filterOperators.${item}`,
                                                            REPORT_FILTER_OPERATOR_FALLBACK_LABELS[item]
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.filterValue', 'Filter value')} ${slotNumber}`}
                                            value={normalizeEditorScalarText(filter?.value)}
                                            onChange={(event) => updateReportFilter(index, { value: event.target.value })}
                                            fullWidth
                                        />
                                    </Stack>
                                )
                            })}
                            <Typography variant='caption' color='text.secondary'>
                                {t('layouts.reportDefinition.aggregations', 'Aggregations')}
                            </Typography>
                            {Array.from({ length: REPORT_AGGREGATION_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const aggregation = Array.isArray(reportDefinition?.aggregations)
                                    ? reportDefinition.aggregations[index]
                                    : undefined
                                const fn =
                                    aggregation?.function && REPORT_AGGREGATION_FUNCTION_OPTIONS.includes(aggregation.function)
                                        ? aggregation.function
                                        : 'count'
                                const functionLabelId = `report-definition-aggregation-function-${slotNumber}-label`
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.reportDefinition.aggregation', 'Aggregation')} {slotNumber}
                                        </Typography>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.aggregationField', 'Aggregation field')} ${slotNumber}`}
                                            value={normalizeDatasourceText(aggregation?.field)}
                                            onChange={(event) => updateReportAggregation(index, { field: event.target.value })}
                                            fullWidth
                                        />
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={functionLabelId}>
                                                {`${t(
                                                    'layouts.reportDefinition.aggregationFunction',
                                                    'Aggregation function'
                                                )} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={functionLabelId}
                                                value={fn}
                                                label={`${t(
                                                    'layouts.reportDefinition.aggregationFunction',
                                                    'Aggregation function'
                                                )} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateReportAggregation(index, {
                                                        function: event.target.value as ReportAggregationFunction
                                                    })
                                                }
                                            >
                                                {REPORT_AGGREGATION_FUNCTION_OPTIONS.map((item) => (
                                                    <MenuItem key={item} value={item}>
                                                        {t(
                                                            `layouts.reportDefinition.aggregationFunctions.${item}`,
                                                            REPORT_AGGREGATION_FUNCTION_FALLBACK_LABELS[item]
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.reportDefinition.aggregationAlias', 'Aggregation alias')} ${slotNumber}`}
                                            value={normalizeDatasourceText(aggregation?.alias)}
                                            onChange={(event) => updateReportAggregation(index, { alias: event.target.value })}
                                            fullWidth
                                        />
                                    </Stack>
                                )
                            })}
                        </Stack>
                    ) : null}
                    {isDetailsTableWidget ? (
                        <Stack spacing={1.5}>
                            <Typography variant='subtitle2'>{t('layouts.sequencePolicy.title', 'Sequence policy')}</Typography>
                            <FormControl size='small' fullWidth>
                                <InputLabel id='sequence-policy-mode-label'>{t('layouts.sequencePolicy.mode', 'Mode')}</InputLabel>
                                <Select
                                    labelId='sequence-policy-mode-label'
                                    id='sequence-policy-mode-select'
                                    value={sequenceMode}
                                    label={t('layouts.sequencePolicy.mode', 'Mode')}
                                    onChange={(event) =>
                                        updateSequencePolicy({
                                            mode: event.target.value as SequencePolicyMode
                                        })
                                    }
                                >
                                    {SEQUENCE_POLICY_MODES.map((mode) => (
                                        <MenuItem key={mode} value={mode}>
                                            {t(`layouts.sequencePolicy.modes.${mode}`, SEQUENCE_MODE_FALLBACK_LABELS[mode])}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {sequenceMode === 'sequential' ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.sequencePolicy.orderFieldCodename', 'Order field codename')}
                                    value={normalizeDatasourceText(sequencePolicy?.orderFieldCodename)}
                                    onChange={(event) => updateSequencePolicy({ orderFieldCodename: event.target.value })}
                                    fullWidth
                                />
                            ) : null}
                            {sequenceMode === 'scheduled' ? (
                                <>
                                    <TextField
                                        size='small'
                                        label={t('layouts.sequencePolicy.availableFromFieldCodename', 'Available from field codename')}
                                        value={normalizeDatasourceText(sequencePolicy?.availableFromFieldCodename)}
                                        onChange={(event) => updateSequencePolicy({ availableFromFieldCodename: event.target.value })}
                                        fullWidth
                                    />
                                    <TextField
                                        size='small'
                                        label={t('layouts.sequencePolicy.availableToFieldCodename', 'Available to field codename')}
                                        value={normalizeDatasourceText(sequencePolicy?.availableToFieldCodename)}
                                        onChange={(event) => updateSequencePolicy({ availableToFieldCodename: event.target.value })}
                                        fullWidth
                                    />
                                    <TextField
                                        size='small'
                                        label={t('layouts.sequencePolicy.dueAtFieldCodename', 'Due-at field codename')}
                                        value={normalizeDatasourceText(sequencePolicy?.dueAtFieldCodename)}
                                        onChange={(event) => updateSequencePolicy({ dueAtFieldCodename: event.target.value })}
                                        fullWidth
                                    />
                                </>
                            ) : null}
                            {sequenceMode === 'prerequisite' ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.sequencePolicy.prerequisiteFieldCodename', 'Prerequisite field codename')}
                                    value={normalizeDatasourceText(sequencePolicy?.prerequisiteFieldCodename)}
                                    onChange={(event) => updateSequencePolicy({ prerequisiteFieldCodename: event.target.value })}
                                    fullWidth
                                />
                            ) : null}
                            <TextField
                                size='small'
                                type='number'
                                label={t('layouts.sequencePolicy.retryLimit', 'Retry limit')}
                                value={normalizeDatasourceScalarText(sequencePolicy?.retryLimit)}
                                onChange={(event) => updateSequencePolicy({ retryLimit: event.target.value })}
                                inputProps={{ min: 0, max: 100 }}
                                fullWidth
                            />
                            <TextField
                                size='small'
                                type='number'
                                label={t('layouts.sequencePolicy.maxAttempts', 'Max attempts')}
                                value={normalizeDatasourceScalarText(sequencePolicy?.maxAttempts)}
                                onChange={(event) => updateSequencePolicy({ maxAttempts: event.target.value })}
                                inputProps={{ min: 1, max: 100 }}
                                fullWidth
                            />
                            <Typography variant='caption' color='text.secondary'>
                                {t('layouts.sequencePolicy.completionConditions', 'Completion conditions')}
                            </Typography>
                            {Array.from({ length: SEQUENCE_COMPLETION_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const condition = Array.isArray(sequencePolicy?.completion) ? sequencePolicy.completion[index] : undefined
                                const conditionKind =
                                    condition?.kind && COMPLETION_CONDITION_KIND_OPTIONS.includes(condition.kind)
                                        ? condition.kind
                                        : 'manual'
                                const conditionKindLabelId = `sequence-policy-condition-kind-${slotNumber}-label`
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.sequencePolicy.completionCondition', 'Condition')} {slotNumber}
                                        </Typography>
                                        <FormControl size='small' fullWidth>
                                            <InputLabel id={conditionKindLabelId}>
                                                {`${t('layouts.sequencePolicy.conditionKind', 'Condition kind')} ${slotNumber}`}
                                            </InputLabel>
                                            <Select
                                                labelId={conditionKindLabelId}
                                                value={conditionKind}
                                                label={`${t('layouts.sequencePolicy.conditionKind', 'Condition kind')} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateCompletionCondition(index, {
                                                        kind: event.target.value as CompletionConditionKind
                                                    })
                                                }
                                            >
                                                {COMPLETION_CONDITION_KIND_OPTIONS.map((kind) => (
                                                    <MenuItem key={kind} value={kind}>
                                                        {t(
                                                            `layouts.sequencePolicy.conditionKinds.${kind}`,
                                                            COMPLETION_CONDITION_KIND_FALLBACK_LABELS[kind]
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.sequencePolicy.conditionField', 'Condition field')} ${slotNumber}`}
                                            value={normalizeDatasourceText(condition?.field)}
                                            onChange={(event) => updateCompletionCondition(index, { field: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.sequencePolicy.conditionValue', 'Condition value')} ${slotNumber}`}
                                            value={normalizeEditorScalarText(condition?.value)}
                                            onChange={(event) => updateCompletionCondition(index, { value: event.target.value })}
                                            fullWidth
                                        />
                                    </Stack>
                                )
                            })}
                        </Stack>
                    ) : null}
                    {isOverviewCardsWidget ? (
                        <Stack spacing={2}>
                            <Typography variant='subtitle2'>{t('layouts.datasource.overviewCards', 'Overview card metrics')}</Typography>
                            {Array.from({ length: OVERVIEW_CARD_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const card = readOverviewCard(draft, index)
                                const metricKey = readOverviewCardMetricKey(card) ?? 'records.count'
                                const params = readOverviewCardDatasourceParams(card)
                                return (
                                    <Stack key={slotNumber} spacing={1.25}>
                                        <Typography variant='caption' color='text.secondary'>
                                            {t('layouts.datasource.overviewCard', 'Card')} {slotNumber}
                                        </Typography>
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.datasource.cardTitle', 'Card title')} ${slotNumber}`}
                                            value={normalizeDatasourceText(card.title)}
                                            onChange={(event) => updateOverviewCard(index, { title: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.datasource.cardValue', 'Fallback value')} ${slotNumber}`}
                                            value={normalizeDatasourceText(card.value)}
                                            onChange={(event) => updateOverviewCard(index, { value: event.target.value })}
                                            fullWidth
                                        />
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.datasource.cardInterval', 'Interval')} ${slotNumber}`}
                                            value={normalizeDatasourceText(card.interval)}
                                            onChange={(event) => updateOverviewCard(index, { interval: event.target.value })}
                                            fullWidth
                                        />
                                        <FormControl size='small' fullWidth>
                                            <InputLabel>{`${t('layouts.datasource.cardTrend', 'Trend')} ${slotNumber}`}</InputLabel>
                                            <Select
                                                value={normalizeTrend(card.trend) ?? 'neutral'}
                                                label={`${t('layouts.datasource.cardTrend', 'Trend')} ${slotNumber}`}
                                                onChange={(event) => updateOverviewCard(index, { trend: event.target.value })}
                                            >
                                                {TREND_OPTIONS.map((trend) => (
                                                    <MenuItem key={trend} value={trend}>
                                                        {t(`layouts.datasource.trend.${trend}`, trend)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' fullWidth>
                                            <InputLabel>{`${t(
                                                'layouts.datasource.cardMetricType',
                                                'Metric type'
                                            )} ${slotNumber}`}</InputLabel>
                                            <Select
                                                value={metricKey}
                                                label={`${t('layouts.datasource.cardMetricType', 'Metric type')} ${slotNumber}`}
                                                onChange={(event) =>
                                                    updateOverviewCardMetricKey(index, event.target.value as OverviewCardMetricKey)
                                                }
                                            >
                                                {OVERVIEW_CARD_METRIC_KEY_OPTIONS.map((option) => (
                                                    <MenuItem key={option.value} value={option.value}>
                                                        {t(option.labelKey, option.fallback)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        {metricKey === 'records.count' ? (
                                            <>
                                                <TextField
                                                    size='small'
                                                    label={`${t('layouts.datasource.cardSectionId', 'Metric section ID')} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.sectionId)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { sectionId: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                                {sectionOptions.length > 0 ? (
                                                    <FormControl size='small' fullWidth>
                                                        <InputLabel>{`${t(
                                                            'layouts.datasource.cardSectionPicker',
                                                            'Metric section'
                                                        )} ${slotNumber}`}</InputLabel>
                                                        <Select
                                                            value={
                                                                sectionOptions.some(
                                                                    (option) => option.id === normalizeDatasourceText(params.sectionId)
                                                                )
                                                                    ? normalizeDatasourceText(params.sectionId)
                                                                    : ''
                                                            }
                                                            label={`${t(
                                                                'layouts.datasource.cardSectionPicker',
                                                                'Metric section'
                                                            )} ${slotNumber}`}
                                                            onChange={(event) => updateOverviewCardMetricSection(index, event.target.value)}
                                                        >
                                                            <MenuItem value=''>
                                                                {t('layouts.datasource.sectionManual', 'Manual section reference')}
                                                            </MenuItem>
                                                            {sectionOptions.map((option) => (
                                                                <MenuItem key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : null}
                                                <TextField
                                                    size='small'
                                                    label={`${t(
                                                        'layouts.datasource.cardSectionCodename',
                                                        'Metric section codename'
                                                    )} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.sectionCodename)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { sectionCodename: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                                <TextField
                                                    size='small'
                                                    label={`${t('layouts.datasource.cardSearch', 'Metric search')} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.search)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { search: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                            </>
                                        ) : null}
                                        {metricKey === 'report.aggregation' ? (
                                            <>
                                                <TextField
                                                    size='small'
                                                    label={`${t('layouts.datasource.cardReportId', 'Report ID')} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.reportId)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { reportId: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                                <TextField
                                                    size='small'
                                                    label={`${t('layouts.datasource.cardReportCodename', 'Report codename')} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.reportCodename)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { reportCodename: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                                <TextField
                                                    size='small'
                                                    label={`${t(
                                                        'layouts.datasource.cardAggregationAlias',
                                                        'Aggregation alias'
                                                    )} ${slotNumber}`}
                                                    value={normalizeDatasourceText(params.aggregationAlias)}
                                                    onChange={(event) =>
                                                        updateOverviewCardMetricParams(index, { aggregationAlias: event.target.value })
                                                    }
                                                    fullWidth
                                                />
                                            </>
                                        ) : null}
                                    </Stack>
                                )
                            })}
                        </Stack>
                    ) : null}
                    {isResourcePreviewWidget ? (
                        <Stack spacing={1.5}>
                            <Typography variant='subtitle2'>{t('layouts.resourcePreview.title', 'Resource preview')}</Typography>
                            <TextField
                                size='small'
                                label={t('layouts.resourcePreview.displayTitle', 'Display title')}
                                value={normalizeDatasourceText(draft.title)}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        title: event.target.value
                                    }))
                                }
                                fullWidth
                            />
                            <TextField
                                size='small'
                                label={t('layouts.resourcePreview.description', 'Description')}
                                value={normalizeDatasourceText(draft.description)}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        description: event.target.value
                                    }))
                                }
                                fullWidth
                                multiline
                                minRows={2}
                            />
                            <FormControl size='small' fullWidth>
                                <InputLabel id='resource-preview-type-label'>
                                    {t('layouts.resourcePreview.type', 'Resource type')}
                                </InputLabel>
                                <Select
                                    labelId='resource-preview-type-label'
                                    id='resource-preview-type-select'
                                    value={resourceType}
                                    label={t('layouts.resourcePreview.type', 'Resource type')}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: event.target.value as ResourceType,
                                            launchMode: resourceLaunchMode
                                        })
                                    }
                                >
                                    {RESOURCE_TYPES.map((type) => (
                                        <MenuItem key={type} value={type}>
                                            {t(`layouts.resourcePreview.types.${type}`, RESOURCE_TYPE_FALLBACK_LABELS[type])}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size='small' fullWidth>
                                <InputLabel id='resource-preview-launch-mode-label'>
                                    {t('layouts.resourcePreview.launchMode', 'Launch mode')}
                                </InputLabel>
                                <Select
                                    labelId='resource-preview-launch-mode-label'
                                    id='resource-preview-launch-mode-select'
                                    value={resourceLaunchMode}
                                    label={t('layouts.resourcePreview.launchMode', 'Launch mode')}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: resourceType,
                                            launchMode: event.target.value as ResourceLaunchMode
                                        })
                                    }
                                >
                                    {RESOURCE_LAUNCH_MODES.map((mode) => (
                                        <MenuItem key={mode} value={mode}>
                                            {t(`layouts.resourcePreview.launchModes.${mode}`, RESOURCE_LAUNCH_MODE_FALLBACK_LABELS[mode])}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {resourceType === 'page' ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.resourcePreview.pageCodename', 'Page codename')}
                                    value={normalizeDatasourceText(resourceSource?.pageCodename)}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: 'page',
                                            pageCodename: event.target.value,
                                            launchMode: resourceLaunchMode
                                        })
                                    }
                                    fullWidth
                                />
                            ) : null}
                            {URL_RESOURCE_TYPES.has(resourceType) ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.resourcePreview.url', 'URL')}
                                    value={normalizeDatasourceText(resourceSource?.url)}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: resourceType,
                                            url: event.target.value,
                                            launchMode: resourceLaunchMode
                                        })
                                    }
                                    fullWidth
                                />
                            ) : null}
                            {STORAGE_RESOURCE_TYPES.has(resourceType) ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.resourcePreview.storageKey', 'Storage key')}
                                    value={normalizeDatasourceText(resourceSource?.storageKey)}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: resourceType,
                                            storageKey: event.target.value,
                                            launchMode: resourceLaunchMode
                                        })
                                    }
                                    fullWidth
                                />
                            ) : null}
                            {MIME_RESOURCE_TYPES.has(resourceType) ? (
                                <TextField
                                    size='small'
                                    label={t('layouts.resourcePreview.mimeType', 'MIME type')}
                                    value={normalizeDatasourceText(resourceSource?.mimeType)}
                                    onChange={(event) =>
                                        updateResourceSource({
                                            type: resourceType,
                                            mimeType: event.target.value,
                                            launchMode: resourceLaunchMode
                                        })
                                    }
                                    fullWidth
                                />
                            ) : null}
                        </Stack>
                    ) : null}
                    <ApplicationLayoutSharedBehaviorFields value={draft} onChange={setDraft} />
                </Stack>
            )}
        />
    )
}
