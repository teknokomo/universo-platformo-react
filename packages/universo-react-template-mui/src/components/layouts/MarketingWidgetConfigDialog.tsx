import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import {
    MARKETING_COLLECTION_VARIANTS,
    marketingWidgetSourceCodenames,
    parseApplicationLayoutWidgetConfig,
    type MarketingCollectionVariant,
    type MarketingSourceCodename,
    type MarketingWidgetKey
} from '@universo-react/types'
import { StandardDialog } from '../dialogs/StandardDialog'

export type MarketingWidgetSourceOption = {
    value: string
    label: string
    entityKind?: 'hub' | 'object' | 'page' | 'set' | 'enumeration'
}

export type MarketingWidgetConfigDialogProps = {
    open: boolean
    widgetKey: MarketingWidgetKey
    initialConfig?: Record<string, unknown> | null
    sourceOptions?: readonly MarketingWidgetSourceOption[]
    title: string
    t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
    onSave: (config: Record<string, unknown>) => void | Promise<void>
    onCancel: () => void
}

type MarketingWidgetSourceDraft = {
    entityCodename: string
    entityKind: MarketingWidgetSourceOption['entityKind']
    recordKey: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readSourceDraft = (config: Record<string, unknown> | null | undefined): MarketingWidgetSourceDraft => {
    const source = isRecord(config?.source) ? config.source : {}
    return {
        entityCodename: typeof source.entityCodename === 'string' ? source.entityCodename : '',
        entityKind:
            source.entityKind === 'hub' ||
            source.entityKind === 'object' ||
            source.entityKind === 'page' ||
            source.entityKind === 'set' ||
            source.entityKind === 'enumeration'
                ? source.entityKind
                : 'object',
        recordKey: typeof source.recordKey === 'string' ? source.recordKey : ''
    }
}

const buildInitialConfig = (widgetKey: MarketingWidgetKey, config?: Record<string, unknown> | null): Record<string, unknown> => {
    const rawConfig = isRecord(config) ? { ...config } : {}
    const existingInstanceKey = typeof rawConfig.instanceKey === 'string' && rawConfig.instanceKey.trim() ? rawConfig.instanceKey : null
    delete rawConfig.instanceKey

    return {
        ...(existingInstanceKey ? { instanceKey: existingInstanceKey } : {}),
        source: readSourceDraft(config),
        ...rawConfig,
        ...(widgetKey === 'marketing.collection' && config?.variant === undefined ? { variant: 'logos' } : {})
    }
}

const getNumericValue = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const widgetHasField = (widgetKey: MarketingWidgetKey, field: string): boolean => {
    if (widgetKey === 'marketing.navigation') return field === 'showAuthActions' || field === 'maxItems'
    if (widgetKey === 'marketing.hero') return field === 'showLeadForm'
    if (widgetKey === 'marketing.collection') return ['variant', 'maxItems', 'showTitle', 'showDescription'].includes(field)
    if (widgetKey === 'marketing.pricing') return field === 'maxItems' || field === 'showBenefits'
    return field === 'maxItems' || field === 'showNewsletter'
}

export function MarketingWidgetConfigDialog({
    open,
    widgetKey,
    initialConfig,
    sourceOptions = [],
    title,
    t,
    onSave,
    onCancel
}: MarketingWidgetConfigDialogProps) {
    const [draft, setDraft] = useState<Record<string, unknown>>(() => buildInitialConfig(widgetKey, initialConfig))
    const [sourceDraft, setSourceDraft] = useState<MarketingWidgetSourceDraft>(() => readSourceDraft(initialConfig))
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        const nextDraft = buildInitialConfig(widgetKey, initialConfig)
        setDraft(nextDraft)
        setSourceDraft(readSourceDraft(nextDraft))
        setSubmitError(null)
        setIsSaving(false)
    }, [initialConfig, open, widgetKey])

    const availableSources = useMemo(() => {
        const variant = MARKETING_COLLECTION_VARIANTS.find((item) => item === draft.variant) as MarketingCollectionVariant | undefined
        const allowedCodenames = new Set(marketingWidgetSourceCodenames(widgetKey, variant))
        const values = sourceOptions.filter(
            (option) => option.entityKind === 'object' && allowedCodenames.has(option.value as MarketingSourceCodename)
        )
        return values
    }, [draft.variant, sourceOptions, widgetKey])

    const updateDraft = (key: string, value: unknown) => {
        setDraft((current) => ({ ...current, [key]: value }))
        setSubmitError(null)
    }

    const updateSource = (patch: Partial<MarketingWidgetSourceDraft>) => {
        setSourceDraft((current) => ({
            ...current,
            ...patch,
            ...(patch.entityCodename && patch.entityCodename !== current.entityCodename ? { recordKey: '' } : {})
        }))
        setSubmitError(null)
    }

    const handleSave = async () => {
        const sourceCodename = sourceDraft.entityCodename.trim()
        if (isSaving || !sourceCodename || !availableSources.some((option) => option.value === sourceCodename)) return
        const source: Record<string, unknown> = {
            ...(isRecord(draft.source) ? draft.source : {}),
            entityCodename: sourceCodename,
            entityKind: sourceDraft.entityKind ?? 'object'
        }
        delete source.recordKey
        if (sourceDraft.recordKey.trim()) source.recordKey = sourceDraft.recordKey.trim()
        const candidate: Record<string, unknown> = { ...draft, source }
        let config: Record<string, unknown>
        try {
            config =
                typeof candidate.instanceKey === 'string' && candidate.instanceKey.trim()
                    ? parseApplicationLayoutWidgetConfig(widgetKey, candidate)
                    : candidate
        } catch {
            setSubmitError(t('layouts.marketing.widget.invalidConfig', 'Review the widget source and settings before saving.'))
            return
        }
        setIsSaving(true)
        setSubmitError(null)
        try {
            await onSave(config)
        } catch {
            setSubmitError(t('layouts.marketing.widget.saveError', 'The widget settings could not be saved. Try again.'))
        } finally {
            setIsSaving(false)
        }
    }

    const sourceSelectValue = availableSources.some((option) => option.value === sourceDraft.entityCodename)
        ? sourceDraft.entityCodename
        : ''
    const sourceIsUnavailable =
        sourceDraft.entityCodename.trim().length > 0 && !availableSources.some((option) => option.value === sourceDraft.entityCodename)
    const sourceIsRequired = sourceDraft.entityCodename.trim().length === 0 || sourceIsUnavailable

    return (
        <StandardDialog
            open={open}
            onClose={isSaving ? () => undefined : onCancel}
            title={title}
            maxWidth='sm'
            dialogContentProps={{ dividers: true }}
            actions={
                <>
                    <Button onClick={onCancel} disabled={isSaving}>
                        {t('common:actions.cancel', 'Cancel')}
                    </Button>
                    <Button variant='contained' onClick={() => void handleSave()} disabled={sourceIsRequired || isSaving}>
                        {isSaving ? t('common:actions.saving', 'Saving...') : t('common:actions.save', 'Save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} data-testid='marketing-widget-config-dialog'>
                {submitError ? <Alert severity='error'>{submitError}</Alert> : null}
                {sourceIsUnavailable ? (
                    <Alert severity='warning'>
                        {t(
                            'layouts.marketing.widget.sourceUnavailable',
                            'The previously selected content source is no longer available. Choose a published Object entity source.'
                        )}
                    </Alert>
                ) : null}
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {t(
                        'layouts.marketing.widget.sourceHelper',
                        'Choose a standard entity source. The runtime resolves records through published metadata and never accepts a table name.'
                    )}
                </Typography>
                <FormControl fullWidth size='small' required disabled={availableSources.length === 0}>
                    <InputLabel id='marketing-widget-source-label'>{t('layouts.marketing.widget.source', 'Content source')}</InputLabel>
                    <Select
                        labelId='marketing-widget-source-label'
                        value={sourceSelectValue}
                        label={t('layouts.marketing.widget.source', 'Content source')}
                        onChange={(event) => {
                            const option = availableSources.find((item) => item.value === event.target.value)
                            updateSource({
                                entityCodename: event.target.value,
                                entityKind: option?.entityKind ?? 'object'
                            })
                        }}
                    >
                        {availableSources.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {availableSources.length === 0 ? (
                    <Alert severity='info'>
                        {t(
                            'layouts.marketing.widget.noCompatibleSources',
                            'No compatible Object entity source is available for this widget. Create or publish the matching entity type first.'
                        )}
                    </Alert>
                ) : null}
                <Box
                    data-testid='marketing-widget-record-selection'
                    sx={{
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        px: 1.5,
                        py: 1
                    }}
                >
                    <Typography variant='subtitle2'>{t('layouts.marketing.widget.recordSelection', 'Record selection')}</Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {sourceDraft.recordKey.trim()
                            ? t('layouts.marketing.widget.recordSelectionManaged', 'The published source manages the selected record.')
                            : t(
                                  'layouts.marketing.widget.recordSelectionDefault',
                                  'The published source determines which records are shown.'
                              )}
                    </Typography>
                </Box>

                {widgetKey === 'marketing.collection' ? (
                    <FormControl fullWidth size='small'>
                        <InputLabel id='marketing-widget-collection-variant-label'>
                            {t('layouts.marketing.widget.variant', 'Collection type')}
                        </InputLabel>
                        <Select
                            labelId='marketing-widget-collection-variant-label'
                            value={String(draft.variant ?? 'logos')}
                            label={t('layouts.marketing.widget.variant', 'Collection type')}
                            onChange={(event) => updateDraft('variant', event.target.value)}
                        >
                            {(['logos', 'features', 'testimonials', 'highlights', 'faq'] as const).map((variant) => (
                                <MenuItem key={variant} value={variant}>
                                    {t(`layouts.marketing.widget.variants.${variant}`, variant)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}

                {widgetHasField(widgetKey, 'maxItems') ? (
                    <TextField
                        fullWidth
                        size='small'
                        type='number'
                        label={t('layouts.marketing.widget.maxItems', 'Maximum items')}
                        value={getNumericValue(draft.maxItems, 24)}
                        slotProps={{ htmlInput: { min: 1, max: widgetKey === 'marketing.collection' ? 1000 : 100 } }}
                        onChange={(event) => updateDraft('maxItems', Number(event.target.value))}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showTitle') ? (
                    <FormControlLabel
                        control={<Switch checked={draft.showTitle !== false} onChange={(_, value) => updateDraft('showTitle', value)} />}
                        label={t('layouts.marketing.widget.showTitle', 'Show title')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showDescription') ? (
                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.showDescription !== false}
                                onChange={(_, value) => updateDraft('showDescription', value)}
                            />
                        }
                        label={t('layouts.marketing.widget.showDescription', 'Show description')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showAuthActions') ? (
                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.showAuthActions !== false}
                                onChange={(_, value) => updateDraft('showAuthActions', value)}
                            />
                        }
                        label={t('layouts.marketing.widget.showAuthActions', 'Show authentication actions')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showLeadForm') ? (
                    <FormControlLabel
                        control={
                            <Switch checked={draft.showLeadForm !== false} onChange={(_, value) => updateDraft('showLeadForm', value)} />
                        }
                        label={t('layouts.marketing.widget.showLeadForm', 'Show lead form')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showBenefits') ? (
                    <FormControlLabel
                        control={
                            <Switch checked={draft.showBenefits !== false} onChange={(_, value) => updateDraft('showBenefits', value)} />
                        }
                        label={t('layouts.marketing.widget.showBenefits', 'Show plan benefits')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'showNewsletter') ? (
                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.showNewsletter !== false}
                                onChange={(_, value) => updateDraft('showNewsletter', value)}
                            />
                        }
                        label={t('layouts.marketing.widget.showNewsletter', 'Show newsletter block')}
                    />
                ) : null}
                <Box>
                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                        {t(
                            'layouts.marketing.widget.instanceKeyHelper',
                            'Widget identity is assigned by the server when this widget is created and preserved when settings are edited.'
                        )}
                    </Typography>
                </Box>
            </Stack>
        </StandardDialog>
    )
}

export default MarketingWidgetConfigDialog
