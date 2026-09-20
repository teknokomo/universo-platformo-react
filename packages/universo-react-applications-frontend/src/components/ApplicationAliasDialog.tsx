import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    Popper,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import { autocompleteClasses } from '@mui/material/Autocomplete'
import { styled } from '@mui/material/styles'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo-react/i18n'
import { StandardDialog } from '@universo-react/template-mui/components/dialogs'
import { buildPublicApplicationAddressPath } from '../utils/publicApplicationAddress'

export interface ApplicationAliasOption {
    id: string
    label: string
    secondaryLabel?: string | null
}

export interface ApplicationAliasDialogSubmit {
    applicationId: string
    alias: string
    makePrimary?: boolean
}

export interface ApplicationAliasDialogProps {
    open: boolean
    mode: 'create' | 'edit'
    fixedApplicationId?: string
    initialAlias?: string
    applications?: ApplicationAliasOption[]
    applicationsLoading?: boolean
    applicationsError?: boolean
    onRetryApplications?: () => void
    canMakePrimary?: boolean
    error?: string | null
    isBusy?: boolean
    onApplicationSearch?: (value: string) => void
    onClose: () => void
    onSubmit: (value: ApplicationAliasDialogSubmit) => void | Promise<void>
}

const StyledPopper = styled(Popper)(({ theme }) => ({
    boxShadow: theme.shadows[4],
    borderRadius: 10,
    [`& .${autocompleteClasses.paper}`]: {
        borderRadius: 10,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper
    },
    [`& .${autocompleteClasses.listbox}`]: {
        boxSizing: 'border-box',
        padding: 6
    }
}))

const normalizePreviewAlias = (value: string) => value.trim().toLowerCase()

export function ApplicationAliasDialog({
    open,
    mode,
    fixedApplicationId,
    initialAlias = '',
    applications = [],
    applicationsLoading = false,
    applicationsError = false,
    onRetryApplications,
    canMakePrimary = true,
    error,
    isBusy = false,
    onApplicationSearch,
    onClose,
    onSubmit
}: ApplicationAliasDialogProps) {
    const { t } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const [alias, setAlias] = useState(initialAlias)
    const [selectedApplication, setSelectedApplication] = useState<ApplicationAliasOption | null>(null)
    const [makePrimary, setMakePrimary] = useState(false)

    useEffect(() => {
        if (!open) return
        setAlias(initialAlias)
        setSelectedApplication(null)
        setMakePrimary(false)
    }, [initialAlias, open])

    const normalizedAlias = useMemo(() => normalizePreviewAlias(alias), [alias])
    const applicationId = fixedApplicationId ?? selectedApplication?.id ?? ''
    const canSubmit = Boolean(applicationId && normalizedAlias) && !isBusy

    const handleSubmit = async () => {
        if (!canSubmit) return
        await onSubmit({
            applicationId,
            alias: normalizedAlias,
            ...(mode === 'create' ? { makePrimary } : {})
        })
    }

    return (
        <StandardDialog
            open={open}
            onClose={() => onClose()}
            title={t(mode === 'create' ? 'aliases.dialog.createTitle' : 'aliases.dialog.editTitle')}
            maxWidth='sm'
            isBusy={isBusy}
            actions={
                <>
                    <Button onClick={onClose} disabled={isBusy}>
                        {t('aliases.actions.cancel')}
                    </Button>
                    <Button variant='contained' onClick={() => void handleSubmit()} disabled={!canSubmit}>
                        {mode === 'create' ? tc('addNew') : t('aliases.actions.save')}
                    </Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ pt: 1 }}>
                {!fixedApplicationId && mode === 'create' ? (
                    <Stack spacing={1}>
                        {applicationsError ? (
                            <Alert
                                severity='error'
                                action={
                                    onRetryApplications ? (
                                        <Button color='inherit' size='small' onClick={onRetryApplications} disabled={applicationsLoading}>
                                            {t('aliases.dialog.retryApplications')}
                                        </Button>
                                    ) : undefined
                                }
                            >
                                {t('aliases.dialog.applicationLoadError')}
                            </Alert>
                        ) : null}
                        <Autocomplete
                            size='small'
                            disableClearable
                            options={applications}
                            value={selectedApplication}
                            loading={applicationsLoading}
                            loadingText={t('aliases.dialog.applicationLoading')}
                            noOptionsText={
                                applicationsError ? t('aliases.dialog.applicationLoadError') : t('aliases.dialog.applicationEmpty')
                            }
                            onChange={(_event, value) => setSelectedApplication(value)}
                            onInputChange={(_event, value, reason) => {
                                if (reason === 'input') onApplicationSearch?.(value)
                            }}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            popupIcon={<UnfoldMoreRoundedIcon fontSize='small' />}
                            slots={{ popper: StyledPopper }}
                            slotProps={{
                                popupIndicator: {
                                    disableRipple: true,
                                    sx: {
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                        padding: 0.5,
                                        '&:hover': { backgroundColor: 'transparent' }
                                    }
                                }
                            }}
                            sx={{
                                '& .MuiInputBase-root': { minHeight: 40 },
                                '& .MuiAutocomplete-endAdornment': {
                                    top: '50%',
                                    transform: 'translateY(-50%)'
                                },
                                '& .MuiAutocomplete-popupIndicator': {
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    boxShadow: 'none'
                                }
                            }}
                            renderOption={(props, option) => (
                                <Box component='li' {...props} key={option.id}>
                                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                        <Typography variant='body2'>{option.label}</Typography>
                                        {option.secondaryLabel ? (
                                            <Typography variant='caption' color='text.secondary'>
                                                {option.secondaryLabel}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size='small'
                                    required
                                    label={t('aliases.dialog.application')}
                                    helperText={t('aliases.dialog.applicationHelp')}
                                    slotProps={{
                                        ...params.slotProps,
                                        input: {
                                            ...params.slotProps.input,
                                            endAdornment: (
                                                <>
                                                    {applicationsLoading ? <CircularProgress color='inherit' size={16} /> : null}
                                                    {params.slotProps.input.endAdornment}
                                                </>
                                            )
                                        }
                                    }}
                                />
                            )}
                        />
                    </Stack>
                ) : null}

                <TextField
                    required
                    value={alias}
                    onChange={(event) => setAlias(event.target.value)}
                    label={t('aliases.dialog.alias')}
                    helperText={error || t('aliases.dialog.aliasHelp')}
                    error={Boolean(error)}
                    slotProps={{
                        htmlInput: {
                            autoCapitalize: 'none',
                            autoCorrect: 'off',
                            spellCheck: false
                        }
                    }}
                />

                <TextField
                    value={normalizedAlias ? buildPublicApplicationAddressPath(normalizedAlias) : '/a/…'}
                    label={t('aliases.dialog.preview')}
                    slotProps={{ input: { readOnly: true } }}
                    id='application-alias-preview'
                />

                {mode === 'create' && canMakePrimary ? (
                    <FormControlLabel
                        control={<Checkbox checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} />}
                        label={t('aliases.dialog.makePrimary')}
                    />
                ) : null}
            </Stack>
        </StandardDialog>
    )
}

export default ApplicationAliasDialog
