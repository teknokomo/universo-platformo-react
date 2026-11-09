import type { TFunction } from 'i18next'
import { FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Stack, Switch, Typography } from '@mui/material'
import { DropdownSelect as Select } from '../dropdowns/DropdownSelect'

export interface MarketingActionPolicyValues {
    allowEmailActions: boolean
    allowTelephoneActions: boolean
    externalLinkTarget: 'same-tab' | 'new-tab'
}

export interface MarketingActionPolicySectionProps {
    t: TFunction
    values: MarketingActionPolicyValues
    disabled?: boolean
    onChange: (patch: Partial<MarketingActionPolicyValues>) => void
}

/**
 * Action/link policy controls for `marketing-page` layouts
 * (`allowEmailActions`, `allowTelephoneActions`, `externalLinkTarget`).
 * These fields are marketing-only config, deliberately separate from the
 * cross-template `appearance` object rendered on the Theme tab.
 */
export function MarketingActionPolicySection({ t, values, disabled = false, onChange }: MarketingActionPolicySectionProps) {
    return (
        <Paper variant='outlined' sx={{ p: 2 }} data-testid='marketing-action-policy-section'>
            <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                {t('layouts.marketing.actionPolicy', 'Action policy')}
            </Typography>
            <Stack spacing={1.5}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={values.allowEmailActions}
                            disabled={disabled}
                            onChange={(_, checked) => onChange({ allowEmailActions: checked })}
                            data-testid='marketing-action-policy-email-switch'
                        />
                    }
                    label={t('layouts.marketing.allowEmailActions', 'Allow email actions')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={values.allowTelephoneActions}
                            disabled={disabled}
                            onChange={(_, checked) => onChange({ allowTelephoneActions: checked })}
                            data-testid='marketing-action-policy-telephone-switch'
                        />
                    }
                    label={t('layouts.marketing.allowTelephoneActions', 'Allow telephone actions')}
                />
                <FormControl size='small' sx={{ minWidth: 220 }} disabled={disabled}>
                    <InputLabel id='marketing-action-policy-link-target-label'>
                        {t('layouts.marketing.externalLinkTarget', 'External link target')}
                    </InputLabel>
                    <Select
                        labelId='marketing-action-policy-link-target-label'
                        label={t('layouts.marketing.externalLinkTarget', 'External link target')}
                        value={values.externalLinkTarget}
                        disabled={disabled}
                        onChange={(event) => onChange({ externalLinkTarget: event.target.value as 'same-tab' | 'new-tab' })}
                        inputProps={{ 'data-testid': 'marketing-action-policy-link-target-select' }}
                    >
                        <MenuItem value='same-tab'>{t('layouts.marketing.linkTarget.sameTab', 'Same tab')}</MenuItem>
                        <MenuItem value='new-tab'>{t('layouts.marketing.linkTarget.newTab', 'New tab')}</MenuItem>
                    </Select>
                </FormControl>
            </Stack>
        </Paper>
    )
}

export default MarketingActionPolicySection
