import { FormControlLabel, FormGroup, Stack, Switch, Typography } from '@mui/material'
import { resolveSharedBehavior, type SharedBehavior } from '@universo/types'
import { useTranslation } from 'react-i18next'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isDefaultSharedBehavior = (value: Required<SharedBehavior>): boolean =>
    value.canDeactivate === true && value.canExclude === true && value.positionLocked === false

export const getSharedBehaviorFromWidgetConfig = (value: unknown): Required<SharedBehavior> => {
    if (!isRecord(value) || !isRecord(value.sharedBehavior)) {
        return resolveSharedBehavior(undefined)
    }

    return resolveSharedBehavior(value.sharedBehavior as Partial<SharedBehavior>)
}

export const setSharedBehaviorInWidgetConfig = (value: unknown, sharedBehavior: Required<SharedBehavior>): Record<string, unknown> => {
    const next = isRecord(value) ? { ...value } : {}

    if (isDefaultSharedBehavior(sharedBehavior)) {
        delete next.sharedBehavior
    } else {
        next.sharedBehavior = sharedBehavior
    }

    return next
}

type Props = {
    value: unknown
    onChange: (nextValue: Record<string, unknown>) => void
    disabled?: boolean
}

export default function ApplicationLayoutSharedBehaviorFields({ value, onChange, disabled = false }: Props) {
    const { t } = useTranslation('applications')
    const sharedBehavior = getSharedBehaviorFromWidgetConfig(value)

    const handleChange = (patch: Partial<Required<SharedBehavior>>) => {
        onChange(
            setSharedBehaviorInWidgetConfig(value, {
                ...sharedBehavior,
                ...patch
            })
        )
    }

    return (
        <Stack spacing={1.25}>
            <Stack spacing={0.5}>
                <Typography variant='subtitle2'>{t('layouts.sharedBehavior.title', 'Shared behavior')}</Typography>
                <Typography variant='body2' color='text.secondary'>
                    {t(
                        'layouts.sharedBehavior.description',
                        'Control how inherited catalog layouts can exclude, deactivate, or move this widget.'
                    )}
                </Typography>
            </Stack>
            <FormGroup>
                <FormControlLabel
                    control={
                        <Switch
                            checked={sharedBehavior.canDeactivate}
                            onChange={(_, checked) => handleChange({ canDeactivate: checked })}
                            disabled={disabled}
                        />
                    }
                    label={t('layouts.sharedBehavior.canDeactivate', 'Can be deactivated')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={sharedBehavior.canExclude}
                            onChange={(_, checked) => handleChange({ canExclude: checked })}
                            disabled={disabled}
                        />
                    }
                    label={t('layouts.sharedBehavior.canExclude', 'Can be excluded')}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={sharedBehavior.positionLocked}
                            onChange={(_, checked) => handleChange({ positionLocked: checked })}
                            disabled={disabled}
                        />
                    }
                    label={t('layouts.sharedBehavior.positionLocked', 'Position locked')}
                />
            </FormGroup>
        </Stack>
    )
}
