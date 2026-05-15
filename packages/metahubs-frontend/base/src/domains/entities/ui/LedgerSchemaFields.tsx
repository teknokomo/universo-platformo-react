import {
    Alert,
    Box,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
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
    LEDGER_FIELD_ROLES,
    LEDGER_MODES,
    LEDGER_MUTATION_POLICIES,
    LEDGER_PERIODICITIES,
    LEDGER_PROJECTION_KINDS,
    LEDGER_RESOURCE_AGGREGATES,
    LEDGER_SOURCE_POLICIES,
    isEnabledCapabilityConfig,
    type EntityTypeCapabilities,
    type LedgerConfig,
    type LedgerFieldRole,
    type LedgerProjectionDefinition
} from '@universo/types'
import type { RecordBehaviorOption } from './RecordBehaviorFields'

export interface LedgerSchemaFieldsProps {
    value: LedgerConfig
    onChange: (value: LedgerConfig) => void
    disabled?: boolean
    capabilities: EntityTypeCapabilities
    fieldOptions: RecordBehaviorOption[]
    entityKindOptions: RecordBehaviorOption[]
    errors?: Record<string, string>
}

const SECTION_SX = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 2,
    p: 2
} as const

const configuredLabel = (value: string, suffix: string): RecordBehaviorOption => ({ codename: value, label: `${value} (${suffix})` })

const appendConfiguredOptions = (options: RecordBehaviorOption[], values: readonly string[], suffix: string): RecordBehaviorOption[] => {
    let next = options
    for (const rawValue of values) {
        const value = rawValue.trim()
        if (value && !next.some((option) => option.codename === value)) {
            next = [...next, configuredLabel(value, suffix)]
        }
    }
    return next
}

const selectValues = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const normalizeCsvValue = (value: string): string[] =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

const removeAt = <T,>(items: T[], index: number): T[] => items.filter((_item, currentIndex) => currentIndex !== index)

export const LedgerSchemaFields = ({
    value,
    onChange,
    disabled = false,
    capabilities,
    fieldOptions,
    entityKindOptions,
    errors = {}
}: LedgerSchemaFieldsProps) => {
    const { t } = useTranslation('metahubs')
    const componentConfig = isEnabledCapabilityConfig(capabilities.ledgerSchema) ? capabilities.ledgerSchema : null
    const allowProjections = componentConfig?.allowProjections !== false
    const allowRegistrarPolicy = componentConfig?.allowRegistrarPolicy !== false
    const allowManualFacts = componentConfig?.allowManualFacts === true
    const configuredOptionText = t('entities.recordBehavior.options.configured', 'configured')
    const fieldSelectOptions = appendConfiguredOptions(
        fieldOptions,
        [
            value.effectiveDateField ?? '',
            ...value.fieldRoles.map((role) => role.fieldCodename),
            ...value.projections.flatMap((projection) => [...projection.dimensions, ...projection.resources]),
            ...value.idempotency.keyFields
        ],
        configuredOptionText
    )
    const registrarOptions = appendConfiguredOptions(entityKindOptions, value.registrarKinds, configuredOptionText)
    const modeOptions = componentConfig?.allowedModes?.length ? componentConfig.allowedModes : LEDGER_MODES

    const patchConfig = (patch: Partial<LedgerConfig>) => onChange({ ...value, ...patch })
    const updateRole = (index: number, patch: Partial<LedgerFieldRole>) =>
        patchConfig({
            fieldRoles: value.fieldRoles.map((role, currentIndex) => (currentIndex === index ? { ...role, ...patch } : role))
        })
    const addRole = () =>
        patchConfig({
            fieldRoles: [...value.fieldRoles, { fieldCodename: fieldSelectOptions[0]?.codename ?? '', role: 'dimension' }]
        })
    const updateProjection = (index: number, patch: Partial<LedgerProjectionDefinition>) =>
        patchConfig({
            projections: value.projections.map((projection, currentIndex) =>
                currentIndex === index ? { ...projection, ...patch } : projection
            )
        })
    const addProjection = () =>
        patchConfig({
            projections: [
                ...value.projections,
                {
                    codename: `Projection${value.projections.length + 1}`,
                    kind: 'balance',
                    dimensions: [],
                    resources: [],
                    period: value.periodicity
                }
            ]
        })

    return (
        <Stack spacing={2}>
            {errors.ledgerConfig ? <Alert severity='error'>{errors.ledgerConfig}</Alert> : null}

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.ledgerSchema.mode.title', 'Ledger mode')}</Typography>
                    <FormControl fullWidth disabled={disabled} error={Boolean(errors.ledgerMode)}>
                        <InputLabel id='ledger-mode-label'>{t('entities.ledgerSchema.mode.label', 'Ledger mode')}</InputLabel>
                        <Select
                            labelId='ledger-mode-label'
                            label={t('entities.ledgerSchema.mode.label', 'Ledger mode')}
                            value={value.mode}
                            onChange={(event) => patchConfig({ mode: event.target.value as LedgerConfig['mode'] })}
                        >
                            {modeOptions.map((mode) => (
                                <MenuItem key={mode} value={mode}>
                                    {t(`entities.ledgerSchema.mode.options.${mode}`, mode)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={disabled}>
                        <InputLabel id='ledger-mutation-policy-label'>
                            {t('entities.ledgerSchema.mutationPolicy.label', 'Mutation policy')}
                        </InputLabel>
                        <Select
                            labelId='ledger-mutation-policy-label'
                            label={t('entities.ledgerSchema.mutationPolicy.label', 'Mutation policy')}
                            value={value.mutationPolicy}
                            onChange={(event) => patchConfig({ mutationPolicy: event.target.value as LedgerConfig['mutationPolicy'] })}
                        >
                            {LEDGER_MUTATION_POLICIES.map((policy) => (
                                <MenuItem key={policy} value={policy}>
                                    {t(`entities.ledgerSchema.mutationPolicy.options.${policy}`, policy)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={disabled}>
                        <InputLabel id='ledger-source-policy-label'>
                            {t('entities.ledgerSchema.sourcePolicy.label', 'Source policy')}
                        </InputLabel>
                        <Select
                            labelId='ledger-source-policy-label'
                            label={t('entities.ledgerSchema.sourcePolicy.label', 'Source policy')}
                            value={value.sourcePolicy}
                            onChange={(event) => patchConfig({ sourcePolicy: event.target.value as LedgerConfig['sourcePolicy'] })}
                        >
                            {LEDGER_SOURCE_POLICIES.filter((policy) => allowManualFacts || policy !== 'manual').map((policy) => (
                                <MenuItem key={policy} value={policy} disabled={!allowRegistrarPolicy && policy !== 'manual'}>
                                    {t(`entities.ledgerSchema.sourcePolicy.options.${policy}`, policy)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.ledgerSchema.period.title', 'Period')}</Typography>
                    <FormControl fullWidth disabled={disabled}>
                        <InputLabel id='ledger-periodicity-label'>{t('entities.ledgerSchema.periodicity.label', 'Periodicity')}</InputLabel>
                        <Select
                            labelId='ledger-periodicity-label'
                            label={t('entities.ledgerSchema.periodicity.label', 'Periodicity')}
                            value={value.periodicity}
                            onChange={(event) => patchConfig({ periodicity: event.target.value as LedgerConfig['periodicity'] })}
                        >
                            {LEDGER_PERIODICITIES.map((periodicity) => (
                                <MenuItem key={periodicity} value={periodicity}>
                                    {t(`entities.ledgerSchema.periodicity.options.${periodicity}`, periodicity)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth disabled={disabled}>
                        <InputLabel id='ledger-effective-date-label'>
                            {t('entities.ledgerSchema.effectiveDateField.label', 'Effective date field')}
                        </InputLabel>
                        <Select
                            labelId='ledger-effective-date-label'
                            label={t('entities.ledgerSchema.effectiveDateField.label', 'Effective date field')}
                            value={value.effectiveDateField ?? ''}
                            onChange={(event) =>
                                patchConfig({ effectiveDateField: event.target.value ? String(event.target.value) : undefined })
                            }
                        >
                            <MenuItem value=''>{t('entities.recordBehavior.options.none', 'Not selected')}</MenuItem>
                            {fieldSelectOptions.map((field) => (
                                <MenuItem key={field.codename} value={field.codename}>
                                    {field.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.ledgerSchema.registrars.title', 'Registrars')}</Typography>
                    <FormControl fullWidth disabled={disabled || !allowRegistrarPolicy}>
                        <InputLabel id='ledger-registrar-kinds-label'>
                            {t('entities.ledgerSchema.registrars.label', 'Registrar kinds')}
                        </InputLabel>
                        <Select
                            multiple
                            labelId='ledger-registrar-kinds-label'
                            label={t('entities.ledgerSchema.registrars.label', 'Registrar kinds')}
                            value={value.registrarKinds}
                            input={<OutlinedInput label={t('entities.ledgerSchema.registrars.label', 'Registrar kinds')} />}
                            onChange={(event) => patchConfig({ registrarKinds: selectValues(event.target.value) })}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((selectedValue) => (
                                        <Chip key={selectedValue} size='small' label={selectedValue} />
                                    ))}
                                </Box>
                            )}
                        >
                            {registrarOptions.map((option) => (
                                <MenuItem key={option.codename} value={option.codename}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                        <Typography variant='subtitle2'>{t('entities.ledgerSchema.fieldRoles.title', 'Field roles')}</Typography>
                        <Chip
                            icon={<AddRoundedIcon fontSize='small' />}
                            label={t('entities.ledgerSchema.fieldRoles.add', 'Add role')}
                            onClick={disabled ? undefined : addRole}
                            size='small'
                            variant='outlined'
                        />
                    </Stack>
                    {value.fieldRoles.length === 0 ? (
                        <Typography variant='body2' color='text.secondary'>
                            {t('entities.ledgerSchema.fieldRoles.empty', 'No field roles configured.')}
                        </Typography>
                    ) : null}
                    {value.fieldRoles.map((role, index) => (
                        <Stack
                            key={`${role.fieldCodename}-${index}`}
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems='center'
                        >
                            <FormControl fullWidth disabled={disabled}>
                                <InputLabel id={`ledger-role-field-${index}`}>
                                    {t('entities.ledgerSchema.fieldRoles.field', 'Field')}
                                </InputLabel>
                                <Select
                                    labelId={`ledger-role-field-${index}`}
                                    label={t('entities.ledgerSchema.fieldRoles.field', 'Field')}
                                    value={role.fieldCodename}
                                    onChange={(event) => updateRole(index, { fieldCodename: String(event.target.value) })}
                                >
                                    {fieldSelectOptions.map((field) => (
                                        <MenuItem key={field.codename} value={field.codename}>
                                            {field.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth disabled={disabled}>
                                <InputLabel id={`ledger-role-kind-${index}`}>
                                    {t('entities.ledgerSchema.fieldRoles.role', 'Role')}
                                </InputLabel>
                                <Select
                                    labelId={`ledger-role-kind-${index}`}
                                    label={t('entities.ledgerSchema.fieldRoles.role', 'Role')}
                                    value={role.role}
                                    onChange={(event) => updateRole(index, { role: event.target.value as LedgerFieldRole['role'] })}
                                >
                                    {LEDGER_FIELD_ROLES.map((roleKind) => (
                                        <MenuItem key={roleKind} value={roleKind}>
                                            {t(`entities.ledgerSchema.fieldRoles.roleOptions.${roleKind}`, roleKind)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {role.role === 'resource' ? (
                                <FormControl fullWidth disabled={disabled}>
                                    <InputLabel id={`ledger-role-aggregate-${index}`}>
                                        {t('entities.ledgerSchema.fieldRoles.aggregate', 'Aggregate')}
                                    </InputLabel>
                                    <Select
                                        labelId={`ledger-role-aggregate-${index}`}
                                        label={t('entities.ledgerSchema.fieldRoles.aggregate', 'Aggregate')}
                                        value={role.aggregate ?? 'sum'}
                                        onChange={(event) =>
                                            updateRole(index, { aggregate: event.target.value as LedgerFieldRole['aggregate'] })
                                        }
                                    >
                                        {LEDGER_RESOURCE_AGGREGATES.map((aggregate) => (
                                            <MenuItem key={aggregate} value={aggregate}>
                                                {t(`entities.ledgerSchema.fieldRoles.aggregateOptions.${aggregate}`, aggregate)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ) : null}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={role.required === true}
                                        disabled={disabled}
                                        onChange={(event) => updateRole(index, { required: event.target.checked || undefined })}
                                    />
                                }
                                label={t('entities.ledgerSchema.fieldRoles.required', 'Required')}
                            />
                            <Chip
                                icon={<DeleteRoundedIcon fontSize='small' />}
                                label={t('common:actions.delete', 'Delete')}
                                onClick={disabled ? undefined : () => patchConfig({ fieldRoles: removeAt(value.fieldRoles, index) })}
                                size='small'
                                variant='outlined'
                            />
                        </Stack>
                    ))}
                </Stack>
            </Box>

            {allowProjections ? (
                <Box sx={SECTION_SX}>
                    <Stack spacing={1.5}>
                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                            <Typography variant='subtitle2'>{t('entities.ledgerSchema.projections.title', 'Projections')}</Typography>
                            <Chip
                                icon={<AddRoundedIcon fontSize='small' />}
                                label={t('entities.ledgerSchema.projections.add', 'Add projection')}
                                onClick={disabled ? undefined : addProjection}
                                size='small'
                                variant='outlined'
                            />
                        </Stack>
                        {value.projections.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                {t('entities.ledgerSchema.projections.empty', 'No projections configured.')}
                            </Typography>
                        ) : null}
                        {value.projections.map((projection, index) => (
                            <Stack key={`${projection.codename}-${index}`} spacing={1.5} sx={SECTION_SX}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <TextField
                                        label={t('entities.ledgerSchema.projections.codename', 'Codename')}
                                        value={projection.codename}
                                        disabled={disabled}
                                        onChange={(event) => updateProjection(index, { codename: event.target.value })}
                                        fullWidth
                                    />
                                    <FormControl fullWidth disabled={disabled}>
                                        <InputLabel id={`ledger-projection-kind-${index}`}>
                                            {t('entities.ledgerSchema.projections.kind', 'Kind')}
                                        </InputLabel>
                                        <Select
                                            labelId={`ledger-projection-kind-${index}`}
                                            label={t('entities.ledgerSchema.projections.kind', 'Kind')}
                                            value={projection.kind}
                                            onChange={(event) =>
                                                updateProjection(index, { kind: event.target.value as LedgerProjectionDefinition['kind'] })
                                            }
                                        >
                                            {LEDGER_PROJECTION_KINDS.map((kind) => (
                                                <MenuItem key={kind} value={kind}>
                                                    {t(`entities.ledgerSchema.projections.kindOptions.${kind}`, kind)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                                <TextField
                                    label={t('entities.ledgerSchema.projections.dimensions', 'Dimensions')}
                                    value={projection.dimensions.join(', ')}
                                    disabled={disabled}
                                    onChange={(event) => updateProjection(index, { dimensions: normalizeCsvValue(event.target.value) })}
                                    helperText={t('entities.ledgerSchema.projections.csvHelper', 'Comma-separated field codenames')}
                                    fullWidth
                                />
                                <TextField
                                    label={t('entities.ledgerSchema.projections.resources', 'Resources')}
                                    value={projection.resources.join(', ')}
                                    disabled={disabled}
                                    onChange={(event) => updateProjection(index, { resources: normalizeCsvValue(event.target.value) })}
                                    helperText={t('entities.ledgerSchema.projections.csvHelper', 'Comma-separated field codenames')}
                                    fullWidth
                                />
                                <Chip
                                    icon={<DeleteRoundedIcon fontSize='small' />}
                                    label={t('common:actions.delete', 'Delete')}
                                    onClick={disabled ? undefined : () => patchConfig({ projections: removeAt(value.projections, index) })}
                                    size='small'
                                    variant='outlined'
                                />
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            ) : null}

            <Box sx={SECTION_SX}>
                <Stack spacing={1.5}>
                    <Typography variant='subtitle2'>{t('entities.ledgerSchema.idempotency.title', 'Idempotency')}</Typography>
                    <TextField
                        label={t('entities.ledgerSchema.idempotency.keyFields', 'Key fields')}
                        value={value.idempotency.keyFields.join(', ')}
                        disabled={disabled}
                        onChange={(event) =>
                            patchConfig({ idempotency: { ...value.idempotency, keyFields: normalizeCsvValue(event.target.value) } })
                        }
                        helperText={
                            errors.ledgerIdempotency || t('entities.ledgerSchema.projections.csvHelper', 'Comma-separated field codenames')
                        }
                        error={Boolean(errors.ledgerIdempotency)}
                        fullWidth
                    />
                    {fieldSelectOptions.length === 0 ? (
                        <FormHelperText>
                            {t(
                                'entities.ledgerSchema.fieldOptionsCreateHint',
                                'Create fields first, then reopen this tab to select them from a list.'
                            )}
                        </FormHelperText>
                    ) : null}
                </Stack>
            </Box>
        </Stack>
    )
}

export default LedgerSchemaFields
