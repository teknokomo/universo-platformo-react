import { useEffect, useState } from 'react'
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { EntityFormDialog } from '@universo/template-mui'
import type { RuntimeDatasourceDescriptor } from '@universo/types'
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

const DETAILS_TABLE_DATASOURCE_KIND_OPTIONS: Array<{ value: EditableDatasourceKind; labelKey: string; fallback: string }> = [
    { value: 'current', labelKey: 'layouts.datasource.currentSection', fallback: 'Current runtime section' },
    { value: 'records.list', labelKey: 'layouts.datasource.recordsList', fallback: 'Records list' },
    { value: 'ledger.facts', labelKey: 'layouts.datasource.ledgerFacts', fallback: 'Ledger facts' },
    { value: 'ledger.projection', labelKey: 'layouts.datasource.ledgerProjection', fallback: 'Ledger projection' }
]
const CHART_DATASOURCE_KIND_OPTIONS = DETAILS_TABLE_DATASOURCE_KIND_OPTIONS.filter((option) => option.value !== 'ledger.facts')

const CHART_WIDGET_KEYS = new Set(['sessionsChart', 'pageViewsChart'])
const OVERVIEW_CARD_EDITOR_SLOTS = 4
const TREND_OPTIONS = ['up', 'down', 'neutral'] as const

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readDatasource = (config: Record<string, unknown>): Partial<RuntimeDatasourceDescriptor> | null => {
    const value = config.datasource
    return isRecord(value) ? (value as Partial<RuntimeDatasourceDescriptor>) : null
}

const normalizeDatasourceText = (value: unknown): string => (typeof value === 'string' ? value : '')
const normalizeDatasourceScalarText = (value: unknown): string =>
    typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''

const normalizePositiveInt = (value: unknown): number | undefined => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    if (!Number.isInteger(parsed) || parsed < 1) return undefined
    return Math.min(parsed, 100)
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

const normalizeDetailsTableConfig = (config: Record<string, unknown>): Record<string, unknown> => {
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

const readOverviewCardDatasourceParams = (card: Record<string, unknown>): Record<string, unknown> => {
    const datasource = card.datasource
    if (!isRecord(datasource) || datasource.kind !== 'metric' || datasource.metricKey !== 'records.count') return {}
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
            const params = readOverviewCardDatasourceParams(card)
            const sectionId = normalizeDatasourceText(params.sectionId).trim()
            const sectionCodename = normalizeDatasourceText(params.sectionCodename).trim()
            const linkedCollectionId = normalizeDatasourceText(params.linkedCollectionId).trim()
            const linkedCollectionCodename = normalizeDatasourceText(params.linkedCollectionCodename).trim()
            const search = normalizeDatasourceText(params.search).trim()
            const hasDatasource = Boolean(sectionId || sectionCodename || linkedCollectionId || linkedCollectionCodename || search)
            const next: Record<string, unknown> = {
                ...(title ? { title } : {}),
                ...(value ? { value } : {}),
                ...(interval ? { interval } : {}),
                ...(trend ? { trend } : {})
            }

            if (Array.isArray(card.data) && card.data.every((item) => typeof item === 'number' && Number.isFinite(item))) {
                next.data = card.data
            }
            if (hasDatasource) {
                next.datasource = {
                    kind: 'metric',
                    metricKey: 'records.count',
                    params: {
                        ...(sectionId ? { sectionId } : {}),
                        ...(sectionCodename ? { sectionCodename } : {}),
                        ...(linkedCollectionId ? { linkedCollectionId } : {}),
                        ...(linkedCollectionCodename ? { linkedCollectionCodename } : {}),
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
    const showDatasourceFields = isDetailsTableWidget || isChartWidget
    const datasourceKindOptions = isChartWidget ? CHART_DATASOURCE_KIND_OPTIONS : DETAILS_TABLE_DATASOURCE_KIND_OPTIONS
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
    const updateOverviewCardMetricParams = (index: number, patch: Record<string, unknown>) => {
        setDraft((current) => {
            const cards = readOverviewCards(current)
            while (cards.length <= index) {
                cards.push({})
            }
            const card = cards[index]
            const params = readOverviewCardDatasourceParams(card)
            cards[index] = {
                ...card,
                datasource: {
                    kind: 'metric',
                    metricKey: 'records.count',
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
        return draft
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
                    {isOverviewCardsWidget ? (
                        <Stack spacing={2}>
                            <Typography variant='subtitle2'>{t('layouts.datasource.overviewCards', 'Overview card metrics')}</Typography>
                            {Array.from({ length: OVERVIEW_CARD_EDITOR_SLOTS }, (_, index) => {
                                const slotNumber = index + 1
                                const card = readOverviewCard(draft, index)
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
                                        <TextField
                                            size='small'
                                            label={`${t('layouts.datasource.cardSectionId', 'Metric section ID')} ${slotNumber}`}
                                            value={normalizeDatasourceText(params.sectionId)}
                                            onChange={(event) => updateOverviewCardMetricParams(index, { sectionId: event.target.value })}
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
                                                    label={`${t('layouts.datasource.cardSectionPicker', 'Metric section')} ${slotNumber}`}
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
                                            onChange={(event) => updateOverviewCardMetricParams(index, { search: event.target.value })}
                                            fullWidth
                                        />
                                    </Stack>
                                )
                            })}
                        </Stack>
                    ) : null}
                    <ApplicationLayoutSharedBehaviorFields value={draft} onChange={setDraft} />
                </Stack>
            )}
        />
    )
}
