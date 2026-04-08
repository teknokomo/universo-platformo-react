import { Fragment, useMemo } from 'react'
import { Alert, Box, CircularProgress, Divider, FormControlLabel, FormHelperText, Stack, Switch, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { resolveSharedBehavior, type SharedBehavior, type SharedEntityKind } from '@universo/types'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import { useTranslation } from 'react-i18next'
import { getVLCString } from '../../../types'
import * as catalogsApi from '../../catalogs/api/catalogs'
import * as setsApi from '../../sets/api/sets'
import * as enumerationsApi from '../../enumerations/api/enumerations'
import { fetchAllPaginatedItems } from '../fetchAllPaginatedItems'
import { useSharedEntityOverridesByEntity } from '../hooks/useSharedEntityOverrides'
import { metahubsQueryKeys } from '../queryKeys'
import {
    normalizeSharedExcludedTargetIds,
    readSharedExcludedTargetIdsField,
    SHARED_EXCLUDED_TARGET_IDS_FIELD
} from '../sharedEntityExclusions'

type SharedSettingsStorageField = 'uiConfig' | 'presentation'

type SharedTargetOption = {
    id: string
    label: string
    secondaryLabel: string
}

type SharedTargetHubLike = {
    codename?: unknown
}

export type SharedEntitySettingsFieldsProps = {
    metahubId?: string
    entityKind: SharedEntityKind
    sharedEntityId?: string | null
    storageField: SharedSettingsStorageField
    section?: 'all' | 'behavior' | 'exclusions'
    values: Record<string, unknown>
    setValue: (name: string, value: unknown) => void
    isLoading?: boolean
}

const readRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

const isDefaultSharedBehavior = (value: Required<SharedBehavior>): boolean =>
    value.canDeactivate === true && value.canExclude === true && value.positionLocked === false

export const getSharedBehaviorFromContainer = (value: unknown): Required<SharedBehavior> => {
    const record = readRecord(value)
    const raw = record.sharedBehavior
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return resolveSharedBehavior(undefined)
    }

    return resolveSharedBehavior(raw as Partial<SharedBehavior>)
}

export const setSharedBehaviorInContainer = (
    value: unknown,
    sharedBehavior: Required<SharedBehavior>
): Record<string, unknown> | undefined => {
    const next = { ...readRecord(value) }

    if (isDefaultSharedBehavior(sharedBehavior)) {
        delete next.sharedBehavior
    } else {
        next.sharedBehavior = sharedBehavior
    }

    return Object.keys(next).length > 0 ? next : undefined
}

export const buildSharedBehaviorContainer = (value: unknown): Record<string, unknown> | undefined =>
    setSharedBehaviorInContainer(undefined, getSharedBehaviorFromContainer(value))

const getTargetLabels = (entityKind: SharedEntityKind) => {
    switch (entityKind) {
        case 'attribute':
            return {
                singular: 'catalog',
                plural: 'catalogs'
            }
        case 'constant':
            return {
                singular: 'set',
                plural: 'sets'
            }
        default:
            return {
                singular: 'enumeration',
                plural: 'enumerations'
            }
    }
}

const buildSecondaryLabel = (codename: string, extra?: string | null) => {
    if (!extra) return codename
    return `${codename} • ${extra}`
}

type SharedBehaviorOption = {
    key: keyof Required<SharedBehavior>
    label: string
    helper: string
}

export const resolveSharedTargetText = (value: unknown, locale: string): string => getVLCString(value as never, locale)

export const resolveSharedTargetLabel = (name: unknown, codename: unknown, locale: string, fallbackId: string): string =>
    resolveSharedTargetText(name, locale) || resolveSharedTargetText(codename, locale) || fallbackId

export const resolveSharedTargetSecondaryLabel = (
    codename: unknown,
    hubs: SharedTargetHubLike[] | undefined,
    locale: string,
    fallbackId: string
): string => {
    const codenameText = resolveSharedTargetText(codename, locale) || fallbackId
    const hubLabels =
        hubs
            ?.map((hub) => resolveSharedTargetText(hub?.codename, locale))
            .filter((value) => typeof value === 'string' && value.length > 0)
            .join(', ') ?? null

    return buildSecondaryLabel(codenameText, hubLabels)
}

const mapSharedTargets = async (metahubId: string, entityKind: SharedEntityKind, locale: string): Promise<SharedTargetOption[]> => {
    if (entityKind === 'attribute') {
        const response = await fetchAllPaginatedItems((params) => catalogsApi.listAllCatalogs(metahubId, params), {
            limit: 1000,
            sortBy: 'sortOrder',
            sortOrder: 'asc'
        })
        return response.items
            .map((catalog) => ({
                id: catalog.id,
                label: resolveSharedTargetLabel(catalog.name, catalog.codename, locale, catalog.id),
                secondaryLabel: resolveSharedTargetSecondaryLabel(catalog.codename, catalog.hubs, locale, catalog.id)
            }))
            .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
    }

    if (entityKind === 'constant') {
        const response = await fetchAllPaginatedItems((params) => setsApi.listAllSets(metahubId, params), {
            limit: 1000,
            sortBy: 'sortOrder',
            sortOrder: 'asc'
        })
        return response.items
            .map((setItem) => ({
                id: setItem.id,
                label: resolveSharedTargetLabel(setItem.name, setItem.codename, locale, setItem.id),
                secondaryLabel: resolveSharedTargetSecondaryLabel(setItem.codename, setItem.hubs, locale, setItem.id)
            }))
            .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
    }

    const response = await fetchAllPaginatedItems((params) => enumerationsApi.listAllEnumerations(metahubId, params), {
        limit: 1000,
        sortBy: 'sortOrder',
        sortOrder: 'asc'
    })

    return response.items
        .map((enumeration) => ({
            id: enumeration.id,
            label: resolveSharedTargetLabel(enumeration.name, enumeration.codename, locale, enumeration.id),
            secondaryLabel: resolveSharedTargetSecondaryLabel(enumeration.codename, enumeration.hubs, locale, enumeration.id)
        }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
}

export const SharedEntitySettingsFields = ({
    metahubId,
    entityKind,
    sharedEntityId,
    storageField,
    section = 'all',
    values,
    setValue,
    isLoading = false
}: SharedEntitySettingsFieldsProps) => {
    const { t, i18n } = useTranslation('metahubs')
    const sharedBehavior = useMemo(() => getSharedBehaviorFromContainer(values[storageField]), [storageField, values])
    const targetLabels = getTargetLabels(entityKind)

    const targetsQuery = useQuery({
        queryKey: metahubId
            ? metahubsQueryKeys.sharedEntityTargets(metahubId, entityKind, i18n.language)
            : ['metahubs', 'sharedEntityTargets', 'empty'],
        queryFn: () => mapSharedTargets(metahubId!, entityKind, i18n.language),
        enabled: Boolean(metahubId)
    })

    const overridesQuery = useSharedEntityOverridesByEntity(metahubId, entityKind, sharedEntityId)

    const serverExcludedTargetIds = useMemo(() => {
        const next: string[] = []
        for (const item of overridesQuery.data ?? []) {
            if (item.isExcluded) {
                next.push(item.targetObjectId)
            }
        }
        return next
    }, [overridesQuery.data])

    const explicitExcludedTargetIds = readSharedExcludedTargetIdsField(values)
    const excludedTargetIds = explicitExcludedTargetIds ?? serverExcludedTargetIds
    const serverExcludedTargetIdSet = useMemo(() => new Set(serverExcludedTargetIds), [serverExcludedTargetIds])
    const showBehaviorSection = section === 'all' || section === 'behavior'
    const showExclusionsSection = section === 'all' || section === 'exclusions'

    const handleBehaviorChange = (patch: Partial<Required<SharedBehavior>>) => {
        const nextBehavior = {
            ...sharedBehavior,
            ...patch
        }
        setValue(storageField, setSharedBehaviorInContainer(values[storageField], nextBehavior))

        if (patch.canExclude === false && sharedEntityId) {
            setValue(
                SHARED_EXCLUDED_TARGET_IDS_FIELD,
                excludedTargetIds.filter((targetObjectId) => serverExcludedTargetIdSet.has(targetObjectId))
            )
        }
    }

    const handleExcludedTargetIdsChange = (nextExcludedTargetIds: string[]) =>
        setValue(SHARED_EXCLUDED_TARGET_IDS_FIELD, normalizeSharedExcludedTargetIds(nextExcludedTargetIds))

    const exclusionPanelLabels: EntitySelectionLabels = {
        title: t('shared.exclusions.title', 'Exclusions'),
        addButton: t('shared.exclusions.addButton', 'Add'),
        dialogTitle: t('shared.exclusions.dialogTitle', 'Select exclusions'),
        emptyMessage: t('shared.exclusions.emptySelection', 'No exclusions configured.'),
        noAvailableMessage: t('shared.exclusions.noAvailableSelection', 'No additional targets are available.'),
        searchPlaceholder: t('shared.exclusions.searchPlaceholder', 'Search targets...'),
        cancelButton: t('shared.exclusions.cancelButton', 'Cancel'),
        confirmButton: t('shared.exclusions.confirmButton', 'Add'),
        removeTitle: t('shared.exclusions.removeTitle', 'Remove from exclusions'),
        nameHeader: t('shared.exclusions.nameHeader', 'Name'),
        codenameHeader: t('shared.exclusions.contextHeader', 'Context')
    }

    const behaviorOptions: SharedBehaviorOption[] = [
        {
            key: 'canDeactivate',
            label: t('shared.behavior.canDeactivate', 'Can be deactivated'),
            helper: t(
                'shared.behavior.canDeactivateHelper',
                'Allow target objects to switch this shared entity off without removing it completely.'
            )
        },
        {
            key: 'canExclude',
            label: t('shared.behavior.canExclude', 'Can be excluded'),
            helper: t('shared.behavior.canExcludeHelper', 'Allow target objects to exclude this shared entity from their own list.')
        },
        {
            key: 'positionLocked',
            label: t('shared.behavior.positionLocked', 'Position locked'),
            helper: t(
                'shared.behavior.positionLockedHelper',
                'Keep this shared entity fixed in inherited order so target objects cannot reorder it.'
            )
        }
    ]

    return (
        <Stack spacing={2} sx={{ pt: 0.5 }}>
            {showBehaviorSection ? (
                <Stack spacing={1.5}>
                    {section === 'all' ? (
                        <Typography variant='subtitle2'>{t('shared.behavior.title', 'Shared behavior')}</Typography>
                    ) : null}
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'shared.behavior.description',
                            'Control how this shared entity behaves inside target objects and which overrides remain available there.'
                        )}
                    </Typography>
                    <Stack divider={<Divider flexItem />}>
                        {behaviorOptions.map((option) => (
                            <Fragment key={option.key}>
                                <Box sx={{ py: 0.5 }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={sharedBehavior[option.key]}
                                                onChange={(_, checked) => handleBehaviorChange({ [option.key]: checked })}
                                                disabled={isLoading}
                                            />
                                        }
                                        label={option.label}
                                    />
                                    <FormHelperText sx={{ mt: -0.5, ml: 7 }}>{option.helper}</FormHelperText>
                                </Box>
                            </Fragment>
                        ))}
                    </Stack>
                </Stack>
            ) : null}

            {showExclusionsSection ? (
                <Box>
                    <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
                        {t(
                            'shared.exclusions.description',
                            'Disable inheritance for selected target objects while keeping this shared entity available everywhere else.'
                        )}
                    </Typography>
                    {!sharedEntityId ? (
                        <Alert severity='info'>
                            {t(
                                'shared.exclusions.availableAfterCreate',
                                `Save this shared entity first to configure exclusions for individual ${targetLabels.plural}.`
                            )}
                        </Alert>
                    ) : null}

                    {sharedEntityId && !sharedBehavior.canExclude ? (
                        <Alert severity='info' sx={{ mb: 1 }}>
                            {t('shared.exclusions.disabled', 'Exclusions are currently locked for this shared entity.')}
                        </Alert>
                    ) : null}

                    {sharedEntityId && explicitExcludedTargetIds !== undefined ? (
                        <Alert severity='info' sx={{ mb: 1 }}>
                            {t('shared.exclusions.saveWithDialog', 'Exclusion changes are applied when you save this dialog.')}
                        </Alert>
                    ) : null}

                    {sharedEntityId && targetsQuery.isLoading ? (
                        <Stack direction='row' spacing={1} alignItems='center'>
                            <CircularProgress size={16} />
                            <Typography variant='body2' color='text.secondary'>
                                {t('shared.exclusions.loading', 'Loading available targets...')}
                            </Typography>
                        </Stack>
                    ) : null}

                    {sharedEntityId && targetsQuery.error ? (
                        <Alert severity='error'>
                            {t('shared.exclusions.loadError', 'Failed to load available targets for exclusions.')}
                        </Alert>
                    ) : null}

                    {sharedEntityId && !targetsQuery.isLoading && !targetsQuery.error && (targetsQuery.data?.length ?? 0) === 0 ? (
                        <Alert severity='info'>{t('shared.exclusions.empty', `No ${targetLabels.plural} are available yet.`)}</Alert>
                    ) : null}

                    {sharedEntityId && !targetsQuery.isLoading && !targetsQuery.error && (targetsQuery.data?.length ?? 0) > 0 ? (
                        <EntitySelectionPanel<SharedTargetOption>
                            availableEntities={targetsQuery.data ?? []}
                            selectedIds={excludedTargetIds}
                            onSelectionChange={handleExcludedTargetIdsChange}
                            getDisplayName={(target) => target.label}
                            getCodename={(target) => target.secondaryLabel}
                            labels={exclusionPanelLabels}
                            disabled={isLoading || !sharedBehavior.canExclude}
                        />
                    ) : null}
                </Box>
            ) : null}
        </Stack>
    )
}

export default SharedEntitySettingsFields
