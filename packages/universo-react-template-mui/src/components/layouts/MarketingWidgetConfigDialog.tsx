import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Stack, Switch, TextField } from '@mui/material'
import { DropdownSelect as Select } from '../dropdowns'
import {
    LAYOUT_WIDGET_DEFINITIONS,
    getLayoutWidgetDefinition,
    parseApplicationLayoutWidgetConfig,
    type LayoutWidgetPresentationField,
    type MarketingWidgetKey
} from '@universo-react/types'
import { StandardDialog } from '../dialogs/StandardDialog'
import { useCommonTranslations } from '@universo-react/i18n'
import { useConfirm } from '../../hooks/useConfirm'

export type MarketingWidgetConfigDialogProps = {
    open: boolean
    widgetKey: MarketingWidgetKey
    initialConfig?: Record<string, unknown> | null
    title: string
    t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
    onSave: (config: Record<string, unknown>) => void | Promise<void>
    onCancel: () => void
}

const getPresentationFields = (widgetKey: MarketingWidgetKey): readonly LayoutWidgetPresentationField[] =>
    LAYOUT_WIDGET_DEFINITIONS.find((definition) => definition.key === widgetKey)?.presentationFields ?? []

const normalizeValue = (field: LayoutWidgetPresentationField, value: unknown): unknown => {
    if (field.kind === 'switch') return typeof value === 'boolean' ? value : field.defaultValue
    if (field.kind === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : field.defaultValue
    if (field.kind === 'text') return typeof value === 'string' ? value : field.defaultValue
    return typeof value === 'string' && field.options.some((option) => option.value === value) ? value : field.defaultValue
}

const buildInitialConfig = (widgetKey: MarketingWidgetKey, config?: Record<string, unknown> | null): Record<string, unknown> => {
    const fields = getPresentationFields(widgetKey)
    const existingInstanceKey =
        typeof config?.instanceKey === 'string' && config.instanceKey.trim().length > 0 ? config.instanceKey : undefined
    return {
        ...(existingInstanceKey ? { instanceKey: existingInstanceKey } : {}),
        ...Object.fromEntries(fields.map((field) => [field.key, normalizeValue(field, config?.[field.key])]))
    }
}

const buildConfigSignature = (config: Record<string, unknown>): string =>
    JSON.stringify(Object.fromEntries(Object.entries(config).sort(([left], [right]) => left.localeCompare(right))))

const widgetOwnsEntityContent = (widgetKey: MarketingWidgetKey, config: Record<string, unknown>): boolean =>
    Boolean(getLayoutWidgetDefinition(widgetKey, config)?.bindingSlots?.length)

const numberValue = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

export function MarketingWidgetConfigDialog({
    open,
    widgetKey,
    initialConfig,
    title,
    t,
    onSave,
    onCancel
}: MarketingWidgetConfigDialogProps) {
    const [draft, setDraft] = useState<Record<string, unknown>>(() => buildInitialConfig(widgetKey, initialConfig))
    const initialDraftSignatureRef = useRef(buildConfigSignature(buildInitialConfig(widgetKey, initialConfig)))
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const presentationFields = useMemo(() => getPresentationFields(widgetKey), [widgetKey])
    const { t: tCommon } = useCommonTranslations()
    const { confirm } = useConfirm()

    useEffect(() => {
        if (!open) return
        const initialDraft = buildInitialConfig(widgetKey, initialConfig)
        initialDraftSignatureRef.current = buildConfigSignature(initialDraft)
        setDraft(initialDraft)
        setSubmitError(null)
        setIsSaving(false)
    }, [initialConfig, open, widgetKey])

    const isDirty = open && buildConfigSignature(draft) !== initialDraftSignatureRef.current

    const updateDraft = (key: string, value: unknown) => {
        setDraft((current) => ({ ...current, [key]: value }))
        setSubmitError(null)
    }

    const handleCancel = () => {
        if (isSaving) return
        if (!isDirty) {
            onCancel()
            return
        }

        void confirm({
            title: tCommon('unsavedChanges.title', { defaultValue: 'Discard unsaved changes?' }),
            description: tCommon('unsavedChanges.description', { defaultValue: 'Your unsaved changes will be lost.' }),
            confirmButtonName: tCommon('unsavedChanges.confirm', { defaultValue: 'Discard' }),
            cancelButtonName: tCommon('unsavedChanges.cancel', { defaultValue: 'Keep editing' })
        }).then((discard) => {
            if (discard) onCancel()
        })
    }

    const handleSave = async () => {
        if (isSaving) return
        const hasPersistedInstanceKey = typeof draft.instanceKey === 'string' && draft.instanceKey.trim().length > 0
        let config: Record<string, unknown>
        try {
            config = parseApplicationLayoutWidgetConfig(widgetKey, {
                ...draft,
                instanceKey: hasPersistedInstanceKey ? draft.instanceKey : 'draft'
            })
            if (!hasPersistedInstanceKey) delete config.instanceKey
        } catch {
            setSubmitError(t('layouts.marketing.widget.invalidConfig', 'Review the settings and try again.'))
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

    return (
        <StandardDialog
            open={open}
            onClose={handleCancel}
            title={title}
            maxWidth='sm'
            dialogContentProps={{ dividers: true }}
            actions={
                <>
                    <Button onClick={handleCancel} disabled={isSaving}>
                        {t('common:actions.cancel', 'Cancel')}
                    </Button>
                    <Button variant='contained' onClick={() => void handleSave()} disabled={isSaving}>
                        {isSaving ? t('common:actions.saving', 'Saving...') : t('common:actions.save', 'Save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} data-testid='marketing-widget-config-dialog'>
                {submitError ? <Alert severity='error'>{submitError}</Alert> : null}
                {widgetOwnsEntityContent(widgetKey, draft) ? (
                    <Alert severity='info'>
                        {t(
                            'layouts.marketing.widget.entityContentHint',
                            'This widget displays content from bound Entity records. Manage its content in the metahub Objects workspace.'
                        )}
                    </Alert>
                ) : null}
                {presentationFields.map((field) => {
                    const value = draft[field.key]
                    const helperText = t(field.helperTextKey, field.defaultHelperText)
                    if (field.kind === 'switch') {
                        const helperId = `marketing-widget-${field.key}-helper`
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
                                <FormHelperText id={helperId}>{helperText}</FormHelperText>
                            </FormControl>
                        )
                    }
                    if (field.kind === 'number') {
                        return (
                            <TextField
                                key={field.key}
                                fullWidth
                                size='small'
                                type='number'
                                label={t(field.labelKey, field.defaultLabel)}
                                helperText={helperText}
                                value={numberValue(value, field.defaultValue)}
                                slotProps={{ htmlInput: { min: field.min, max: field.max, step: 1 } }}
                                onChange={(event) => updateDraft(field.key, Number(event.target.value))}
                            />
                        )
                    }
                    if (field.kind === 'text') {
                        return (
                            <TextField
                                key={field.key}
                                fullWidth
                                size='small'
                                required={field.required}
                                label={t(field.labelKey, field.defaultLabel)}
                                helperText={helperText}
                                value={typeof value === 'string' ? value : field.defaultValue}
                                slotProps={{ htmlInput: { maxLength: field.maxLength } }}
                                onChange={(event) => updateDraft(field.key, event.target.value)}
                            />
                        )
                    }
                    const label = t(field.labelKey, field.defaultLabel)
                    const labelId = `marketing-widget-${field.key}-label`
                    return (
                        <FormControl key={field.key} fullWidth size='small'>
                            <InputLabel id={labelId}>{label}</InputLabel>
                            <Select
                                labelId={labelId}
                                value={typeof value === 'string' ? value : field.defaultValue}
                                label={label}
                                onChange={(event) => updateDraft(field.key, event.target.value)}
                            >
                                {field.options.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {t(option.labelKey, option.defaultLabel)}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{helperText}</FormHelperText>
                        </FormControl>
                    )
                })}
                <FormHelperText>
                    {t(
                        'layouts.marketing.widget.instanceKeyHelper',
                        'Widget identity is assigned when this widget is created and stays the same when its settings are edited.'
                    )}
                </FormHelperText>
            </Stack>
        </StandardDialog>
    )
}

export default MarketingWidgetConfigDialog
