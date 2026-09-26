import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import { DropdownSelect as Select } from '../dropdowns'
import {
    MARKETING_COLLECTION_VARIANTS,
    MARKETING_DEFAULT_IMAGE_URL,
    MARKETING_WIDGET_REGISTRY,
    LAYOUT_WIDGET_DEFINITIONS,
    isLoopbackMarketingUrl,
    marketingWidgetSourceCodenames,
    parseApplicationLayoutWidgetConfig,
    parseSafeExternalUrl,
    type MarketingCollectionVariant,
    type MarketingSourceCodename,
    type MarketingWidgetDataOwnership,
    type MarketingWidgetKey,
    type LayoutWidgetPresentationField,
    MARKETING_PRICING_CARD_WIDTHS
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
    fieldMap: Record<string, string>
}

type MarketingImageDraft = {
    url: string
    decorative: boolean
    alt: Record<string, string>
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isSafeMarketingImageUrl = (value: string): boolean => {
    let parsed: URL
    try {
        parsed = parseSafeExternalUrl(value)
    } catch {
        return false
    }
    return parsed.protocol === 'https:' || isLoopbackMarketingUrl(value)
}

const readSourceDraft = (config: Record<string, unknown> | null | undefined): MarketingWidgetSourceDraft => {
    const source = isRecord(config?.source) ? config.source : {}
    const fieldMap = isRecord(source.fieldMap)
        ? Object.fromEntries(Object.entries(source.fieldMap).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {}
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
        recordKey: typeof source.recordKey === 'string' ? source.recordKey : '',
        fieldMap
    }
}

const readImageDraft = (config: Record<string, unknown> | null | undefined): MarketingImageDraft => {
    const media = isRecord(config?.media) ? config.media : {}
    const resource = isRecord(media.resource) ? media.resource : {}
    const alt = isRecord(media.alt)
        ? Object.fromEntries(Object.entries(media.alt).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {}
    return {
        url: typeof resource.url === 'string' && resource.url.trim() ? resource.url : MARKETING_DEFAULT_IMAGE_URL,
        decorative: media.decorative === true,
        alt
    }
}

const readBrandLogoUrl = (config: Record<string, unknown> | null | undefined): string => {
    const media = isRecord(config?.brandLogo) ? config.brandLogo : {}
    const resource = isRecord(media.resource) ? media.resource : {}
    return typeof resource.url === 'string' ? resource.url : ''
}

const getWidgetPresentationFields = (widgetKey: MarketingWidgetKey): readonly LayoutWidgetPresentationField[] =>
    LAYOUT_WIDGET_DEFINITIONS.find((definition) => definition.key === widgetKey)?.presentationFields ?? []

const normalizePresentationFieldValue = (field: LayoutWidgetPresentationField, value: unknown): unknown => {
    if (field.kind === 'switch') return typeof value === 'boolean' ? value : field.defaultValue
    if (field.kind === 'text') return typeof value === 'string' ? value : field.defaultValue
    return typeof value === 'string' && field.options.some((option) => option.value === value) ? value : field.defaultValue
}

const buildInitialConfig = (widgetKey: MarketingWidgetKey, config?: Record<string, unknown> | null): Record<string, unknown> => {
    const rawConfig = isRecord(config) ? { ...config } : {}
    const existingInstanceKey = typeof rawConfig.instanceKey === 'string' && rawConfig.instanceKey.trim() ? rawConfig.instanceKey : null
    delete rawConfig.instanceKey

    if (widgetKey === 'marketing.hero') {
        return {
            ...(existingInstanceKey ? { instanceKey: existingInstanceKey } : {}),
            ...Object.fromEntries(
                getWidgetPresentationFields(widgetKey).map((field) => [
                    field.key,
                    normalizePresentationFieldValue(field, config?.[field.key])
                ])
            )
        }
    }

    const ownership = MARKETING_WIDGET_REGISTRY[widgetKey].dataOwnership
    const result: Record<string, unknown> = {
        ...(existingInstanceKey ? { instanceKey: existingInstanceKey } : {}),
        ...rawConfig,
        ...(widgetKey === 'marketing.collection' && config?.variant === undefined ? { variant: 'logos' } : {})
    }
    if (ownership === 'entity') result.source = readSourceDraft(config)
    return result
}

const getNumericValue = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const widgetHasField = (widgetKey: MarketingWidgetKey, field: string): boolean => {
    if (widgetKey === 'marketing.navigation') return field === 'showAuthActions' || field === 'maxItems'
    if (widgetKey === 'marketing.collection')
        return ['variant', 'maxItems', 'showTitle', 'showDescription', 'showItemDescriptions', 'fixedItemsHeight'].includes(field)
    if (widgetKey === 'marketing.pricing') return ['maxItems', 'showBenefits', 'cardStyle', 'cardWidth'].includes(field)
    if (widgetKey === 'marketing.footer') return field === 'maxItems' || field === 'showNewsletter'
    if (widgetKey === 'marketing.brand') return field === 'brandName' || field === 'brandLogo'
    if (widgetKey === 'marketing.auth') return field === 'showAuthActions'
    return false
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
    const [imageDraft, setImageDraft] = useState<MarketingImageDraft>(() => readImageDraft(initialConfig))
    const [brandLogoUrl, setBrandLogoUrl] = useState(() => readBrandLogoUrl(initialConfig))
    const [imagePreviewError, setImagePreviewError] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        const nextDraft = buildInitialConfig(widgetKey, initialConfig)
        setDraft(nextDraft)
        setSourceDraft(readSourceDraft(nextDraft))
        setImageDraft(readImageDraft(nextDraft))
        setBrandLogoUrl(readBrandLogoUrl(nextDraft))
        setImagePreviewError(false)
        setSubmitError(null)
        setIsSaving(false)
    }, [initialConfig, open, widgetKey])

    const dataOwnership: MarketingWidgetDataOwnership = MARKETING_WIDGET_REGISTRY[widgetKey].dataOwnership
    const usesEntitySourceSelection = dataOwnership === 'entity' && widgetKey !== 'marketing.hero'
    const heroPresentationFields = widgetKey === 'marketing.hero' ? getWidgetPresentationFields(widgetKey) : []
    const availableSources = useMemo(() => {
        if (!usesEntitySourceSelection) return []
        const variant = MARKETING_COLLECTION_VARIANTS.find((item) => item === draft.variant) as MarketingCollectionVariant | undefined
        const allowedCodenames = new Set(marketingWidgetSourceCodenames(widgetKey, variant))
        const values = sourceOptions.filter(
            (option) => option.entityKind === 'object' && allowedCodenames.has(option.value as MarketingSourceCodename)
        )
        return values
    }, [draft.variant, sourceOptions, usesEntitySourceSelection, widgetKey])

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

    const updateImage = (patch: Partial<MarketingImageDraft>) => {
        setImageDraft((current) => ({ ...current, ...patch }))
        if (patch.url !== undefined) setImagePreviewError(false)
        setSubmitError(null)
    }

    const updateImageAlt = (locale: string, value: string) => {
        setImageDraft((current) => ({ ...current, alt: { ...current.alt, [locale]: value } }))
        setSubmitError(null)
    }

    const handleSave = async () => {
        if (isSaving) return
        const candidate: Record<string, unknown> = { ...draft }
        if (usesEntitySourceSelection) {
            const sourceCodename = sourceDraft.entityCodename.trim()
            if (!sourceCodename || !availableSources.some((option) => option.value === sourceCodename)) return
            const source: Record<string, unknown> = {
                ...(isRecord(draft.source) ? draft.source : {}),
                entityCodename: sourceCodename,
                entityKind: sourceDraft.entityKind ?? 'object'
            }
            delete source.recordKey
            if (sourceDraft.recordKey.trim()) source.recordKey = sourceDraft.recordKey.trim()
            candidate.source = source
        } else {
            delete candidate.source
            delete candidate.copySource
        }
        if (widgetKey === 'marketing.brand') {
            const url = brandLogoUrl.trim()
            if (url && !isSafeMarketingImageUrl(url)) {
                setSubmitError(
                    t(
                        'layouts.marketing.widget.imageUrlInvalid',
                        'Enter a valid absolute HTTPS image address (or a loopback HTTP address during local development).'
                    )
                )
                return
            }
            if (url) {
                candidate.brandLogo = {
                    kind: 'logo',
                    resource: { type: 'url', url, launchMode: 'inline' },
                    decorative: true
                }
            } else {
                delete candidate.brandLogo
            }
            if (typeof candidate.brandName === 'string' && candidate.brandName.trim().length === 0) delete candidate.brandName
        }
        if (dataOwnership === 'static') {
            delete candidate.maxItems
            delete candidate.showNewsletter
            const alt = Object.fromEntries(
                Object.entries(imageDraft.alt)
                    .map(([locale, value]) => [locale, value.trim()])
                    .filter(([, value]) => value)
            )
            candidate.media = {
                kind: 'hero',
                resource: { type: 'url', url: imageDraft.url.trim(), launchMode: 'inline' },
                decorative: imageDraft.decorative,
                ...(imageDraft.decorative ? {} : { alt })
            }
        }
        let config: Record<string, unknown>
        try {
            const hasPersistedInstanceKey = typeof candidate.instanceKey === 'string' && candidate.instanceKey.trim().length > 0
            if (widgetKey === 'marketing.hero') {
                config = buildInitialConfig(widgetKey, candidate)
            } else {
                const parsed = parseApplicationLayoutWidgetConfig(widgetKey, {
                    ...candidate,
                    instanceKey: hasPersistedInstanceKey ? candidate.instanceKey : 'draft'
                })
                if (!hasPersistedInstanceKey) delete parsed.instanceKey
                config = parsed
            }
        } catch {
            if (dataOwnership === 'static') {
                // Give a URL-specific localized reason when the persisted media
                // payload is the failing part instead of the generic
                // "review the settings" message.
                const media = isRecord(candidate.media) ? candidate.media : null
                const resource = isRecord(media?.resource) ? media.resource : null
                const url = typeof resource?.url === 'string' ? resource.url : ''
                setSubmitError(
                    isSafeMarketingImageUrl(url)
                        ? t('layouts.marketing.widget.invalidConfig', 'Review the widget source and settings before saving.')
                        : t(
                              'layouts.marketing.widget.imageUrlInvalid',
                              'Enter a valid absolute HTTPS image address (or a loopback HTTP address during local development).'
                          )
                )
                return
            }
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
    const imageAltLocales = Array.from(new Set(['en', 'ru', ...Object.keys(imageDraft.alt)])).sort()
    const imageIsRequired =
        dataOwnership === 'static' &&
        (!imageDraft.url.trim() || (!imageDraft.decorative && !Object.values(imageDraft.alt).some((value) => value.trim())))
    const saveDisabled = isSaving || (usesEntitySourceSelection && sourceIsRequired) || imageIsRequired

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
                    <Button variant='contained' onClick={() => void handleSave()} disabled={saveDisabled}>
                        {isSaving ? t('common:actions.saving', 'Saving...') : t('common:actions.save', 'Save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} data-testid='marketing-widget-config-dialog'>
                {submitError ? <Alert severity='error'>{submitError}</Alert> : null}
                {usesEntitySourceSelection && sourceIsUnavailable ? (
                    <Alert severity='warning'>
                        {t(
                            'layouts.marketing.widget.sourceUnavailable',
                            'The previously selected content source is no longer available. Choose a published Object entity source.'
                        )}
                    </Alert>
                ) : null}
                {widgetKey === 'marketing.hero' ? (
                    <Alert severity='info'>
                        {t(
                            'layouts.marketing.widget.recordSelectionEditHint',
                            'Hero content is edited separately in the bound Object record.'
                        )}
                    </Alert>
                ) : null}
                {usesEntitySourceSelection ? (
                    <>
                        <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                            {t(
                                'layouts.marketing.widget.sourceHelper',
                                'Choose a standard entity source. The runtime resolves records through published metadata and never accepts a table name.'
                            )}
                        </Typography>
                        <FormControl fullWidth size='small' required disabled={availableSources.length === 0}>
                            <InputLabel id='marketing-widget-source-label'>
                                {t('layouts.marketing.widget.source', 'Content source')}
                            </InputLabel>
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
                                    ? t(
                                          'layouts.marketing.widget.recordSelectionManaged',
                                          'The published source manages the selected record.'
                                      )
                                    : t(
                                          'layouts.marketing.widget.recordSelectionDefault',
                                          'The published source determines which records are shown.'
                                      )}
                            </Typography>
                            <Typography variant='body2' sx={{ color: 'text.secondary', mt: 0.5 }}>
                                {t(
                                    'layouts.marketing.widget.recordSelectionEditHint',
                                    'Edit the linked records in the metahub: Entities -> Objects -> the selected object -> Records.'
                                )}
                            </Typography>
                        </Box>
                    </>
                ) : null}

                {dataOwnership === 'static' ? (
                    <Stack spacing={2} data-testid='marketing-image-settings'>
                        <Alert severity='info'>
                            {t(
                                'layouts.marketing.widget.imageGuidance',
                                'Use a wide image, preferably 16:9 and about 1600×900 or larger. WebP, JPEG, and PNG work well. Use an optimized file at a publicly reachable HTTPS URL.'
                            )}
                        </Alert>
                        <TextField
                            fullWidth
                            required
                            size='small'
                            type='url'
                            label={t('layouts.marketing.widget.imageUrl', 'Image URL')}
                            helperText={t(
                                'layouts.marketing.widget.imageUrlHelper',
                                'The image is loaded directly by the visitor browser. Remote URLs must use HTTPS.'
                            )}
                            value={imageDraft.url}
                            onChange={(event) => updateImage({ url: event.target.value })}
                        />
                        <FormControlLabel
                            control={<Switch checked={imageDraft.decorative} onChange={(_, decorative) => updateImage({ decorative })} />}
                            label={t('layouts.marketing.widget.imageDecorative', 'Decorative image')}
                        />
                        {!imageDraft.decorative
                            ? (() => {
                                  const hasAnyAlt = Object.values(imageDraft.alt).some((value) => value.trim())
                                  return imageAltLocales.map((locale) => (
                                      <TextField
                                          key={locale}
                                          fullWidth
                                          // The blocking rule requires at least one localized alt;
                                          // keep the visual required marker aligned with that rule.
                                          required={locale === 'en' && !hasAnyAlt}
                                          size='small'
                                          label={t('layouts.marketing.widget.imageAlt', 'Alternative text') + ` (${locale.toUpperCase()})`}
                                          value={imageDraft.alt[locale] ?? ''}
                                          onChange={(event) => updateImageAlt(locale, event.target.value)}
                                      />
                                  ))
                              })()
                            : null}
                        {imageDraft.url.trim() ? (
                            <>
                                {imagePreviewError ? (
                                    <Alert severity='warning'>
                                        {t(
                                            'layouts.marketing.widget.imagePreviewWarning',
                                            'The image preview could not be loaded. Check that the HTTPS URL is publicly reachable and points directly to an image.'
                                        )}
                                    </Alert>
                                ) : null}
                                <Box
                                    component='img'
                                    src={imageDraft.url.trim()}
                                    alt={imageDraft.decorative ? '' : Object.values(imageDraft.alt).find((value) => value.trim()) ?? ''}
                                    referrerPolicy='no-referrer'
                                    onError={() => setImagePreviewError(true)}
                                    onLoad={() => setImagePreviewError(false)}
                                    sx={{
                                        width: '100%',
                                        maxHeight: 240,
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        border: 1,
                                        borderColor: 'divider'
                                    }}
                                />
                            </>
                        ) : null}
                    </Stack>
                ) : null}

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

                {widgetHasField(widgetKey, 'brandName') ? (
                    <TextField
                        fullWidth
                        size='small'
                        label={t('layouts.marketing.widget.brandName', 'Brand name')}
                        helperText={t(
                            'layouts.marketing.widget.brandNameHelper',
                            'Shown in the header and footer when no logo is configured.'
                        )}
                        value={String(draft.brandName ?? '')}
                        onChange={(event) => updateDraft('brandName', event.target.value)}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'brandLogo') ? (
                    <TextField
                        fullWidth
                        size='small'
                        type='url'
                        label={t('layouts.marketing.widget.brandLogoUrl', 'Brand logo URL')}
                        helperText={t(
                            'layouts.marketing.widget.brandLogoHelper',
                            'Optional HTTPS image. The logo is decorative; the brand name stays the accessible label in the header.'
                        )}
                        value={brandLogoUrl}
                        onChange={(event) => {
                            setBrandLogoUrl(event.target.value)
                            setSubmitError(null)
                        }}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'maxItems') ? (
                    <TextField
                        fullWidth
                        size='small'
                        type='number'
                        label={t('layouts.marketing.widget.maxItems', 'Maximum items')}
                        value={getNumericValue(draft.maxItems, 24)}
                        helperText={t(
                            'layouts.marketing.widget.maxItemsHelper',
                            'Limits the records of this widget. Related child records (for example pricing benefits) are not cut by this limit.'
                        )}
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
                {widgetKey === 'marketing.collection' && draft.variant === 'features' ? (
                    <>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={draft.showItemDescriptions !== false}
                                    onChange={(_, value) => updateDraft('showItemDescriptions', value)}
                                />
                            }
                            label={t('layouts.marketing.widget.showItemDescriptions', 'Show item descriptions')}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={draft.fixedItemsHeight === true}
                                    onChange={(_, value) => updateDraft('fixedItemsHeight', value)}
                                />
                            }
                            label={t('layouts.marketing.widget.fixedItemsHeight', 'Scroll cards in a fixed area')}
                        />
                    </>
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
                {heroPresentationFields.map((field) => {
                    if (field.kind !== 'switch') return null
                    const helperId = `marketing-widget-presentation-${field.key}-helper`
                    const value = draft[field.key]
                    return (
                        <FormControl key={field.key} component='fieldset'>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={typeof value === 'boolean' ? value : field.defaultValue}
                                        onChange={(_, checked) => updateDraft(field.key, checked)}
                                        slotProps={{ input: { 'aria-describedby': helperId } }}
                                    />
                                }
                                label={t(field.labelKey, field.defaultLabel)}
                            />
                            <FormHelperText id={helperId}>{t(field.helperTextKey, field.defaultHelperText)}</FormHelperText>
                        </FormControl>
                    )
                })}
                {widgetHasField(widgetKey, 'showBenefits') ? (
                    <FormControlLabel
                        control={
                            <Switch checked={draft.showBenefits !== false} onChange={(_, value) => updateDraft('showBenefits', value)} />
                        }
                        label={t('layouts.marketing.widget.showBenefits', 'Show plan benefits')}
                    />
                ) : null}
                {widgetHasField(widgetKey, 'cardWidth') ? (
                    <FormControl fullWidth size='small'>
                        <InputLabel id='marketing-widget-pricing-card-width-label'>
                            {t('layouts.marketing.widget.cardWidth', 'Card area width')}
                        </InputLabel>
                        <Select
                            labelId='marketing-widget-pricing-card-width-label'
                            value={String(draft.cardWidth ?? 'auto')}
                            label={t('layouts.marketing.widget.cardWidth', 'Card area width')}
                            onChange={(event) => updateDraft('cardWidth', event.target.value)}
                        >
                            {MARKETING_PRICING_CARD_WIDTHS.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option === 'full'
                                        ? t('layouts.marketing.widget.cardWidthFull', 'Wide container')
                                        : t('layouts.marketing.widget.cardWidthAuto', 'Standard container')}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}
                {widgetHasField(widgetKey, 'cardStyle') ? (
                    <FormControl fullWidth size='small'>
                        <InputLabel id='marketing-widget-pricing-card-style-label'>
                            {t('layouts.marketing.widget.cardStyle', 'Pricing card style')}
                        </InputLabel>
                        <Select
                            labelId='marketing-widget-pricing-card-style-label'
                            value={String(draft.cardStyle ?? 'featured')}
                            label={t('layouts.marketing.widget.cardStyle', 'Pricing card style')}
                            onChange={(event) => updateDraft('cardStyle', event.target.value)}
                        >
                            <MenuItem value='featured'>
                                {t('layouts.marketing.widget.cardStyleFeatured', 'Highlight one card (Recommended)')}
                            </MenuItem>
                            <MenuItem value='uniform'>
                                {t('layouts.marketing.widget.cardStyleUniform', 'Equal cards without highlight')}
                            </MenuItem>
                        </Select>
                    </FormControl>
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
