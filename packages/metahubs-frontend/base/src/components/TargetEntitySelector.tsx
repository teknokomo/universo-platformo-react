import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Stack,
    Typography,
    TextField,
    Chip,
    CircularProgress,
    Popper
} from '@mui/material'
import Autocomplete, { autocompleteClasses } from '@mui/material/Autocomplete'
import { styled } from '@mui/material/styles'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import { isBuiltinEntityKind, isEnabledComponentConfig, type EntityKind } from '@universo/types'
import { getVLCString } from '../types'
import type { FixedValue } from '../types'
import { listFixedValuesDirect } from '../domains/entities/metadata/fixedValue/api'
import { listEntityInstances, type MetahubEntityInstance } from '../domains/entities/api/entityInstances'
import { listEntityTypes, type MetahubEntityType } from '../domains/entities/api/entityTypes'
import { metahubsQueryKeys } from '../domains/shared'

const isReferenceableEntityType = (entityType: MetahubEntityType) =>
    entityType.kindKey === 'enumeration' || isEnabledComponentConfig(entityType.components.dataSchema)

const shouldTranslateEntityTypeUiText = (kindKey: string) => isBuiltinEntityKind(kindKey)

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

export interface TargetEntitySelectorProps {
    /** Metahub ID for loading available entities */
    metahubId: string
    /** Currently selected target entity kind */
    targetEntityKind: EntityKind | null | undefined
    /** Currently selected target entity ID */
    targetEntityId: string | null | undefined
    /** Callback when target entity kind changes */
    onEntityKindChange: (kind: EntityKind | null) => void
    /** Callback when target entity ID changes */
    onEntityIdChange: (id: string | null) => void
    /** Currently selected target constant ID (used when target entity kind is set) */
    targetConstantId?: string | null
    /** Callback when target constant ID changes */
    onTargetConstantIdChange?: (id: string | null) => void
    /** ID of current catalog to exclude from selection (prevent self-reference) */
    excludeLinkedCollectionId?: string
    /** Whether the selector is disabled */
    disabled?: boolean
    /** Error message to display */
    error?: string | null
    /** Error message to display for constant selector */
    targetConstantError?: string | null
    /** Current UI locale for entity name display */
    uiLocale?: string
}

/**
 * Component for selecting target entity for REF (reference) field type.
 * Allows selecting entity kind and then the specific entity.
 *
 * Loads available entities (linkedCollections/optionLists) automatically from the API.
 */
export const TargetEntitySelector = ({
    metahubId,
    targetEntityKind,
    targetEntityId,
    onEntityKindChange,
    onEntityIdChange,
    targetConstantId,
    onTargetConstantIdChange,
    excludeLinkedCollectionId,
    disabled = false,
    error,
    targetConstantError,
    uiLocale = 'en'
}: TargetEntitySelectorProps) => {
    const { t } = useTranslation('metahubs')
    const listParams = useMemo(
        () => ({
            limit: 500,
            offset: 0 as const,
            sortBy: 'updated' as const,
            sortOrder: 'desc' as const
        }),
        []
    )

    const entityTypeListParams = useMemo(
        () => ({
            ...listParams
        }),
        [listParams]
    )

    const { data: entityTypesData, isLoading: isLoadingEntityTypes } = useQuery({
        queryKey: metahubsQueryKeys.entityTypesList(metahubId, entityTypeListParams),
        queryFn: () => listEntityTypes(metahubId, entityTypeListParams),
        enabled: !!metahubId,
        staleTime: 30000
    })

    const { data: constantsData, isLoading: isLoadingConstants } = useQuery({
        queryKey: targetEntityId
            ? metahubsQueryKeys.fixedValuesListDirect(metahubId, targetEntityId, {
                  ...listParams,
                  locale: uiLocale,
                  includeShared: true
              })
            : ['metahubs', 'fixedValues', 'empty'],
        queryFn: () => listFixedValuesDirect(metahubId, targetEntityId!, { ...listParams, locale: uiLocale, includeShared: true }),
        enabled: !!metahubId && targetEntityKind === 'set' && !!targetEntityId,
        staleTime: 30000 // 30 seconds
    })

    const { data: targetEntitiesData, isLoading: isLoadingTargetEntities } = useQuery({
        queryKey:
            metahubId && targetEntityKind
                ? metahubsQueryKeys.entitiesList(metahubId, { ...listParams, kind: targetEntityKind, locale: uiLocale })
                : ['metahubs', 'entities', 'empty'],
        queryFn: () => listEntityInstances(metahubId, { ...listParams, kind: targetEntityKind!, locale: uiLocale }),
        enabled: !!metahubId && !!targetEntityKind,
        staleTime: 30000
    })

    const availableConstants = useMemo(() => constantsData?.items ?? [], [constantsData?.items])
    const availableEntityTypes = useMemo(
        () => (entityTypesData?.items ?? []).filter((entityType) => isReferenceableEntityType(entityType)),
        [entityTypesData?.items]
    )
    const availableTargetEntities = useMemo(() => targetEntitiesData?.items ?? [], [targetEntitiesData?.items])

    // Entity kind options with localized labels
    const getEntityTypeDisplayName = useCallback(
        (entityType: MetahubEntityType): string => {
            const codename = getVLCString(entityType.codename, uiLocale) || getVLCString(entityType.codename, 'en')
            if (shouldTranslateEntityTypeUiText(entityType.kindKey)) {
                const translated = entityType.ui.nameKey ? t(entityType.ui.nameKey, { defaultValue: '' }) : ''
                return translated || codename || entityType.kindKey
            }

            return entityType.ui.nameKey || codename || entityType.kindKey
        },
        [t, uiLocale]
    )

    const entityKindOptions = useMemo(
        () =>
            availableEntityTypes.map((entityType) => ({
                value: entityType.kindKey as EntityKind,
                label: getEntityTypeDisplayName(entityType)
            })),
        [availableEntityTypes, getEntityTypeDisplayName]
    )

    // Get display name for constant
    const getConstantDisplayName = useCallback(
        (constant: FixedValue): string => {
            return getVLCString(constant.name, uiLocale) || getVLCString(constant.name, 'en') || constant.codename
        },
        [uiLocale]
    )
    const getTargetEntityDisplayName = useCallback(
        (entity: MetahubEntityInstance): string => {
            return (
                getVLCString(entity.name, uiLocale) ||
                getVLCString(entity.name, 'en') ||
                getVLCString(entity.codename, uiLocale) ||
                getVLCString(entity.codename, 'en') ||
                String(entity.codename ?? entity.id)
            )
        },
        [uiLocale]
    )

    const selectedTargetEntity = useMemo(() => {
        if (!targetEntityId || !targetEntityKind) return null
        return availableTargetEntities.find((entity) => entity.id === targetEntityId) || null
    }, [targetEntityId, targetEntityKind, availableTargetEntities])
    // Find selected constant
    const selectedConstant = useMemo(() => {
        if (!targetConstantId || targetEntityKind !== 'set') return null
        return availableConstants.find((constant) => constant.id === targetConstantId) || null
    }, [targetConstantId, targetEntityKind, availableConstants])

    // Handle entity kind change
    const handleKindChange = useCallback(
        (newKind: EntityKind | null) => {
            onEntityKindChange(newKind)
            // Clear entity ID when kind changes
            if (newKind !== targetEntityKind) {
                onEntityIdChange(null)
                onTargetConstantIdChange?.(null)
            }
        },
        [onEntityKindChange, onEntityIdChange, onTargetConstantIdChange, targetEntityKind]
    )

    const handleTargetEntityChange = useCallback(
        (_event: unknown, newValue: MetahubEntityInstance | null) => {
            onEntityIdChange(newValue?.id || null)
            if (targetEntityKind === 'set') {
                onTargetConstantIdChange?.(null)
            }
        },
        [onEntityIdChange, onTargetConstantIdChange, targetEntityKind]
    )

    const handleConstantChange = useCallback(
        (_event: unknown, newValue: FixedValue | null) => {
            onTargetConstantIdChange?.(newValue?.id || null)
        },
        [onTargetConstantIdChange]
    )
    // Filter out the current catalog to prevent self-reference
    const selectableTargetEntities = useMemo(() => {
        if (!(excludeLinkedCollectionId && targetEntityKind === 'catalog')) return availableTargetEntities
        return availableTargetEntities.filter((entity) => entity.id !== excludeLinkedCollectionId)
    }, [availableTargetEntities, excludeLinkedCollectionId, targetEntityKind])

    const targetEntityLabel =
        targetEntityKind === 'catalog'
            ? t('ref.targetCatalog', 'Target LinkedCollectionEntity')
            : targetEntityKind === 'enumeration'
            ? t('ref.targetEnumeration', 'Target OptionListEntity')
            : targetEntityKind === 'set'
            ? t('ref.targetSet', 'Target Set')
            : t('ref.targetEntity', 'Target Entity')

    const targetEntityPlaceholder =
        targetEntityKind === 'catalog'
            ? t('ref.selectCatalog', 'Select catalog...')
            : targetEntityKind === 'enumeration'
            ? t('ref.selectEnumeration', 'Select enumeration...')
            : targetEntityKind === 'set'
            ? t('ref.selectSet', 'Select set...')
            : t('ref.selectEntity', 'Select entity...')

    const targetEntityHelperText =
        !targetEntityId && error
            ? targetEntityKind === 'catalog'
                ? t('ref.catalogRequired', 'Please select a catalog')
                : targetEntityKind === 'enumeration'
                ? t('ref.enumerationRequired', 'Please select an enumeration')
                : targetEntityKind === 'set'
                ? t('ref.setRequired', 'Please select a set')
                : t('ref.entityRequired', 'Please select an entity')
            : undefined

    const targetEntityNoOptionsText =
        targetEntityKind === 'catalog'
            ? t('ref.noCatalogsAvailable', 'No linkedCollections available')
            : targetEntityKind === 'enumeration'
            ? t('ref.noEnumerationsAvailable', 'No optionLists available')
            : targetEntityKind === 'set'
            ? t('ref.noSetsAvailable', 'No valueGroups available')
            : t('ref.noEntitiesAvailable', 'No entities available')

    const isKindSupported =
        !targetEntityKind || isLoadingEntityTypes || entityKindOptions.some((option) => option.value === targetEntityKind)

    return (
        <Stack spacing={2}>
            {/* Entity Kind Selector */}
            <FormControl fullWidth size='small' disabled={disabled} error={Boolean(error)}>
                <InputLabel id='target-entity-kind-label'>{t('ref.targetEntityKind', 'Target Entity Type')}</InputLabel>
                <Select
                    labelId='target-entity-kind-label'
                    label={t('ref.targetEntityKind', 'Target Entity Type')}
                    value={targetEntityKind || ''}
                    onChange={(e) => handleKindChange((e.target.value as EntityKind) || null)}
                >
                    <MenuItem value=''>
                        <em>{t('ref.notSelected', 'Not selected')}</em>
                    </MenuItem>
                    {entityKindOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </Select>
                {error && <FormHelperText>{error}</FormHelperText>}
            </FormControl>

            {/* Entity Selector */}
            {targetEntityKind && isKindSupported && (
                <Autocomplete
                    size='small'
                    disabled={disabled}
                    disableClearable
                    options={selectableTargetEntities}
                    value={selectedTargetEntity}
                    onChange={handleTargetEntityChange}
                    getOptionLabel={(entity) => getTargetEntityDisplayName(entity)}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<UnfoldMoreRoundedIcon fontSize='small' />}
                    PopperComponent={StyledPopper}
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
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            size='small'
                            label={targetEntityLabel}
                            placeholder={targetEntityPlaceholder}
                            error={Boolean(error && !targetEntityId)}
                            helperText={targetEntityHelperText}
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {isLoadingTargetEntities ? <CircularProgress color='inherit' size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                )
                            }}
                        />
                    )}
                    renderOption={(props, entity) => (
                        <Box component='li' {...props} key={entity.id}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography variant='body2'>{getTargetEntityDisplayName(entity)}</Typography>
                                <Chip label={String(entity.codename ?? entity.id)} size='small' variant='outlined' sx={{ fontSize: 11 }} />
                            </Stack>
                        </Box>
                    )}
                    noOptionsText={targetEntityNoOptionsText}
                    loading={isLoadingTargetEntities}
                    loadingText={t('common.loading', 'Loading...')}
                />
            )}

            {targetEntityKind === 'set' && targetEntityId && (
                <Autocomplete
                    size='small'
                    disabled={disabled}
                    disableClearable
                    options={availableConstants}
                    value={selectedConstant}
                    onChange={handleConstantChange}
                    getOptionLabel={(constant) => getConstantDisplayName(constant)}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    popupIcon={<UnfoldMoreRoundedIcon fontSize='small' />}
                    PopperComponent={StyledPopper}
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
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            size='small'
                            label={t('ref.targetConstant', 'Target Constant')}
                            placeholder={t('ref.selectConstant', 'Select constant...')}
                            error={Boolean(targetConstantError && !targetConstantId)}
                            helperText={
                                !targetConstantId && targetConstantError
                                    ? targetConstantError
                                    : t('ref.targetConstantHint', 'Select constant from the selected set')
                            }
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {isLoadingConstants ? <CircularProgress color='inherit' size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                )
                            }}
                        />
                    )}
                    renderOption={(props, constant) => (
                        <Box component='li' {...props} key={constant.id}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography variant='body2'>{getConstantDisplayName(constant)}</Typography>
                                <Chip label={constant.codename} size='small' variant='outlined' sx={{ fontSize: 11 }} />
                            </Stack>
                        </Box>
                    )}
                    noOptionsText={t('ref.noConstantsAvailable', 'No fixedValues available')}
                    loading={isLoadingConstants}
                    loadingText={t('common.loading', 'Loading...')}
                />
            )}

            {/* Placeholder for unsupported entity kinds */}
            {targetEntityKind && !isKindSupported && (
                <Typography variant='body2' color='text.secondary' sx={{ fontStyle: 'italic' }}>
                    {t('ref.entityKindNotSupported', 'This entity type is not yet supported for references.')}
                </Typography>
            )}
        </Stack>
    )
}

export default TargetEntitySelector
