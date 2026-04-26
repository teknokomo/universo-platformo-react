import { useMemo, useState } from 'react'
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
    isEnabledComponentConfig,
    resolveEntityResourceSurfaceTitle,
    type ComponentManifest,
    type EntityResourceSurfaceDefinition,
    type EntityResourceSurfaceCapability,
    SHARED_OBJECT_KINDS
} from '@universo/types'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { FieldDefinitionListContent } from '../../metadata/fieldDefinition/ui/FieldDefinitionList'
import { FixedValueListContent } from '../../metadata/fixedValue/ui/FixedValueList'
import { SelectableOptionListContent } from '../../metadata/optionValue/ui/SelectableOptionList'
import { LayoutListContent } from '../../../layouts/ui/LayoutList'
import { EntityScriptsTab } from '../../../scripts/ui/EntityScriptsTab'
import { useSharedContainerIds } from '../../../shared/hooks/useSharedContainerIds'
import { useAllEntityTypesQuery } from '../../hooks/queries'

type SharedResourcesTab = 'layouts' | 'fieldDefinitions' | 'fixedValues' | 'optionValues' | 'scripts'

interface TabConfig {
    value: SharedResourcesTab
    label: string
    visible: boolean
}

function hasAnyEnabledComponent(manifests: ComponentManifest[], component: keyof ComponentManifest): boolean {
    return manifests.some((m) => isEnabledComponentConfig(m[component]))
}

type EntityTypeSummary = {
    components: ComponentManifest
    ui?: {
        resourceSurfaces?: readonly EntityResourceSurfaceDefinition[]
    }
}

interface ResourceSurfaceRegistryEntry {
    tab: Extract<SharedResourcesTab, 'fieldDefinitions' | 'fixedValues' | 'optionValues'>
    capability: EntityResourceSurfaceCapability
    platformLabelKey: string
    platformLabelFallback: string
    poolKind: keyof typeof SHARED_OBJECT_KINDS
}

const RESOURCE_SURFACE_REGISTRY: readonly ResourceSurfaceRegistryEntry[] = [
    {
        tab: 'fieldDefinitions',
        capability: 'dataSchema',
        platformLabelKey: 'fieldDefinitions.resourceTabTitle',
        platformLabelFallback: 'fieldDefinitions',
        poolKind: 'SHARED_CATALOG_POOL'
    },
    {
        tab: 'fixedValues',
        capability: 'fixedValues',
        platformLabelKey: 'fixedValues.resourceTabTitle',
        platformLabelFallback: 'fixedValues',
        poolKind: 'SHARED_SET_POOL'
    },
    {
        tab: 'optionValues',
        capability: 'optionValues',
        platformLabelKey: 'optionValues.resourceTabTitle',
        platformLabelFallback: 'optionValues',
        poolKind: 'SHARED_ENUM_POOL'
    }
] as const

const normalizeResourceSurfaceLabelToken = (value: string): string => value.trim().toLowerCase()

function collectResourceSurfaceLabels({
    entityTypes,
    capability,
    locale,
    translate
}: {
    entityTypes: (EntityTypeSummary & { kindKey?: string })[]
    capability: EntityResourceSurfaceCapability
    locale: string
    translate: (key: string, fallback?: string) => string
}): string[] {
    return entityTypes
        .map((entityType) => entityType.ui?.resourceSurfaces?.find((item) => item.capability === capability))
        .filter((surface): surface is EntityResourceSurfaceDefinition => Boolean(surface))
        .map((surface) => resolveEntityResourceSurfaceTitle(surface, { locale, translate }))
}

function resolveResourceSurfaceLabel({
    entityTypes,
    capability,
    platformLabel,
    locale,
    translate
}: {
    entityTypes: (EntityTypeSummary & { kindKey?: string })[]
    capability: EntityResourceSurfaceCapability
    platformLabel: string
    locale: string
    translate: (key: string, fallback?: string) => string
}): string {
    const compatibleSurfaces = entityTypes
        .map((entityType) => ({
            entityType,
            surface: entityType.ui?.resourceSurfaces?.find((item) => item.capability === capability)
        }))
        .filter(
            (
                entry
            ): entry is {
                entityType: EntityTypeSummary & { kindKey?: string }
                surface: EntityResourceSurfaceDefinition
            } => Boolean(entry.surface)
        )
        .sort((left, right) => {
            const leftKey = left.entityType.kindKey ?? ''
            const rightKey = right.entityType.kindKey ?? ''
            return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
        })

    if (compatibleSurfaces.length === 0) {
        return platformLabel
    }

    const distinctSurfaceLabels = new Set(
        compatibleSurfaces.map(({ surface }) =>
            normalizeResourceSurfaceLabelToken(resolveEntityResourceSurfaceTitle(surface, { locale, translate }))
        )
    )

    if (distinctSurfaceLabels.size > 1) {
        return platformLabel
    }

    const resolvedSurface = compatibleSurfaces[0]?.surface
    return resolvedSurface ? resolveEntityResourceSurfaceTitle(resolvedSurface, { locale, translate }) : platformLabel
}

export default function SharedResourcesPage() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation('metahubs')
    const [activeTab, setActiveTab] = useState<SharedResourcesTab>('layouts')
    const sharedContainerIdsQuery = useSharedContainerIds(metahubId)

    const entityTypesQuery = useAllEntityTypesQuery(metahubId)
    const translateSurfaceTitle = useMemo(() => (key: string, fallback?: string) => t(key, fallback ?? key), [t])

    const tabs = useMemo<TabConfig[]>(() => {
        const entityTypes = (entityTypesQuery.data?.items ?? []) as EntityTypeSummary[]
        const manifests = entityTypes.map((et) => et.components)
        const resourceTabs = RESOURCE_SURFACE_REGISTRY.map((entry): TabConfig => {
            const platformLabel = t(entry.platformLabelKey, entry.platformLabelFallback)

            return {
                value: entry.tab,
                label: resolveResourceSurfaceLabel({
                    entityTypes,
                    capability: entry.capability,
                    platformLabel,
                    locale: i18n.language,
                    translate: translateSurfaceTitle
                }),
                visible: hasAnyEnabledComponent(manifests, entry.capability)
            }
        })

        return [
            { value: 'layouts', label: t('general.tabs.layouts', 'Layouts'), visible: true },
            ...resourceTabs,
            { value: 'scripts', label: t('general.tabs.scripts', 'Scripts'), visible: true }
        ]
    }, [entityTypesQuery.data?.items, i18n.language, t, translateSurfaceTitle])

    const resourceSurfaceConflictLabels = useMemo(() => {
        const entityTypes = (entityTypesQuery.data?.items ?? []) as EntityTypeSummary[]

        return RESOURCE_SURFACE_REGISTRY.filter((entry) => {
            const distinctLabels = new Set(
                collectResourceSurfaceLabels({
                    entityTypes,
                    capability: entry.capability,
                    locale: i18n.language,
                    translate: translateSurfaceTitle
                }).map(normalizeResourceSurfaceLabelToken)
            )

            return distinctLabels.size > 1
        }).map((entry) => t(entry.platformLabelKey, entry.platformLabelFallback))
    }, [entityTypesQuery.data?.items, i18n.language, t, translateSurfaceTitle])

    const visibleTabs = tabs.filter((tab) => tab.visible)
    const effectiveTab = visibleTabs.some((tab) => tab.value === activeTab) ? activeTab : visibleTabs[0]?.value ?? 'layouts'

    const renderSharedTabPlaceholder = (message: string) => (
        <Box sx={{ py: 2 }}>
            <Typography variant='body2' color='text.secondary'>
                {message}
            </Typography>
        </Box>
    )

    const renderSharedContent = (kind: keyof typeof SHARED_OBJECT_KINDS) => {
        if (sharedContainerIdsQuery.isLoading) {
            return renderSharedTabPlaceholder(t('general.shared.loading', 'Loading shared entities...'))
        }

        if (sharedContainerIdsQuery.error) {
            return renderSharedTabPlaceholder(t('general.shared.loadError', 'Failed to load shared containers.'))
        }

        const objectId = sharedContainerIdsQuery.data?.[SHARED_OBJECT_KINDS[kind]]
        if (!objectId) {
            return renderSharedTabPlaceholder(t('general.shared.empty', 'Shared container is unavailable.'))
        }

        if (kind === 'SHARED_CATALOG_POOL') {
            return (
                <FieldDefinitionListContent
                    metahubId={metahubId}
                    linkedCollectionId={objectId}
                    title={null}
                    sharedEntityMode
                    renderPageShell={false}
                    showCatalogTabs={false}
                    showSettingsTab={false}
                    allowSystemTab={false}
                />
            )
        }

        if (kind === 'SHARED_SET_POOL') {
            return (
                <FixedValueListContent
                    metahubId={metahubId}
                    valueGroupId={objectId}
                    title={null}
                    sharedEntityMode
                    renderPageShell={false}
                    showSettingsTab={false}
                />
            )
        }

        return (
            <SelectableOptionListContent
                metahubId={metahubId}
                optionListId={objectId}
                title={null}
                sharedEntityMode
                renderPageShell={false}
                showSettingsTab={false}
            />
        )
    }

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('general.title', 'Resources')} />

            <Box data-testid='metahub-shared-resources-tabs' sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={effectiveTab}
                    onChange={(_, nextValue: SharedResourcesTab) => setActiveTab(nextValue)}
                    variant='scrollable'
                    scrollButtons='auto'
                >
                    {visibleTabs.map((tab) => (
                        <Tab key={tab.value} value={tab.value} label={tab.label} />
                    ))}
                </Tabs>
            </Box>

            <Box data-testid='metahub-shared-resources-content' sx={{ py: 2 }}>
                {resourceSurfaceConflictLabels.length > 0 ? (
                    <Alert severity='warning' sx={{ mb: 2 }}>
                        {t('resources.resourceSurfaceLabelConflict', {
                            defaultValue:
                                'Some entity types define different names for the same shared resource tab. Using platform labels for: {{labels}}.',
                            labels: resourceSurfaceConflictLabels.join(', ')
                        })}
                    </Alert>
                ) : null}
                {effectiveTab === 'layouts' ? (
                    <LayoutListContent
                        metahubId={metahubId}
                        detailBasePath={metahubId ? `/metahub/${metahubId}/resources/layouts` : ''}
                        title={null}
                        embedded
                        compactHeader={false}
                        renderPageShell={false}
                    />
                ) : null}
                {RESOURCE_SURFACE_REGISTRY.map((entry) =>
                    effectiveTab === entry.tab ? <Box key={entry.tab}>{renderSharedContent(entry.poolKind)}</Box> : null
                )}
                {effectiveTab === 'scripts' ? (
                    <EntityScriptsTab metahubId={metahubId} attachedToKind='general' attachedToId={null} t={t} />
                ) : null}
            </Box>
        </MainCard>
    )
}
