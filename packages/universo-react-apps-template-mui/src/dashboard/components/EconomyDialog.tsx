import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { EconomyCargoEntry, EconomyMarketEntry, EconomyOperationEntry, EconomySummary } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { fetchRuntimeEconomySummary, postEconomyTrade } from '../../api/api'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { RuntimeWidgetStatus } from './RuntimeWidgetStatus'
import StandardDialog from '../../components/dialogs/StandardDialog'

type EconomyTradeSide = 'sell' | 'buy'

type EconomyTradeInput = {
    kind: EconomyTradeSide
    nomenclatureCode: string
    quantity: number
    idempotencyKey: string
}

const ECONOMY_SUMMARY_REFETCH_INTERVAL_MS = 15_000

/** Localized type labels for the recent-operations feed (TZ §7 OperationType values). */
const OPERATION_TYPE_KEYS: Record<string, string> = {
    StarterGrant: 'starterGrant',
    Sell: 'sell',
    Buy: 'buy',
    Mine: 'mine',
    Fee: 'fee'
}

/**
 * Codename-keyed display labels for the fixed economy vocabulary (the exact
 * mechanism as OPERATION_TYPE_KEYS below): codes are stable fixture contract
 * keys, localized names resolve through `dashboard.widget.economy.*`. Unknown
 * codes fall back to the server-resolved name / raw unit.
 */
const NOMENCLATURE_LABEL_KEYS: Record<string, string> = {
    ORE: 'ore',
    FUEL: 'fuel'
}

const UNIT_LABEL_KEYS: Record<string, string> = {
    Kg: 'kg',
    Liter: 'liter',
    Unit: 'unit',
    M3: 'm3'
}

const formatNomenclatureLabel = (code: string, fallbackName: string, t: TFunction<'apps'>): string => {
    const key = NOMENCLATURE_LABEL_KEYS[code]
    return key ? t(`dashboard.widget.economy.nomenclature.${key}`) : fallbackName
}

const formatUnitLabel = (unit: string, t: TFunction<'apps'>): string => {
    const key = UNIT_LABEL_KEYS[unit]
    return key ? t(`dashboard.widget.economy.units.${key}`) : unit
}

const createNumberFormatter = (locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat => {
    try {
        return new Intl.NumberFormat(locale, options)
    } catch {
        return new Intl.NumberFormat('en', options)
    }
}

const formatAmount = (value: number, locale: string): string => createNumberFormatter(locale, { maximumFractionDigits: 2 }).format(value)

/** Currency codes in the payload are authored values (e.g. `CR`) and may not be ISO 4217 — fall back to a suffix. */
const formatCurrencyAmount = (value: number, currency: string, locale: string): string => {
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value)
    } catch {
        return `${formatAmount(value, locale)} ${currency}`
    }
}

const formatOperationTimestamp = (value: string, locale: string): string => {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return value
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    } catch {
        return date.toISOString()
    }
}

/** Known `ECONOMY_*` codes resolve through `runtime.economyErrors.*`; anything else stays generic (no internals leak). */
const localizeEconomyError = (error: unknown, t: TFunction<'apps'>): string => {
    const candidate = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : null
    const code = typeof candidate === 'string' && candidate.startsWith('ECONOMY_') ? candidate : null
    if (!code) return t('runtime.economyErrors.generic')
    const serverMessage = error instanceof Error && error.message.trim().length > 0 ? error.message : undefined
    return t(`runtime.economyErrors.${code}`, { defaultValue: serverMessage })
}

const parseTradeQuantity = (value: string): number | null => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const formatOperationTypeLabel = (type: string, t: TFunction<'apps'>): string => {
    const key = OPERATION_TYPE_KEYS[type]
    return key ? t(`dashboard.widget.economy.operationTypes.${key}`) : type.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

function CargoSection({ entries, locale }: { entries: EconomyCargoEntry[]; locale: string }) {
    const { t } = useTranslation('apps')
    return (
        <Stack spacing={0.5} data-testid='economy-cargo-list'>
            <Typography variant='subtitle2'>{t('dashboard.widget.economy.cargo')}</Typography>
            {entries.length === 0 ? (
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t('dashboard.widget.emptyValue')}
                </Typography>
            ) : (
                entries.map((entry) => (
                    <Typography key={entry.nomenclatureCode} variant='body2' sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {`${formatNomenclatureLabel(entry.nomenclatureCode, entry.nomenclatureName, t)} — ${formatAmount(
                            entry.quantity,
                            locale
                        )} ${formatUnitLabel(entry.unit, t)} (${formatAmount(entry.massKg, locale)} ${t(
                            'dashboard.widget.economy.massUnit'
                        )})`}
                    </Typography>
                ))
            )}
        </Stack>
    )
}

function CapacitySection({ usedKg, maxKg, locale }: { usedKg: number; maxKg: number; locale: string }) {
    const { t } = useTranslation('apps')
    const percent = maxKg > 0 ? Math.min(100, Math.max(0, (usedKg / maxKg) * 100)) : 0
    return (
        <Stack spacing={0.5}>
            <Typography variant='subtitle2'>{t('dashboard.widget.economy.capacity')}</Typography>
            <Typography variant='body2'>
                {t('dashboard.widget.economy.capacityValue', {
                    used: formatAmount(usedKg, locale),
                    max: formatAmount(maxKg, locale)
                })}
            </Typography>
            <LinearProgress data-testid='economy-capacity-bar' variant='determinate' value={percent} />
        </Stack>
    )
}

function OperationsSection({ operations, locale }: { operations: EconomyOperationEntry[]; locale: string }) {
    const { t } = useTranslation('apps')
    return (
        <Stack spacing={0.5} data-testid='economy-operations-list'>
            <Typography variant='subtitle2'>{t('dashboard.widget.economy.operations')}</Typography>
            {operations.length === 0 ? (
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t('dashboard.widget.economy.operationsEmpty')}
                </Typography>
            ) : (
                operations.map((operation) => (
                    <Typography key={operation.id} variant='body2' sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {[
                            formatOperationTypeLabel(operation.type, t),
                            formatAmount(operation.quantity, locale),
                            formatAmount(operation.total, locale),
                            formatOperationTimestamp(operation.occurredAt, locale)
                        ].join(' · ')}
                    </Typography>
                ))
            )}
        </Stack>
    )
}

type MarketRowProps = {
    entry: EconomyMarketEntry
    showsTradeControls: boolean
    quantity: string
    quantityInvalid: boolean
    disabledReason: string | null
    isPending: boolean
    locale: string
    onQuantityChange: (value: string) => void
    onTrade: () => void
}

function MarketRow({
    entry,
    showsTradeControls,
    quantity,
    quantityInvalid,
    disabledReason,
    isPending,
    locale,
    onQuantityChange,
    onTrade
}: MarketRowProps) {
    const { t } = useTranslation('apps')
    const sideLabel = t(`dashboard.widget.economy.${entry.side}`)
    const isDisabled = disabledReason !== null || quantityInvalid || quantity.trim() === '' || isPending

    return (
        <Stack spacing={1}>
            <Stack direction='row' spacing={1} useFlexGap sx={{ alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
                <Typography variant='body2' sx={{ fontWeight: 500, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {formatNomenclatureLabel(entry.nomenclatureCode, entry.nomenclatureName, t)}
                </Typography>
                <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                    {`${sideLabel} · ${formatAmount(entry.price, locale)} / ${formatUnitLabel(entry.unit, t)}`}
                </Typography>
            </Stack>
            {showsTradeControls ? (
                <Stack direction='row' spacing={1} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap', minWidth: 0 }}>
                    <TextField
                        slotProps={{ htmlInput: { 'data-testid': `economy-${entry.side}-quantity`, min: 0, step: 0.1 } }}
                        type='number'
                        label={t('dashboard.widget.economy.quantityLabel')}
                        value={quantity}
                        onChange={(event) => onQuantityChange(event.target.value)}
                        error={quantityInvalid}
                        helperText={
                            quantityInvalid ? t('dashboard.widget.economy.quantityError') : t('dashboard.widget.economy.quantityHelper')
                        }
                        disabled={disabledReason !== null}
                        sx={{ maxWidth: 200 }}
                    />
                    <Tooltip title={disabledReason ?? ''} disableHoverListener={!disabledReason}>
                        <span>
                            <Button
                                data-testid={`economy-${entry.side}-button`}
                                type='button'
                                variant='contained'
                                disabled={isDisabled}
                                onClick={onTrade}
                            >
                                {sideLabel}
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            ) : null}
        </Stack>
    )
}

export interface EconomyDialogProps {
    open: boolean
    onClose: () => void
}

/**
 * Economy UI for the flight application (MMOOMM plan D2/UI Contract): wallet,
 * cargo, capacity, market trades, recent operations — opened from the flight
 * canvas toolbar in the canonical strict-modal dialog instead of a permanently
 * mounted zone widget (QA 2026-11-16 user feedback).
 *
 * The summary query only polls while the dialog is open.
 */
export default function EconomyDialog({ open, onClose }: EconomyDialogProps) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()

    // Empty-string defaults keep the fetch/mutation signatures non-null; the
    // `canFetch` gate (and `enabled: canFetch`) guarantees they are populated
    // whenever a request is actually issued.
    const apiBaseUrl = details?.apiBaseUrl ?? ''
    const applicationId = details?.applicationId ?? ''
    const locale = details?.locale ?? 'en'
    const canFetch = Boolean(apiBaseUrl && applicationId && details?.runtimeAccessMode !== 'public')
    const queryKeyPrefix = details?.runtimeQueryKeyPrefix ?? ['economy']

    const summaryQuery = useQuery({
        queryKey: [
            ...queryKeyPrefix,
            'economy-summary',
            apiBaseUrl,
            applicationId,
            { locale, workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: ({ signal }) => fetchRuntimeEconomySummary(apiBaseUrl, applicationId, signal),
        // Poll only while the dialog is visible — a closed dialog must not keep
        // issuing summary requests in the background.
        enabled: canFetch && open,
        refetchInterval: open ? ECONOMY_SUMMARY_REFETCH_INTERVAL_MS : false
    })

    const [sellQuantity, setSellQuantity] = useState('')
    const [buyQuantity, setBuyQuantity] = useState('')
    const [tradeError, setTradeError] = useState<string | null>(null)

    const tradeMutation = useMutation({
        mutationFn: (input: EconomyTradeInput) =>
            postEconomyTrade(
                apiBaseUrl,
                applicationId,
                input.kind,
                { nomenclatureCode: input.nomenclatureCode, quantity: input.quantity },
                input.idempotencyKey
            ),
        onSuccess: async () => {
            // Invalidate the whole summary family (D10) so the balance, cargo
            // and operations feed reflect the posted trade immediately.
            await queryClient.invalidateQueries({ queryKey: [...queryKeyPrefix, 'economy-summary'] })
        },
        onError: (error) => setTradeError(localizeEconomyError(error, t))
    })

    const renderContent = () => {
        // Every dialog state keeps the `economy-panel` testid so the E2E oracles
        // can address the surface regardless of the loading/permission state.
        if (!canFetch) {
            return (
                <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='economy-panel'>
                    <RuntimeWidgetStatus
                        state={{ status: details?.runtimeAccessMode === 'public' ? 'permission-denied' : 'required-missing' }}
                    />
                </Stack>
            )
        }
        if (summaryQuery.isPending) {
            // No `economy-panel` testid while loading: callers awaiting the panel
            // testid must keep waiting for a rendered (or errored) surface.
            return <RuntimeWidgetStatus state={{ status: 'loading' }} />
        }
        if (summaryQuery.isError || !summaryQuery.data) {
            return (
                <Stack spacing={1.5} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='economy-panel'>
                    <Alert severity='error' role='alert' data-testid='economy-error'>
                        {summaryQuery.isError ? localizeEconomyError(summaryQuery.error, t) : t('runtime.economyErrors.generic')}
                    </Alert>
                    <Button type='button' variant='outlined' onClick={() => summaryQuery.refetch()}>
                        {t('runtime.retry')}
                    </Button>
                </Stack>
            )
        }

        const summary: EconomySummary = summaryQuery.data
        // Trade buttons stay available unless the host explicitly denies edit
        // permissions (UI Contract permission gate); station proximity gates the rest.
        const tradeDisabledReason =
            details?.permissions?.editContent === false
                ? t('dashboard.widget.economy.noPermission')
                : !summary.atStation
                ? t('dashboard.widget.economy.outOfStationTooltip')
                : null

        const firstMarketEntryKeyBySide = new Map<EconomyTradeSide, string>()
        for (const entry of summary.market) {
            const entryKey = `${entry.side}:${entry.nomenclatureCode}`
            if (!firstMarketEntryKeyBySide.has(entry.side)) firstMarketEntryKeyBySide.set(entry.side, entryKey)
        }

        const handleTrade = (side: EconomyTradeSide, entry: EconomyMarketEntry, quantity: string) => {
            const parsedQuantity = parseTradeQuantity(quantity)
            if (!parsedQuantity || tradeMutation.isPending) return
            setTradeError(null)
            tradeMutation.reset()
            // One UUID v7 per logical click, passed through variables so TanStack
            // retries of this mutation reuse the same key (plan D10).
            tradeMutation.mutate({
                kind: side,
                nomenclatureCode: entry.nomenclatureCode,
                quantity: parsedQuantity,
                idempotencyKey: generateUuidV7()
            })
        }

        const quantityInvalidFor = (value: string): boolean => value.trim() !== '' && parseTradeQuantity(value) === null

        return (
            <Stack spacing={2} sx={{ minWidth: 0, maxWidth: '100%' }} data-testid='economy-panel'>
                {tradeError ? (
                    <Alert severity='error' role='alert' data-testid='economy-error'>
                        {tradeError}
                    </Alert>
                ) : null}
                {tradeMutation.isSuccess && !tradeError ? (
                    <Alert severity='success' role='status'>
                        {t('dashboard.widget.economy.tradeSuccess')}
                    </Alert>
                ) : null}
                <Stack spacing={0.5}>
                    <Typography variant='subtitle2'>{t('dashboard.widget.economy.wallet')}</Typography>
                    <Typography variant='h6' data-testid='economy-balance'>
                        {formatCurrencyAmount(summary.wallet.balance, summary.wallet.currency, locale)}
                    </Typography>
                </Stack>
                <CargoSection entries={summary.cargo} locale={locale} />
                <CapacitySection usedKg={summary.capacity.usedKg} maxKg={summary.capacity.maxKg} locale={locale} />
                <Stack spacing={1.5} data-testid='economy-market-list'>
                    <Typography variant='subtitle2'>{t('dashboard.widget.economy.market')}</Typography>
                    {summary.atStation && summary.stationName ? (
                        <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                            {t('dashboard.widget.economy.atStationHint', { station: summary.stationName })}
                        </Typography>
                    ) : null}
                    {summary.market.map((entry) => {
                        const entryKey = `${entry.side}:${entry.nomenclatureCode}`
                        const quantity = entry.side === 'sell' ? sellQuantity : buyQuantity
                        return (
                            <MarketRow
                                key={entryKey}
                                entry={entry}
                                showsTradeControls={firstMarketEntryKeyBySide.get(entry.side) === entryKey}
                                quantity={quantity}
                                quantityInvalid={quantityInvalidFor(quantity)}
                                disabledReason={tradeDisabledReason}
                                isPending={tradeMutation.isPending}
                                locale={locale}
                                onQuantityChange={(value) => (entry.side === 'sell' ? setSellQuantity(value) : setBuyQuantity(value))}
                                onTrade={() => handleTrade(entry.side, entry, quantity)}
                            />
                        )
                    })}
                </Stack>
                <OperationsSection operations={summary.operations} locale={locale} />
            </Stack>
        )
    }

    return (
        <StandardDialog open={open} onClose={onClose} title={t('dashboard.widget.economy.title')} maxWidth='sm' fullWidth>
            {renderContent()}
            <Stack direction='row' sx={{ pt: 2, justifyContent: 'flex-end' }}>
                <Button type='button' variant='outlined' onClick={onClose} data-testid='economy-dialog-close'>
                    {t('dashboard.widget.economy.close')}
                </Button>
            </Stack>
        </StandardDialog>
    )
}
