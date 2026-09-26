import type { ReactNode } from 'react'
import { Button, FormControl, FormHelperText, FormLabel, InputLabel, MenuItem, Stack, TextField } from '@mui/material'

import { useCommonTranslations } from '@universo-react/i18n'
import {
    MARKETING_ACTION_INTERNAL_ROUTES,
    MARKETING_ACTION_KINDS,
    type MarketingActionSectionTarget,
    type MarketingActionKind
} from '@universo-react/types'
import type { DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'

import { createDefaultMarketingAction, readMarketingActionDraft, type MarketingActionDraft } from './marketingAction'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'

type MarketingActionFieldProps = {
    field: DynamicFieldConfig
    value: unknown
    onChange: (value: MarketingActionDraft | undefined) => void
    disabled: boolean
    error: string | null
    helperText?: string
    sectionTargets?: readonly MarketingActionSectionTarget[]
    sectionTargetsState?: 'ready' | 'loading' | 'unavailable' | 'context-unavailable'
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const actionInputField = (kind: MarketingActionKind): { labelKey: string; fallback: string } => {
    switch (kind) {
        case 'internal':
            return { labelKey: 'layouts.marketing.heroAuthoring.actionPath', fallback: 'Application page' }
        case 'external':
            return { labelKey: 'layouts.marketing.heroAuthoring.actionUrl', fallback: 'Web address' }
        case 'anchor':
            return { labelKey: 'layouts.marketing.heroAuthoring.actionAnchor', fallback: 'Page section' }
        case 'email':
            return { labelKey: 'layouts.marketing.heroAuthoring.actionEmail', fallback: 'Email address' }
        case 'tel':
            return { labelKey: 'layouts.marketing.heroAuthoring.actionPhone', fallback: 'Phone number' }
    }
}

const getActionTarget = (action: MarketingActionDraft): string => {
    switch (action.kind) {
        case 'internal':
            return action.path
        case 'external':
            return action.url
        case 'anchor':
            return action.href
        case 'email':
            return action.address
        case 'tel':
            return action.number
    }
}

const updateActionTarget = (action: MarketingActionDraft, target: string): MarketingActionDraft => {
    switch (action.kind) {
        case 'internal':
            return { ...action, path: target }
        case 'external':
            return { ...action, url: target }
        case 'anchor':
            return { ...action, href: target }
        case 'email':
            return { ...action, address: target }
        case 'tel':
            return { ...action, number: target }
    }
}

const actionTargetOptions = (kind: MarketingActionKind, sectionTargets?: readonly MarketingActionSectionTarget[]) => {
    if (kind === 'internal') return MARKETING_ACTION_INTERNAL_ROUTES
    if (kind === 'anchor') return sectionTargets ?? []
    return null
}

export default function MarketingActionField({
    field,
    value,
    onChange,
    disabled,
    error,
    helperText,
    sectionTargets,
    sectionTargetsState = sectionTargets ? 'ready' : 'context-unavailable'
}: MarketingActionFieldProps): ReactNode {
    const { t } = useCommonTranslations()
    const optional = !field.required
    const fieldLabelId = `${field.id.toLowerCase()}-action-label`
    const validationId = `${field.id.toLowerCase()}-action-helper`
    if (optional && !isRecord(value)) {
        return (
            <Stack
                spacing={1}
                role='group'
                aria-labelledby={fieldLabelId}
                aria-describedby={error || helperText ? validationId : undefined}
            >
                <FormLabel id={fieldLabelId} required={field.required} error={Boolean(error)}>
                    {field.label}
                </FormLabel>
                <Button
                    type='button'
                    variant='outlined'
                    size='small'
                    disabled={disabled}
                    onClick={() => onChange(createDefaultMarketingAction('internal', field.id === 'TermsAction' ? '/terms' : '/auth'))}
                >
                    {t('layouts.marketing.heroAuthoring.addAction', { defaultValue: 'Add link action' })}
                </Button>
                {error || helperText ? (
                    <FormHelperText id={validationId} error={Boolean(error)}>
                        {helperText}
                    </FormHelperText>
                ) : null}
            </Stack>
        )
    }

    const action = readMarketingActionDraft(value, field.id === 'TermsAction' ? '/terms' : '/auth')
    const kind = action.kind
    const input = actionInputField(kind)
    const actionValue = getActionTarget(action)
    const targetOptions = actionTargetOptions(kind, sectionTargets)
    const savedAnchorUnavailable =
        kind === 'anchor' && Boolean(actionValue) && !targetOptions?.some((option) => ('href' in option ? option.href : '') === actionValue)
    const targetStatusMessage =
        kind !== 'anchor'
            ? helperText
            : savedAnchorUnavailable
            ? t('layouts.marketing.heroAuthoring.sections.unavailable', { defaultValue: 'This section is no longer in the current layout' })
            : sectionTargetsState === 'loading'
            ? t('layouts.marketing.heroAuthoring.actionTargetsLoading', { defaultValue: 'Loading active page sections…' })
            : sectionTargetsState === 'unavailable'
            ? t('layouts.marketing.heroAuthoring.actionTargetsUnavailable', { defaultValue: 'Active page sections could not be loaded.' })
            : sectionTargetsState === 'context-unavailable'
            ? t('layouts.marketing.heroAuthoring.actionTargetsContextUnavailable', {
                  defaultValue: 'Edit this content from its layout to choose an active page section.'
              })
            : targetOptions?.length === 0
            ? t('layouts.marketing.heroAuthoring.actionTargetsEmpty', {
                  defaultValue: 'Add an active page section before using a section action.'
              })
            : helperText
    const kindLabelId = `${field.id.toLowerCase()}-action-kind-label`
    const targetLabelId = `${field.id.toLowerCase()}-action-target-label`
    const kindLabel = t('layouts.marketing.heroAuthoring.actionKind', { defaultValue: 'Action type' })

    return (
        <Stack spacing={1} role='group' aria-labelledby={fieldLabelId} aria-describedby={error || helperText ? validationId : undefined}>
            <FormLabel id={fieldLabelId} required={field.required} error={Boolean(error)}>
                {field.label}
            </FormLabel>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-start' } }}>
                <FormControl fullWidth size='small' disabled={disabled}>
                    <InputLabel id={kindLabelId}>{kindLabel}</InputLabel>
                    <Select
                        labelId={kindLabelId}
                        value={kind}
                        label={kindLabel}
                        onChange={(event) =>
                            onChange(
                                createDefaultMarketingAction(
                                    event.target.value as MarketingActionKind,
                                    field.id === 'TermsAction' ? '/terms' : '/auth'
                                )
                            )
                        }
                    >
                        {MARKETING_ACTION_KINDS.map((actionKind) => (
                            <MenuItem key={actionKind} value={actionKind}>
                                {t(`layouts.marketing.heroAuthoring.actionKinds.${actionKind}`, { defaultValue: actionKind })}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {actionTargetOptions(kind) ? (
                    <FormControl
                        fullWidth
                        size='small'
                        disabled={disabled || (kind === 'anchor' && (sectionTargetsState !== 'ready' || targetOptions?.length === 0))}
                        error={Boolean(error || savedAnchorUnavailable || sectionTargetsState === 'unavailable')}
                    >
                        <InputLabel id={targetLabelId}>{t(input.labelKey, { defaultValue: input.fallback })}</InputLabel>
                        <Select
                            id={`${field.id.toLowerCase()}-action-input`}
                            labelId={targetLabelId}
                            value={actionValue}
                            label={t(input.labelKey, { defaultValue: input.fallback })}
                            onChange={(event) => onChange(updateActionTarget(action, event.target.value))}
                            inputProps={{ 'aria-describedby': targetStatusMessage ? validationId : undefined }}
                        >
                            {targetOptions?.map((option) => {
                                const value = 'path' in option ? option.path : option.href
                                const baseLabel = t(option.labelKey, { defaultValue: option.defaultLabel })
                                const label =
                                    'instanceNumber' in option && option.instanceNumber > 1
                                        ? t('layouts.marketing.heroAuthoring.sections.instance', {
                                              section: baseLabel,
                                              number: option.instanceNumber,
                                              defaultValue: `${baseLabel} — ${option.instanceNumber}`
                                          })
                                        : baseLabel
                                return (
                                    <MenuItem key={value} value={value}>
                                        {label}
                                    </MenuItem>
                                )
                            })}
                            {savedAnchorUnavailable ? (
                                <MenuItem value={actionValue} disabled>
                                    {t('layouts.marketing.heroAuthoring.sections.unavailable', {
                                        defaultValue: 'This section is no longer in the current layout'
                                    })}
                                </MenuItem>
                            ) : null}
                            {kind === 'anchor' && sectionTargetsState === 'ready' && targetOptions?.length === 0 && !actionValue ? (
                                <MenuItem value='' disabled>
                                    {t('layouts.marketing.heroAuthoring.actionTargetsEmpty', {
                                        defaultValue: 'Add an active page section before using a section action.'
                                    })}
                                </MenuItem>
                            ) : null}
                            {kind === 'anchor' && sectionTargetsState !== 'ready' ? (
                                <MenuItem value={actionValue || ''} disabled>
                                    {sectionTargetsState === 'loading'
                                        ? t('layouts.marketing.heroAuthoring.actionTargetsLoading', {
                                              defaultValue: 'Loading active page sections…'
                                          })
                                        : sectionTargetsState === 'context-unavailable'
                                        ? t('layouts.marketing.heroAuthoring.actionTargetsContextUnavailable', {
                                              defaultValue: 'Edit this content from its layout to choose an active page section.'
                                          })
                                        : t('layouts.marketing.heroAuthoring.actionTargetsUnavailable', {
                                              defaultValue: 'Active page sections could not be loaded.'
                                          })}
                                </MenuItem>
                            ) : null}
                        </Select>
                        {targetStatusMessage ? <FormHelperText id={validationId}>{targetStatusMessage}</FormHelperText> : null}
                    </FormControl>
                ) : (
                    <TextField
                        id={`${field.id.toLowerCase()}-action-input`}
                        fullWidth
                        size='small'
                        label={t(input.labelKey, { defaultValue: input.fallback })}
                        value={actionValue}
                        disabled={disabled}
                        error={Boolean(error)}
                        helperText={helperText}
                        slotProps={{
                            input: { 'aria-describedby': helperText ? validationId : undefined },
                            formHelperText: { id: validationId }
                        }}
                        onChange={(event) => onChange(updateActionTarget(action, event.target.value))}
                    />
                )}
                {optional ? (
                    <Button type='button' size='small' disabled={disabled} onClick={() => onChange(undefined)}>
                        {t('layouts.marketing.heroAuthoring.removeAction', { defaultValue: 'Remove' })}
                    </Button>
                ) : null}
            </Stack>
            {kind === 'external' ? (
                <FormControl fullWidth size='small' disabled={disabled}>
                    <InputLabel id={targetLabelId}>
                        {t('layouts.marketing.heroAuthoring.openLinkIn', { defaultValue: 'Open link in' })}
                    </InputLabel>
                    <Select
                        labelId={targetLabelId}
                        value={action.target === 'same-tab' ? 'same-tab' : 'new-tab'}
                        label={t('layouts.marketing.heroAuthoring.openLinkIn', { defaultValue: 'Open link in' })}
                        onChange={(event) => onChange({ ...action, target: event.target.value as 'same-tab' | 'new-tab' })}
                    >
                        <MenuItem value='same-tab'>{t('layouts.marketing.heroAuthoring.sameTab', { defaultValue: 'Same tab' })}</MenuItem>
                        <MenuItem value='new-tab'>{t('layouts.marketing.heroAuthoring.newTab', { defaultValue: 'New tab' })}</MenuItem>
                    </Select>
                </FormControl>
            ) : null}
        </Stack>
    )
}
