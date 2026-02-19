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
import type { MetaEntityKind } from '@universo/types'
import { getVLCString } from '../types'
import type { Catalog, Enumeration } from '../types'
import { listAllCatalogs } from '../domains/catalogs/api'
import { listAllEnumerations } from '../domains/enumerations/api'
import { metahubsQueryKeys } from '../domains/shared'

/** Supported entity kinds for REF field targets */
const SUPPORTED_ENTITY_KINDS: MetaEntityKind[] = ['catalog', 'enumeration']

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
    targetEntityKind: MetaEntityKind | null | undefined
    /** Currently selected target entity ID */
    targetEntityId: string | null | undefined
    /** Callback when target entity kind changes */
    onEntityKindChange: (kind: MetaEntityKind | null) => void
    /** Callback when target entity ID changes */
    onEntityIdChange: (id: string | null) => void
    /** ID of current catalog to exclude from selection (prevent self-reference) */
    excludeCatalogId?: string
    /** Whether the selector is disabled */
    disabled?: boolean
    /** Error message to display */
    error?: string | null
    /** Current UI locale for entity name display */
    uiLocale?: string
}

/**
 * Component for selecting target entity for REF (reference) field type.
 * Allows selecting entity kind and then the specific entity.
 *
 * Loads available entities (catalogs/enumerations) automatically from the API.
 */
export const TargetEntitySelector = ({
    metahubId,
    targetEntityKind,
    targetEntityId,
    onEntityKindChange,
    onEntityIdChange,
    excludeCatalogId,
    disabled = false,
    error,
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

    // Load all catalogs for the metahub
    const { data: catalogsData, isLoading: isLoadingCatalogs } = useQuery({
        queryKey: metahubsQueryKeys.allCatalogsList(metahubId, listParams),
        queryFn: () => listAllCatalogs(metahubId, listParams),
        enabled: !!metahubId && targetEntityKind === 'catalog',
        staleTime: 30000 // 30 seconds
    })
    // Load all enumerations for the metahub
    const { data: enumerationsData, isLoading: isLoadingEnumerations } = useQuery({
        queryKey: metahubsQueryKeys.allEnumerationsList(metahubId, listParams),
        queryFn: () => listAllEnumerations(metahubId, listParams),
        enabled: !!metahubId && targetEntityKind === 'enumeration',
        staleTime: 30000 // 30 seconds
    })

    const availableCatalogs = useMemo(() => catalogsData?.items ?? [], [catalogsData?.items])
    const availableEnumerations = useMemo(() => enumerationsData?.items ?? [], [enumerationsData?.items])

    // Entity kind options with localized labels
    const entityKindOptions = useMemo(
        () => [
            { value: 'catalog' as MetaEntityKind, label: t('ref.entityKind.catalog', 'Catalog') },
            { value: 'enumeration' as MetaEntityKind, label: t('ref.entityKind.enumeration', 'Enumeration') }
            // Future: add 'document', 'hub' when supported
            // { value: 'document' as MetaEntityKind, label: t('ref.entityKind.document', 'Document') },
            // { value: 'hub' as MetaEntityKind, label: t('ref.entityKind.hub', 'Hub') },
        ],
        [t]
    )

    // Get display name for catalog
    const getCatalogDisplayName = useCallback(
        (catalog: Catalog): string => {
            return getVLCString(catalog.name, uiLocale) || getVLCString(catalog.name, 'en') || catalog.codename
        },
        [uiLocale]
    )
    // Get display name for enumeration
    const getEnumerationDisplayName = useCallback(
        (enumeration: Enumeration): string => {
            return getVLCString(enumeration.name, uiLocale) || getVLCString(enumeration.name, 'en') || enumeration.codename
        },
        [uiLocale]
    )

    // Find selected catalog
    const selectedCatalog = useMemo(() => {
        if (!targetEntityId || targetEntityKind !== 'catalog') return null
        return availableCatalogs.find((c) => c.id === targetEntityId) || null
    }, [targetEntityId, targetEntityKind, availableCatalogs])
    // Find selected enumeration
    const selectedEnumeration = useMemo(() => {
        if (!targetEntityId || targetEntityKind !== 'enumeration') return null
        return availableEnumerations.find((enumeration) => enumeration.id === targetEntityId) || null
    }, [targetEntityId, targetEntityKind, availableEnumerations])

    // Handle entity kind change
    const handleKindChange = useCallback(
        (newKind: MetaEntityKind | null) => {
            onEntityKindChange(newKind)
            // Clear entity ID when kind changes
            if (newKind !== targetEntityKind) {
                onEntityIdChange(null)
            }
        },
        [onEntityKindChange, onEntityIdChange, targetEntityKind]
    )

    // Handle catalog selection
    const handleCatalogChange = useCallback(
        (_event: unknown, newValue: Catalog | null) => {
            onEntityIdChange(newValue?.id || null)
        },
        [onEntityIdChange]
    )

    const handleEnumerationChange = useCallback(
        (_event: unknown, newValue: Enumeration | null) => {
            onEntityIdChange(newValue?.id || null)
        },
        [onEntityIdChange]
    )

    // Filter out the current catalog to prevent self-reference
    const selectableCatalogs = useMemo(() => {
        if (!excludeCatalogId) return availableCatalogs
        return availableCatalogs.filter((c) => c.id !== excludeCatalogId)
    }, [availableCatalogs, excludeCatalogId])

    const isKindSupported = targetEntityKind && SUPPORTED_ENTITY_KINDS.includes(targetEntityKind)

    return (
        <Stack spacing={2}>
            {/* Entity Kind Selector */}
            <FormControl fullWidth size='small' disabled={disabled} error={Boolean(error)}>
                <InputLabel id='target-entity-kind-label'>{t('ref.targetEntityKind', 'Target Entity Type')}</InputLabel>
                <Select
                    labelId='target-entity-kind-label'
                    label={t('ref.targetEntityKind', 'Target Entity Type')}
                    value={targetEntityKind || ''}
                    onChange={(e) => handleKindChange((e.target.value as MetaEntityKind) || null)}
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

            {/* Entity Selector - render based on kind */}
            {targetEntityKind === 'catalog' && (
                <Autocomplete
                    size='small'
                    disabled={disabled}
                    disableClearable
                    options={selectableCatalogs}
                    value={selectedCatalog}
                    onChange={handleCatalogChange}
                    getOptionLabel={(catalog) => getCatalogDisplayName(catalog)}
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
                            label={t('ref.targetCatalog', 'Target Catalog')}
                            placeholder={t('ref.selectCatalog', 'Select catalog...')}
                            error={Boolean(error && !targetEntityId)}
                            helperText={!targetEntityId && error ? t('ref.catalogRequired', 'Please select a catalog') : undefined}
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {isLoadingCatalogs ? <CircularProgress color='inherit' size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                )
                            }}
                        />
                    )}
                    renderOption={(props, catalog) => (
                        <Box component='li' {...props} key={catalog.id}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography variant='body2'>{getCatalogDisplayName(catalog)}</Typography>
                                <Chip label={catalog.codename} size='small' variant='outlined' sx={{ fontSize: 11 }} />
                            </Stack>
                        </Box>
                    )}
                    noOptionsText={t('ref.noCatalogsAvailable', 'No catalogs available')}
                    loading={isLoadingCatalogs}
                    loadingText={t('common.loading', 'Loading...')}
                />
            )}

            {targetEntityKind === 'enumeration' && (
                <Autocomplete
                    size='small'
                    disabled={disabled}
                    disableClearable
                    options={availableEnumerations}
                    value={selectedEnumeration}
                    onChange={handleEnumerationChange}
                    getOptionLabel={(enumeration) => getEnumerationDisplayName(enumeration)}
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
                            label={t('ref.targetEnumeration', 'Target Enumeration')}
                            placeholder={t('ref.selectEnumeration', 'Select enumeration...')}
                            error={Boolean(error && !targetEntityId)}
                            helperText={!targetEntityId && error ? t('ref.enumerationRequired', 'Please select an enumeration') : undefined}
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {isLoadingEnumerations ? <CircularProgress color='inherit' size={16} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                )
                            }}
                        />
                    )}
                    renderOption={(props, enumeration) => (
                        <Box component='li' {...props} key={enumeration.id}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography variant='body2'>{getEnumerationDisplayName(enumeration)}</Typography>
                                <Chip label={enumeration.codename} size='small' variant='outlined' sx={{ fontSize: 11 }} />
                            </Stack>
                        </Box>
                    )}
                    noOptionsText={t('ref.noEnumerationsAvailable', 'No enumerations available')}
                    loading={isLoadingEnumerations}
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
