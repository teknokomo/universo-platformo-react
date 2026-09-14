import {
    Alert,
    Button,
    CircularProgress,
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Stack,
    Typography
} from '@mui/material'
import { useEffect, useId, useState } from 'react'
import StandardDialog from '../dialogs/StandardDialog'

export type LayoutZonePosition = 'fixed' | 'flow'

export interface LayoutZoneSettingsDialogOption {
    readonly value: string
    readonly label: string
}

export interface LayoutZoneSettingsDialogSetting {
    readonly key: string
    readonly kind: 'enum'
    readonly label: string
    readonly options: readonly LayoutZoneSettingsDialogOption[]
}

export type LayoutZoneSettingsDialogValues = Readonly<Record<string, string>>

export interface LayoutZoneSettingsDialogLabels {
    inherited: string
    customized: string
    cancel: string
    save: string
    reset: string
    saving: string
}

export interface LayoutZoneSettingsDialogProps {
    open: boolean
    title: string
    settings: readonly LayoutZoneSettingsDialogSetting[]
    values: LayoutZoneSettingsDialogValues
    inherited: boolean
    readOnly?: boolean
    isBusy?: boolean
    error?: string | null
    labels: LayoutZoneSettingsDialogLabels
    onClose: () => void
    onSave: (values: Record<string, string>) => void | Promise<void>
    onReset?: () => void | Promise<void>
}

/**
 * Shared settings presentation for layout zones. The dialog renders the
 * descriptors supplied by the canonical layout registry; persistence,
 * inheritance and permissions stay in the layout-specific consumers.
 */
export function LayoutZoneSettingsDialog({
    open,
    title,
    settings,
    values,
    inherited,
    readOnly = false,
    isBusy = false,
    error,
    labels,
    onClose,
    onSave,
    onReset
}: LayoutZoneSettingsDialogProps) {
    const [localValues, setLocalValues] = useState<Record<string, string>>(() => ({ ...values }))

    useEffect(() => {
        if (open) setLocalValues({ ...values })
    }, [open, values])

    const settingsId = useId()
    const handleCancel = () => {
        setLocalValues({ ...values })
        onClose()
    }
    const runAction = async (action: () => void | Promise<void>) => {
        await action()
    }
    const canReset = !readOnly && !isBusy && Boolean(onReset) && !inherited
    const hasUnsupportedValue = settings.some(
        (setting) => localValues[setting.key] !== undefined && !setting.options.some((option) => option.value === localValues[setting.key])
    )
    const canSave =
        !readOnly && !isBusy && !hasUnsupportedValue && settings.some((setting) => localValues[setting.key] !== values[setting.key])

    return (
        <StandardDialog
            open={open}
            onClose={handleCancel}
            title={title}
            isBusy={isBusy}
            dialogActionsTestId='layout-zone-settings-actions'
            actions={
                <>
                    <Button onClick={handleCancel} disabled={isBusy}>
                        {labels.cancel}
                    </Button>
                    {onReset ? (
                        <Button onClick={() => void runAction(onReset)} disabled={!canReset} color='inherit'>
                            {labels.reset}
                        </Button>
                    ) : null}
                    <Button
                        variant='contained'
                        onClick={() => void runAction(() => onSave({ ...localValues }))}
                        disabled={!canSave}
                        aria-label={isBusy ? labels.saving : labels.save}
                    >
                        {isBusy ? <CircularProgress size={18} color='inherit' /> : labels.save}
                    </Button>
                </>
            }
        >
            <Stack spacing={2}>
                {error ? <Alert severity='error'>{error}</Alert> : null}
                {settings.map((setting) => {
                    const labelId = `${settingsId}-${setting.key}`
                    return (
                        <FormControl key={setting.key} disabled={readOnly || isBusy}>
                            <FormLabel id={labelId}>{setting.label}</FormLabel>
                            <RadioGroup
                                aria-labelledby={labelId}
                                value={localValues[setting.key] ?? setting.options[0]?.value ?? ''}
                                onChange={(event) => setLocalValues((current) => ({ ...current, [setting.key]: event.target.value }))}
                            >
                                {setting.options.map((option) => (
                                    <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} />
                                ))}
                            </RadioGroup>
                        </FormControl>
                    )
                })}
                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                    {inherited ? labels.inherited : labels.customized}
                </Typography>
            </Stack>
        </StandardDialog>
    )
}
