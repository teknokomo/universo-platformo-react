import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore'
import { Box, Button, IconButton, Menu, MenuItem, Paper, Stack, Switch, Tooltip, Typography } from '@mui/material'
import {
    decodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    type ApplicationLayoutZone,
    type DashboardLayoutZone
} from '@universo-react/types'
import type { TFunction } from 'i18next'

import type { DashboardLayoutWidgetItem, MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'
import type { DashboardNestedPlacementRow } from './useLayoutAuthoringZones'

type RegistryDefinition = NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
type ContainerDefinition = NonNullable<NonNullable<RegistryDefinition['composition']>['container']>
type ContainerSlotPolicy = ContainerDefinition['slots'][number]

interface NestedSlot {
    key: string
    label: string
    policy: ContainerSlotPolicy
}

interface AddMenuState {
    anchor: HTMLElement
    parent: MetahubLayoutZoneWidget
    slot: NestedSlot
    candidates: DashboardLayoutWidgetItem[]
}

interface MoveMenuState {
    anchor: HTMLElement
    placement: MetahubLayoutZoneWidget
    destinations: Array<{ parent: MetahubLayoutZoneWidget; slot: NestedSlot }>
}

interface DashboardNestedPlacementsProps {
    layout: MetahubLayout
    placements: MetahubLayoutZoneWidget[]
    nestedPlacements: DashboardNestedPlacementRow[]
    zoneLabels: Record<DashboardLayoutZone, string>
    canManageLayouts: boolean
    locale: string
    tc: TFunction
    widgetLabelByKey: Record<string, string>
    getWidgetChipLabel: (placement: MetahubLayoutZoneWidget) => string
    getAvailableWidgetsForZone: (zone: ApplicationLayoutZone) => DashboardLayoutWidgetItem[]
    onAddWidget: (
        zone: ApplicationLayoutZone,
        widgetKey: DashboardLayoutWidgetItem['key'],
        target: { parentInstanceKey: string; slotKey: string }
    ) => void
    onMove: (
        placement: MetahubLayoutZoneWidget,
        target: { targetIndex: number; targetParentInstanceKey?: string; targetSlotKey?: string }
    ) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const getRendererConfig = (layout: MetahubLayout, placement: MetahubLayoutZoneWidget): Record<string, unknown> => {
    const config = isRecord(placement.config) ? placement.config : {}
    return decodeWidgetConfigEnvelope(config, {
        templateKey: layout.templateKey,
        widgetKey: placement.widgetKey,
        zone: placement.zone,
        rendererConfig: config
    }).rendererConfig
}

const resolveSlotLabel = (
    kind: ContainerDefinition['kind'],
    descriptor: Record<string, unknown>,
    index: number,
    locale: string,
    tc: TFunction
) => {
    if (kind === 'tabs') {
        const configuredLabel = descriptor.label
        if (typeof configuredLabel === 'string' && configuredLabel.trim()) return configuredLabel
        if (isRecord(configuredLabel)) {
            const language = locale.toLowerCase()
            const baseLanguage = language.split('-')[0]
            const localizedLabel = [language, baseLanguage, 'en', ...Object.keys(configuredLabel)]
                .map((key) => configuredLabel[key])
                .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
            if (localizedLabel) return localizedLabel
        }
    }
    return tc(kind === 'columns' ? 'nesting.column' : 'nesting.tab', { number: index + 1 })
}

const getConfiguredSlots = (
    layout: MetahubLayout,
    placement: MetahubLayoutZoneWidget,
    locale: string,
    tc: TFunction
): { definition: RegistryDefinition; slots: NestedSlot[] } | null => {
    try {
        const rendererConfig = getRendererConfig(layout, placement)
        const definition = getLayoutWidgetDefinition(placement.widgetKey, rendererConfig)
        const container = definition?.composition?.container
        if (!definition || !container?.childrenAreFirstClassPlacements) return null
        const field = container.kind === 'columns' ? 'columns' : 'tabs'
        const rawSlots = rendererConfig[field]
        if (!Array.isArray(rawSlots)) return null

        const slots = rawSlots.flatMap((rawSlot, index): NestedSlot[] => {
            if (!isRecord(rawSlot) || typeof rawSlot.slotKey !== 'string') return []
            const policy = container.slots.find((candidate) => {
                if (!rawSlot.slotKey.startsWith(candidate.slotPrefix)) return false
                try {
                    return new RegExp(candidate.slotKeyPattern, 'u').test(rawSlot.slotKey.slice(candidate.slotPrefix.length))
                } catch {
                    return false
                }
            })
            if (!policy) return []
            return [{ key: rawSlot.slotKey, label: resolveSlotLabel(container.kind, rawSlot, index, locale, tc), policy }]
        })
        return { definition, slots }
    } catch {
        return null
    }
}

const ownsCompositionInCurrentLayout = (placement: MetahubLayoutZoneWidget, definition: RegistryDefinition): boolean =>
    !placement.isInherited || (definition.composition?.sourceOwned === true && definition.sourcePolicy.inheritComposition !== true)

const isCompatibleChild = (
    layout: MetahubLayout,
    zone: DashboardLayoutZone,
    slot: NestedSlot,
    widget: DashboardLayoutWidgetItem,
    placements: readonly MetahubLayoutZoneWidget[]
): boolean =>
    widget.supportedTemplates.includes(layout.templateKey) &&
    widget.allowedZonesByTemplate[layout.templateKey]?.includes(zone) === true &&
    widget.authoring.metahub.add !== 'none' &&
    widget.placementPolicy.parent === 'root-or-compatible-container-slot' &&
    widget.capabilities.some((capability) => slot.policy.allowedChildCapabilities.includes(capability)) &&
    (widget.multiInstance || !placements.some((placement) => placement.widgetKey === widget.key && placement.isActive))

const collectDescendantInstanceKeys = (placement: MetahubLayoutZoneWidget, placements: readonly MetahubLayoutZoneWidget[]): Set<string> => {
    const result = new Set<string>([placement.instanceKey])
    const queue = [placement.instanceKey]
    for (let index = 0; index < queue.length; index += 1) {
        const parentInstanceKey = queue[index]
        for (const child of placements) {
            if (child.parentInstanceKey !== parentInstanceKey || result.has(child.instanceKey)) continue
            result.add(child.instanceKey)
            queue.push(child.instanceKey)
        }
    }
    return result
}

export const countNestedPlacementDescendants = (placementId: string, placements: readonly MetahubLayoutZoneWidget[]): number => {
    const root = placements.find((placement) => placement.id === placementId)
    if (!root) return 0
    const visited = new Set<string>([root.instanceKey])
    const queue = [root.instanceKey]
    let count = 0
    for (let index = 0; index < queue.length; index += 1) {
        const parentInstanceKey = queue[index]
        for (const child of placements) {
            if (child.parentInstanceKey !== parentInstanceKey || visited.has(child.instanceKey)) continue
            visited.add(child.instanceKey)
            queue.push(child.instanceKey)
            count += 1
        }
    }
    return count
}

export default function DashboardNestedPlacements({
    layout,
    placements,
    nestedPlacements,
    zoneLabels,
    canManageLayouts,
    locale,
    tc,
    widgetLabelByKey,
    getWidgetChipLabel,
    getAvailableWidgetsForZone,
    onAddWidget,
    onMove
}: DashboardNestedPlacementsProps) {
    const [addMenu, setAddMenu] = useState<AddMenuState | null>(null)
    const [moveMenu, setMoveMenu] = useState<MoveMenuState | null>(null)
    const rowById = useMemo(() => new Map(nestedPlacements.map(({ placement, row }) => [placement.id, row])), [nestedPlacements])
    const childrenByParent = useMemo(() => {
        const children = new Map<string, MetahubLayoutZoneWidget[]>()
        for (const placement of placements) {
            if (!placement.parentInstanceKey || !placement.slotKey) continue
            const siblings = children.get(placement.parentInstanceKey) ?? []
            siblings.push(placement)
            children.set(placement.parentInstanceKey, siblings)
        }
        for (const siblings of children.values()) siblings.sort((left, right) => left.sortOrder - right.sortOrder)
        return children
    }, [placements])

    const getAddCandidates = (parent: MetahubLayoutZoneWidget, slot: NestedSlot) =>
        getAvailableWidgetsForZone(parent.zone).filter((widget) =>
            isCompatibleChild(layout, parent.zone as DashboardLayoutZone, slot, widget, placements)
        )

    const getMoveDestinations = (placement: MetahubLayoutZoneWidget) => {
        if (placement.isInherited) return []
        const excludedInstanceKeys = collectDescendantInstanceKeys(placement, placements)
        const definition = getLayoutWidgetDefinition(placement.widgetKey, getRendererConfig(layout, placement))
        if (!definition || definition.placementPolicy.parent !== 'root-or-compatible-container-slot') return []

        return placements.flatMap((parent) => {
            if (parent.zone !== placement.zone || excludedInstanceKeys.has(parent.instanceKey)) return []
            const configured = getConfiguredSlots(layout, parent, locale, tc)
            if (!configured || !ownsCompositionInCurrentLayout(parent, configured.definition)) return []
            return configured.slots
                .filter((slot) => parent.instanceKey !== placement.parentInstanceKey || slot.key !== placement.slotKey)
                .filter((slot) => definition.capabilities.some((capability) => slot.policy.allowedChildCapabilities.includes(capability)))
                .map((slot) => ({ parent, slot }))
        })
    }

    const renderPlacement = (placement: MetahubLayoutZoneWidget, path: ReadonlySet<string>): ReactNode => {
        const row = rowById.get(placement.id)
        if (!row || path.has(placement.instanceKey)) return null
        const nextPath = new Set(path).add(placement.instanceKey)
        const configured = getConfiguredSlots(layout, placement, locale, tc)
        const siblings = placement.parentInstanceKey
            ? (childrenByParent.get(placement.parentInstanceKey) ?? []).filter((item) => item.slotKey === placement.slotKey)
            : []
        const siblingIndex = siblings.findIndex((item) => item.id === placement.id)
        const placementDefinition = getLayoutWidgetDefinition(placement.widgetKey, getRendererConfig(layout, placement))
        const canReorder = placement.isInherited ? placementDefinition?.applicationPlacementOverrides.order === 'any' : true
        const destinations = getMoveDestinations(placement)
        const rowLabel = row.label
        const moveWithinSlot = (index: number) => onMove(placement, { targetIndex: index })

        return (
            <Box key={placement.id}>
                <Paper variant='outlined' sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='body2' sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                                    {rowLabel}
                                </Typography>
                                {placement.isInherited ? (
                                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                        {tc('nesting.sourceManaged')}
                                    </Typography>
                                ) : null}
                            </Box>
                            <Stack
                                direction='row'
                                spacing={0.25}
                                sx={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}
                            >
                                {placement.parentInstanceKey && canManageLayouts && canReorder && siblingIndex > 0 ? (
                                    <Tooltip title={tc('nesting.moveUp')}>
                                        <IconButton
                                            size='small'
                                            aria-label={tc('nesting.moveUp')}
                                            onClick={() => moveWithinSlot(siblingIndex - 1)}
                                        >
                                            <ArrowUpwardIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {placement.parentInstanceKey &&
                                canManageLayouts &&
                                canReorder &&
                                siblingIndex >= 0 &&
                                siblingIndex < siblings.length - 1 ? (
                                    <Tooltip title={tc('nesting.moveDown')}>
                                        <IconButton
                                            size='small'
                                            aria-label={tc('nesting.moveDown')}
                                            onClick={() => moveWithinSlot(siblingIndex + 1)}
                                        >
                                            <ArrowDownwardIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {canManageLayouts && destinations.length > 0 && !placement.isInherited ? (
                                    <Tooltip title={tc('nesting.children')}>
                                        <IconButton
                                            size='small'
                                            aria-label={`${tc('nesting.moveToSlot', { slot: tc('nesting.children') })}: ${rowLabel}`}
                                            onClick={(event) => setMoveMenu({ anchor: event.currentTarget, placement, destinations })}
                                        >
                                            <DriveFileMoveOutlinedIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {row.onEdit ? (
                                    <Tooltip title={row.editTooltip ?? tc('actions.edit')}>
                                        <IconButton
                                            size='small'
                                            aria-label={row.editAriaLabel ?? row.editTooltip ?? tc('actions.edit')}
                                            onClick={row.onEdit}
                                        >
                                            <EditOutlinedIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {row.onEditContent ? (
                                    <Tooltip title={row.editContentTooltip ?? tc('actions.edit')}>
                                        <IconButton
                                            size='small'
                                            aria-label={row.editContentAriaLabel ?? row.editContentTooltip ?? tc('actions.edit')}
                                            onClick={row.onEditContent}
                                        >
                                            <EditOutlinedIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {row.onDuplicate ? (
                                    <Tooltip title={tc('nesting.duplicateSubtree')}>
                                        <IconButton
                                            size='small'
                                            aria-label={row.duplicateAriaLabel ?? tc('nesting.duplicateSubtree')}
                                            onClick={row.onDuplicate}
                                        >
                                            <ContentCopyIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {row.onReset ? (
                                    <Tooltip title={row.resetTooltip ?? tc('actions.reset')}>
                                        <IconButton
                                            size='small'
                                            aria-label={row.resetAriaLabel ?? row.resetTooltip ?? tc('actions.reset')}
                                            onClick={row.onReset}
                                        >
                                            <SettingsBackupRestoreIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {row.onToggleActive ? (
                                    <Tooltip title={row.toggleActiveTooltip ?? tc('actions.edit')}>
                                        <Switch
                                            size='small'
                                            checked={row.isActive}
                                            onChange={(_event, checked) => row.onToggleActive?.(checked)}
                                            slotProps={{
                                                input: { 'aria-label': `${row.toggleActiveTooltip ?? tc('actions.edit')}: ${rowLabel}` }
                                            }}
                                        />
                                    </Tooltip>
                                ) : null}
                                {row.onRemove ? (
                                    <Tooltip title={row.removeTooltip ?? tc('actions.delete')}>
                                        <IconButton
                                            size='small'
                                            aria-label={row.removeAriaLabel ?? row.removeTooltip ?? tc('actions.delete')}
                                            onClick={row.onRemove}
                                        >
                                            <DeleteOutlineRoundedIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                            </Stack>
                        </Stack>
                        {configured?.slots.length ? (
                            <Stack spacing={1} sx={{ pl: { xs: 1, sm: 2 }, borderLeft: 2, borderColor: 'divider' }}>
                                {configured.slots.map((slot) => {
                                    const children = (childrenByParent.get(placement.instanceKey) ?? []).filter(
                                        (child) => child.slotKey === slot.key
                                    )
                                    const candidates = getAddCandidates(placement, slot)
                                    const mayAdd =
                                        canManageLayouts &&
                                        ownsCompositionInCurrentLayout(placement, configured.definition) &&
                                        candidates.length > 0
                                    return (
                                        <Paper
                                            key={`${placement.instanceKey}-${slot.key}`}
                                            role='group'
                                            aria-label={`${getWidgetChipLabel(placement)} · ${slot.label}`}
                                            variant='outlined'
                                            sx={{ p: 1 }}
                                        >
                                            <Stack spacing={1}>
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    spacing={1}
                                                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                                                >
                                                    <Typography variant='subtitle2'>{slot.label}</Typography>
                                                    {mayAdd ? (
                                                        <Button
                                                            size='small'
                                                            aria-label={`${tc('nesting.addChild')}: ${getWidgetChipLabel(placement)} · ${
                                                                slot.label
                                                            }`}
                                                            onClick={(event) =>
                                                                setAddMenu({
                                                                    anchor: event.currentTarget,
                                                                    parent: placement,
                                                                    slot,
                                                                    candidates
                                                                })
                                                            }
                                                        >
                                                            {tc('nesting.addChild')}
                                                        </Button>
                                                    ) : placement.isInherited &&
                                                      !ownsCompositionInCurrentLayout(placement, configured.definition) ? (
                                                        <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                                            {tc('nesting.sourceManaged')}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                                {children.length ? (
                                                    <Stack spacing={0.75}>
                                                        {children.map((child) => renderPlacement(child, nextPath))}
                                                    </Stack>
                                                ) : (
                                                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                        {tc('nesting.emptySlot')}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Paper>
                                    )
                                })}
                            </Stack>
                        ) : null}
                    </Stack>
                </Paper>
            </Box>
        )
    }

    const rootContainers = placements.filter((placement) => placement.parentInstanceKey === null && placement.slotKey === null)
    const rootsWithSlots = rootContainers.flatMap((placement) => {
        const configured = getConfiguredSlots(layout, placement, locale, tc)
        return configured?.slots.length ? [{ placement, configured }] : []
    })

    if (!rootsWithSlots.length) return null

    return (
        <Box component='section' aria-label={tc('nesting.children')}>
            <Stack spacing={1.5}>
                <Typography variant='h6'>{tc('nesting.children')}</Typography>
                {rootsWithSlots.map(({ placement, configured }) => (
                    <Paper key={placement.instanceKey} variant='outlined' sx={{ p: 1.5 }}>
                        <Stack spacing={1.25}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                                {zoneLabels[placement.zone]} · {getWidgetChipLabel(placement)}
                            </Typography>
                            {configured.slots.map((slot) => {
                                const children = (childrenByParent.get(placement.instanceKey) ?? []).filter(
                                    (child) => child.slotKey === slot.key
                                )
                                const candidates = getAddCandidates(placement, slot)
                                const canEditComposition = ownsCompositionInCurrentLayout(placement, configured.definition)
                                const mayAdd = canManageLayouts && canEditComposition && candidates.length > 0
                                return (
                                    <Paper
                                        key={`${placement.instanceKey}-${slot.key}`}
                                        role='group'
                                        aria-label={`${getWidgetChipLabel(placement)} · ${slot.label}`}
                                        variant='outlined'
                                        sx={{ p: 1.25 }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack
                                                direction={{ xs: 'column', sm: 'row' }}
                                                spacing={1}
                                                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                                            >
                                                <Typography variant='subtitle2'>{slot.label}</Typography>
                                                {mayAdd ? (
                                                    <Button
                                                        size='small'
                                                        aria-label={`${tc('nesting.addChild')}: ${getWidgetChipLabel(placement)} · ${
                                                            slot.label
                                                        }`}
                                                        onClick={(event) =>
                                                            setAddMenu({ anchor: event.currentTarget, parent: placement, slot, candidates })
                                                        }
                                                    >
                                                        {tc('nesting.addChild')}
                                                    </Button>
                                                ) : placement.isInherited && !canEditComposition ? (
                                                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                                        {tc('nesting.sourceManaged')}
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                            {children.length ? (
                                                <Stack spacing={1} sx={{ pl: { xs: 1, sm: 2 }, borderLeft: 2, borderColor: 'divider' }}>
                                                    {children.map((child) => renderPlacement(child, new Set([placement.instanceKey])))}
                                                </Stack>
                                            ) : (
                                                <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                    {tc('nesting.emptySlot')}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Paper>
                                )
                            })}
                        </Stack>
                    </Paper>
                ))}
            </Stack>
            <Menu anchorEl={addMenu?.anchor} open={Boolean(addMenu)} onClose={() => setAddMenu(null)}>
                {addMenu?.candidates.map((candidate) => (
                    <MenuItem
                        key={candidate.key}
                        onClick={() => {
                            onAddWidget(addMenu.parent.zone, candidate.key, {
                                parentInstanceKey: addMenu.parent.instanceKey,
                                slotKey: addMenu.slot.key
                            })
                            setAddMenu(null)
                        }}
                    >
                        {widgetLabelByKey[candidate.key] ?? tc(candidate.labelKey, { defaultValue: candidate.defaultLabel })}
                    </MenuItem>
                ))}
            </Menu>
            <Menu anchorEl={moveMenu?.anchor} open={Boolean(moveMenu)} onClose={() => setMoveMenu(null)}>
                {moveMenu?.destinations.map(({ parent, slot }) => (
                    <MenuItem
                        key={`${parent.instanceKey}-${slot.key}`}
                        onClick={() => {
                            onMove(moveMenu.placement, {
                                targetIndex: (childrenByParent.get(parent.instanceKey) ?? []).filter((child) => child.slotKey === slot.key)
                                    .length,
                                targetParentInstanceKey: parent.instanceKey,
                                targetSlotKey: slot.key
                            })
                            setMoveMenu(null)
                        }}
                    >
                        {tc('nesting.moveToSlot', { slot: `${getWidgetChipLabel(parent)} · ${slot.label}` })}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    )
}
