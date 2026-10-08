import { useEffect, useState } from 'react'
import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { EntityFormDialog } from '@universo-react/template-mui'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo-react/i18n'
import { getLayoutWidgetDefinition } from '@universo-react/types'
import type { ApplicationLayoutWidgetKey } from '@universo-react/types'

import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

const normalizeConfig = (value: unknown): Record<string, unknown> => {
    const next = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
    delete next.sharedBehavior
    return next
}

const getFieldValue = (config: Record<string, unknown>, key: string, defaultValue: unknown): unknown =>
    Object.prototype.hasOwnProperty.call(config, key) ? config[key] : defaultValue

export interface WidgetBehaviorEditorDialogProps {
    open: boolean
    config?: Record<string, unknown> | null
    metahubId?: string | null
    layoutId?: string | null
    widgetId?: string | null
    widgetKey?: ApplicationLayoutWidgetKey | null
    widgetLabel?: string | null
    showScopeVisibility?: boolean
    onSave: (config: Record<string, unknown>) => void
    onCancel: () => void
}

export default function WidgetBehaviorEditorDialog({
    open,
    config,
    metahubId,
    layoutId,
    widgetId,
    widgetKey,
    widgetLabel,
    showScopeVisibility = false,
    onSave,
    onCancel
}: WidgetBehaviorEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const [draft, setDraft] = useState<Record<string, unknown>>(() => normalizeConfig(config))
    const presentationFields = widgetKey ? getLayoutWidgetDefinition(widgetKey, config)?.presentationFields ?? [] : []

    useEffect(() => {
        if (!open) {
            return
        }

        setDraft(normalizeConfig(config))
    }, [config, open])

    return (
        <EntityFormDialog
            open={open}
            title={
                widgetLabel?.trim()
                    ? `${t('layouts.widgetPresentationEditor.title', 'Presentation settings')}: ${widgetLabel.trim()}`
                    : t('layouts.widgetPresentationEditor.title', 'Presentation settings')
            }
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(draft)}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        {t(
                            'layouts.widgetPresentationEditor.description',
                            'Configure the presentation options registered for this widget.'
                        )}
                    </Typography>
                    {presentationFields.map((field) => {
                        const value = getFieldValue(draft, field.key, field.defaultValue)
                        const label = tc(field.labelKey, { defaultValue: field.defaultLabel })
                        const helperText = tc(field.helperTextKey, { defaultValue: field.defaultHelperText })
                        const onChange = (nextValue: unknown) => setDraft((current) => ({ ...current, [field.key]: nextValue }))

                        if (field.kind === 'switch') {
                            return (
                                <FormControlLabel
                                    key={field.key}
                                    label={label}
                                    control={<Switch checked={value === true} onChange={(_event, checked) => onChange(checked)} />}
                                />
                            )
                        }

                        if (field.kind === 'select') {
                            return (
                                <TextField
                                    key={field.key}
                                    select
                                    fullWidth
                                    size='small'
                                    label={label}
                                    helperText={helperText}
                                    value={typeof value === 'string' ? value : field.defaultValue}
                                    required={field.required}
                                    onChange={(event) => onChange(event.target.value)}
                                >
                                    {field.options.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {tc(option.labelKey, { defaultValue: option.defaultLabel })}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )
                        }

                        if (field.kind === 'number') {
                            return (
                                <TextField
                                    key={field.key}
                                    fullWidth
                                    type='number'
                                    size='small'
                                    label={label}
                                    helperText={helperText}
                                    value={typeof value === 'number' ? value : field.defaultValue}
                                    required
                                    slotProps={{ htmlInput: { min: field.min, max: field.max, step: 1 } }}
                                    onChange={(event) => {
                                        const nextValue = Number(event.target.value)
                                        if (Number.isInteger(nextValue) && nextValue >= field.min && nextValue <= field.max)
                                            onChange(nextValue)
                                    }}
                                />
                            )
                        }

                        const textValue = typeof value === 'string' ? value : field.defaultValue
                        return (
                            <TextField
                                key={field.key}
                                fullWidth
                                size='small'
                                label={label}
                                helperText={helperText}
                                value={textValue}
                                required={field.required}
                                slotProps={{ htmlInput: { maxLength: field.maxLength } }}
                                multiline={(field.maxLength ?? 0) > 256}
                                minRows={(field.maxLength ?? 0) > 256 ? 3 : undefined}
                                onChange={(event) => onChange(event.target.value)}
                            />
                        )
                    })}
                    {showScopeVisibility && metahubId && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
