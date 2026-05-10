import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormHelperText,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { useTranslation } from 'react-i18next'
import {
    CATALOG_RECORD_MODES,
    RECORD_IMMUTABILITY_MODES,
    RECORD_NUMBERING_PERIODICITIES,
    RECORD_NUMBERING_SCOPES,
    RECORD_POSTING_MODES,
    isEnabledComponentConfig,
    type CatalogRecordBehavior,
    type ComponentManifest,
    type RecordLifecycleState
} from '@universo/types'

export interface RecordBehaviorOption {
    codename: string
    label: string
}

export interface RecordBehaviorFieldsProps {
    value: CatalogRecordBehavior
    onChange: (value: CatalogRecordBehavior) => void
    disabled?: boolean
    components: ComponentManifest
    fieldOptions: RecordBehaviorOption[]
    ledgerOptions: RecordBehaviorOption[]
    scriptOptions: RecordBehaviorOption[]
    errors?: Record<string, string>
}

const SECTION_SX = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 2,
    p: 2
} as const

const setEmptyToUndefined = (value: string): string | undefined => {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

const toSelectValue = (value?: string): string => value ?? ''

const appendConfiguredOption = (
    options: RecordBehaviorOption[],
    codename: string | undefined,
    configuredLabel: string
): RecordBehaviorOption[] => {
    const normalized = codename?.trim()
    if (!normalized || options.some((option) => option.codename === normalized)) {
        return options
    }
    return [...options, { codename: normalized, label: `${normalized} (${configuredLabel})` }]
}

const appendConfiguredOptions = (
    options: RecordBehaviorOption[],
    codenames: readonly string[],
    configuredLabel: string
): RecordBehaviorOption[] => {
    let nextOptions = options
    for (const codename of codenames) {
        nextOptions = appendConfiguredOption(nextOptions, codename, configuredLabel)
    }
    return nextOptions
}

export const RecordBehaviorFields = ({
    value,
    onChange,
    disabled = false,
    components,
    fieldOptions,
    ledgerOptions,
    scriptOptions,
    errors = {}
}: RecordBehaviorFieldsProps) => {
    const { t } = useTranslation('metahubs')
    const identityFields = isEnabledComponentConfig(components.identityFields) ? components.identityFields : null
    const recordLifecycle = isEnabledComponentConfig(components.recordLifecycle) ? components.recordLifecycle : null
    const posting = isEnabledComponentConfig(components.posting) ? components.posting : null
    const canConfigureIdentity = Boolean(identityFields)
    const canConfigureLifecycle = Boolean(recordLifecycle)
    const canConfigurePosting = Boolean(posting)
    const canConfigureNumbering = Boolean(identityFields?.allowNumber !== false && canConfigureIdentity)
    const canConfigureEffectiveDate = Boolean(identityFields?.allowEffectiveDate !== false && canConfigureIdentity)
    const configuredOptionLabel = t('entities.recordBehavior.options.configured', 'configured')
    const effectiveDateFieldOptions = appendConfiguredOption(fieldOptions, value.effectiveDate.fieldCodename, configuredOptionLabel)
    const lifecycleFieldOptions = appendConfiguredOption(fieldOptions, value.lifecycle.stateFieldCodename, configuredOptionLabel)
    const postingLedgerOptions = appendConfiguredOptions(ledgerOptions, value.posting.targetLedgers, configuredOptionLabel)
    const postingScriptOptions = appendConfiguredOption(scriptOptions, value.posting.scriptCodename, configuredOptionLabel)

    const patchBehavior = (patch: Partial<CatalogRecordBehavior>) => onChange({ ...value, ...patch })
    const patchNumbering = (patch: Partial<CatalogRecordBehavior['numbering']>) =>
        patchBehavior({ numbering: { ...value.numbering, ...patch } })
    const patchEffectiveDate = (patch: Partial<CatalogRecordBehavior['effectiveDate']>) =>
        patchBehavior({ effectiveDate: { ...value.effectiveDate, ...patch } })
    const patchLifecycle = (patch: Partial<CatalogRecordBehavior['lifecycle']>) =>
        patchBehavior({ lifecycle: { ...value.lifecycle, ...patch } })
    const patchPosting = (patch: Partial<CatalogRecordBehavior['posting']>) => patchBehavior({ posting: { ...value.posting, ...patch } })

    const updateState = (index: number, patch: Partial<RecordLifecycleState>) => {
        patchLifecycle({
            states: value.lifecycle.states.map((state, currentIndex) => (currentIndex === index ? { ...state, ...patch } : state))
        })
    }

    const removeState = (index: number) => {
        patchLifecycle({
            states: value.lifecycle.states.filter((_state, currentIndex) => currentIndex !== index)
        })
    }

    const addState = () => {
        const nextIndex = value.lifecycle.states.length + 1
        patchLifecycle({
            states: [
                ...value.lifecycle.states,
                {
                    codename: `State${nextIndex}`,
                    title: t('entities.recordBehavior.defaultStateTitle', 'State {{index}}', { index: nextIndex })
                }
            ]
        })
    }

    return (
        <Stack spacing={2}>
            {errors.recordBehavior ? <Alert severity='error'>{errors.recordBehavior}</Alert> : null}
            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.recordBehavior.mode.title', 'Record mode')}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'entities.recordBehavior.mode.helper',
                            'Choose whether records act as references, transactional documents, or a hybrid collection.'
                        )}
                    </Typography>
                    <FormControl fullWidth disabled={disabled} error={Boolean(errors.recordBehaviorMode)}>
                        <InputLabel id='record-behavior-mode-label'>{t('entities.recordBehavior.mode.label', 'Record mode')}</InputLabel>
                        <Select
                            labelId='record-behavior-mode-label'
                            label={t('entities.recordBehavior.mode.label', 'Record mode')}
                            value={value.mode}
                            onChange={(event) => patchBehavior({ mode: event.target.value as CatalogRecordBehavior['mode'] })}
                        >
                            {CATALOG_RECORD_MODES.map((mode) => (
                                <MenuItem key={mode} value={mode}>
                                    {t(`entities.recordBehavior.mode.options.${mode}`, mode)}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.recordBehaviorMode ? <FormHelperText>{errors.recordBehaviorMode}</FormHelperText> : null}
                    </FormControl>
                </Stack>
            </Box>

            {canConfigureIdentity ? (
                <Box sx={SECTION_SX}>
                    <Stack spacing={1.5}>
                        <Typography variant='subtitle2'>{t('entities.recordBehavior.identity.title', 'Identity fields')}</Typography>
                        {canConfigureNumbering ? (
                            <>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={value.numbering.enabled}
                                            onChange={(event) => patchNumbering({ enabled: event.target.checked })}
                                            disabled={disabled}
                                        />
                                    }
                                    label={t('entities.recordBehavior.numbering.enabled', 'Enable record numbering')}
                                />
                                {value.numbering.enabled ? (
                                    <Stack spacing={1.5}>
                                        <TextField
                                            label={t('entities.recordBehavior.numbering.prefix', 'Prefix')}
                                            value={value.numbering.prefix ?? ''}
                                            onChange={(event) => patchNumbering({ prefix: setEmptyToUndefined(event.target.value) })}
                                            disabled={disabled}
                                            fullWidth
                                        />
                                        <TextField
                                            label={t('entities.recordBehavior.numbering.minLength', 'Minimum length')}
                                            value={value.numbering.minLength ?? ''}
                                            onChange={(event) =>
                                                patchNumbering({
                                                    minLength: event.target.value ? Number(event.target.value) : undefined
                                                })
                                            }
                                            disabled={disabled}
                                            error={Boolean(errors.recordBehaviorMinLength)}
                                            helperText={errors.recordBehaviorMinLength}
                                            type='number'
                                            inputProps={{ min: 1, max: 32, step: 1 }}
                                            fullWidth
                                        />
                                        <FormControl fullWidth disabled={disabled}>
                                            <InputLabel id='record-numbering-scope-label'>
                                                {t('entities.recordBehavior.numbering.scope', 'Scope')}
                                            </InputLabel>
                                            <Select
                                                labelId='record-numbering-scope-label'
                                                label={t('entities.recordBehavior.numbering.scope', 'Scope')}
                                                value={value.numbering.scope}
                                                onChange={(event) =>
                                                    patchNumbering({
                                                        scope: event.target.value as CatalogRecordBehavior['numbering']['scope']
                                                    })
                                                }
                                            >
                                                {RECORD_NUMBERING_SCOPES.map((scope) => (
                                                    <MenuItem key={scope} value={scope}>
                                                        {t(`entities.recordBehavior.numbering.scopeOptions.${scope}`, scope)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl fullWidth disabled={disabled}>
                                            <InputLabel id='record-numbering-periodicity-label'>
                                                {t('entities.recordBehavior.numbering.periodicity', 'Periodicity')}
                                            </InputLabel>
                                            <Select
                                                labelId='record-numbering-periodicity-label'
                                                label={t('entities.recordBehavior.numbering.periodicity', 'Periodicity')}
                                                value={value.numbering.periodicity}
                                                onChange={(event) =>
                                                    patchNumbering({
                                                        periodicity: event.target.value as CatalogRecordBehavior['numbering']['periodicity']
                                                    })
                                                }
                                            >
                                                {RECORD_NUMBERING_PERIODICITIES.map((periodicity) => (
                                                    <MenuItem key={periodicity} value={periodicity}>
                                                        {t(
                                                            `entities.recordBehavior.numbering.periodicityOptions.${periodicity}`,
                                                            periodicity
                                                        )}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                ) : null}
                            </>
                        ) : null}
                        {canConfigureEffectiveDate ? (
                            <>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={value.effectiveDate.enabled}
                                            onChange={(event) => patchEffectiveDate({ enabled: event.target.checked })}
                                            disabled={disabled}
                                        />
                                    }
                                    label={t('entities.recordBehavior.effectiveDate.enabled', 'Enable effective date')}
                                />
                                {value.effectiveDate.enabled ? (
                                    <Stack spacing={1.5}>
                                        <FormControl fullWidth disabled={disabled || effectiveDateFieldOptions.length === 0}>
                                            <InputLabel id='record-date-field-label'>
                                                {t('entities.recordBehavior.effectiveDate.field', 'Date field')}
                                            </InputLabel>
                                            <Select
                                                labelId='record-date-field-label'
                                                label={t('entities.recordBehavior.effectiveDate.field', 'Date field')}
                                                value={toSelectValue(value.effectiveDate.fieldCodename)}
                                                onChange={(event) =>
                                                    patchEffectiveDate({ fieldCodename: setEmptyToUndefined(event.target.value) })
                                                }
                                            >
                                                <MenuItem value=''>{t('entities.recordBehavior.options.none', 'Not selected')}</MenuItem>
                                                {effectiveDateFieldOptions.map((option) => (
                                                    <MenuItem key={option.codename} value={option.codename}>
                                                        {option.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {fieldOptions.length === 0 ? (
                                                <FormHelperText>
                                                    {t(
                                                        'entities.recordBehavior.fieldOptionsCreateHint',
                                                        'Field-bound options can be selected after attributes are created.'
                                                    )}
                                                </FormHelperText>
                                            ) : null}
                                        </FormControl>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={value.effectiveDate.defaultToNow}
                                                    onChange={(event) => patchEffectiveDate({ defaultToNow: event.target.checked })}
                                                    disabled={disabled}
                                                />
                                            }
                                            label={t('entities.recordBehavior.effectiveDate.defaultToNow', 'Default to current time')}
                                        />
                                    </Stack>
                                ) : null}
                            </>
                        ) : null}
                    </Stack>
                </Box>
            ) : null}

            {canConfigureLifecycle ? (
                <Box sx={SECTION_SX}>
                    <Stack spacing={1.5}>
                        <Typography variant='subtitle2'>{t('entities.recordBehavior.lifecycle.title', 'Lifecycle')}</Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={value.lifecycle.enabled}
                                    onChange={(event) => patchLifecycle({ enabled: event.target.checked })}
                                    disabled={disabled}
                                />
                            }
                            label={t('entities.recordBehavior.lifecycle.enabled', 'Enable lifecycle states')}
                        />
                        {value.lifecycle.enabled ? (
                            <Stack spacing={1.5}>
                                <FormControl fullWidth disabled={disabled || lifecycleFieldOptions.length === 0}>
                                    <InputLabel id='record-state-field-label'>
                                        {t('entities.recordBehavior.lifecycle.field', 'State field')}
                                    </InputLabel>
                                    <Select
                                        labelId='record-state-field-label'
                                        label={t('entities.recordBehavior.lifecycle.field', 'State field')}
                                        value={toSelectValue(value.lifecycle.stateFieldCodename)}
                                        onChange={(event) =>
                                            patchLifecycle({ stateFieldCodename: setEmptyToUndefined(event.target.value) })
                                        }
                                    >
                                        <MenuItem value=''>{t('entities.recordBehavior.options.none', 'Not selected')}</MenuItem>
                                        {lifecycleFieldOptions.map((option) => (
                                            <MenuItem key={option.codename} value={option.codename}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {errors.recordBehaviorLifecycle ? <Alert severity='error'>{errors.recordBehaviorLifecycle}</Alert> : null}
                                {value.lifecycle.states.map((state, index) => (
                                    <Box key={`${state.codename}-${index}`} sx={SECTION_SX}>
                                        <Stack spacing={1.5}>
                                            <TextField
                                                label={t('entities.recordBehavior.lifecycle.stateCodename', 'State codename')}
                                                value={state.codename}
                                                onChange={(event) => updateState(index, { codename: event.target.value })}
                                                disabled={disabled}
                                                fullWidth
                                            />
                                            <TextField
                                                label={t('entities.recordBehavior.lifecycle.stateTitle', 'State title')}
                                                value={state.title}
                                                onChange={(event) => updateState(index, { title: event.target.value })}
                                                disabled={disabled}
                                                fullWidth
                                            />
                                            <FormGroup row>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={state.isInitial === true}
                                                            onChange={(event) =>
                                                                updateState(index, { isInitial: event.target.checked || undefined })
                                                            }
                                                            disabled={disabled}
                                                        />
                                                    }
                                                    label={t('entities.recordBehavior.lifecycle.initial', 'Initial')}
                                                />
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={state.isFinal === true}
                                                            onChange={(event) =>
                                                                updateState(index, { isFinal: event.target.checked || undefined })
                                                            }
                                                            disabled={disabled}
                                                        />
                                                    }
                                                    label={t('entities.recordBehavior.lifecycle.final', 'Final')}
                                                />
                                            </FormGroup>
                                            <Button
                                                startIcon={<DeleteRoundedIcon />}
                                                onClick={() => removeState(index)}
                                                disabled={disabled}
                                                color='inherit'
                                            >
                                                {t('common:actions.remove', 'Remove')}
                                            </Button>
                                        </Stack>
                                    </Box>
                                ))}
                                <Button startIcon={<AddRoundedIcon />} onClick={addState} disabled={disabled}>
                                    {t('entities.recordBehavior.lifecycle.addState', 'Add state')}
                                </Button>
                            </Stack>
                        ) : null}
                    </Stack>
                </Box>
            ) : null}

            {canConfigurePosting ? (
                <Box sx={SECTION_SX}>
                    <Stack spacing={1.5}>
                        <Typography variant='subtitle2'>{t('entities.recordBehavior.posting.title', 'Posting')}</Typography>
                        <FormControl fullWidth disabled={disabled} error={Boolean(errors.recordBehaviorPosting)}>
                            <InputLabel id='record-posting-mode-label'>
                                {t('entities.recordBehavior.posting.mode', 'Posting mode')}
                            </InputLabel>
                            <Select
                                labelId='record-posting-mode-label'
                                label={t('entities.recordBehavior.posting.mode', 'Posting mode')}
                                value={value.posting.mode}
                                onChange={(event) => patchPosting({ mode: event.target.value as CatalogRecordBehavior['posting']['mode'] })}
                            >
                                {RECORD_POSTING_MODES.filter(
                                    (mode) =>
                                        mode === 'disabled' ||
                                        (mode === 'manual' && posting.allowManualPosting !== false) ||
                                        (mode === 'automatic' && posting.allowAutomaticPosting !== false)
                                ).map((mode) => (
                                    <MenuItem key={mode} value={mode}>
                                        {t(`entities.recordBehavior.posting.modeOptions.${mode}`, mode)}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.recordBehaviorPosting ? <FormHelperText>{errors.recordBehaviorPosting}</FormHelperText> : null}
                        </FormControl>
                        <FormControl fullWidth disabled={disabled || postingLedgerOptions.length === 0}>
                            <InputLabel id='record-posting-ledgers-label'>
                                {t('entities.recordBehavior.posting.targetLedgers', 'Target ledgers')}
                            </InputLabel>
                            <Select
                                labelId='record-posting-ledgers-label'
                                multiple
                                value={value.posting.targetLedgers}
                                input={<OutlinedInput label={t('entities.recordBehavior.posting.targetLedgers', 'Target ledgers')} />}
                                onChange={(event) =>
                                    patchPosting({
                                        targetLedgers:
                                            typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value
                                    })
                                }
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((codename) => (
                                            <Chip
                                                key={codename}
                                                size='small'
                                                label={
                                                    postingLedgerOptions.find((option) => option.codename === codename)?.label ?? codename
                                                }
                                            />
                                        ))}
                                    </Box>
                                )}
                            >
                                {postingLedgerOptions.map((option) => (
                                    <MenuItem key={option.codename} value={option.codename}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {ledgerOptions.length === 0 ? (
                                <FormHelperText>
                                    {t('entities.recordBehavior.posting.noLedgers', 'Create a Ledger entity before selecting targets.')}
                                </FormHelperText>
                            ) : null}
                        </FormControl>
                        <FormControl fullWidth disabled={disabled || postingScriptOptions.length === 0}>
                            <InputLabel id='record-posting-script-label'>
                                {t('entities.recordBehavior.posting.script', 'Posting script')}
                            </InputLabel>
                            <Select
                                labelId='record-posting-script-label'
                                label={t('entities.recordBehavior.posting.script', 'Posting script')}
                                value={toSelectValue(value.posting.scriptCodename)}
                                onChange={(event) => patchPosting({ scriptCodename: setEmptyToUndefined(event.target.value) })}
                            >
                                <MenuItem value=''>{t('entities.recordBehavior.options.none', 'Not selected')}</MenuItem>
                                {postingScriptOptions.map((option) => (
                                    <MenuItem key={option.codename} value={option.codename}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            {scriptOptions.length === 0 ? (
                                <FormHelperText>
                                    {t(
                                        'entities.recordBehavior.posting.noScripts',
                                        'Attach a lifecycle script after the entity is created.'
                                    )}
                                </FormHelperText>
                            ) : null}
                        </FormControl>
                    </Stack>
                </Box>
            ) : null}

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.recordBehavior.immutability.title', 'Immutability')}</Typography>
                    <FormControl fullWidth disabled={disabled}>
                        <InputLabel id='record-immutability-label'>
                            {t('entities.recordBehavior.immutability.label', 'Immutability')}
                        </InputLabel>
                        <Select
                            labelId='record-immutability-label'
                            label={t('entities.recordBehavior.immutability.label', 'Immutability')}
                            value={value.immutability}
                            onChange={(event) =>
                                patchBehavior({ immutability: event.target.value as CatalogRecordBehavior['immutability'] })
                            }
                        >
                            {RECORD_IMMUTABILITY_MODES.map((mode) => (
                                <MenuItem key={mode} value={mode}>
                                    {t(`entities.recordBehavior.immutability.options.${mode}`, mode)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Box>
        </Stack>
    )
}

export default RecordBehaviorFields
