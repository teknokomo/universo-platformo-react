import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Autocomplete from '@mui/material/Autocomplete'
import type { MenuWidgetConfig, MenuWidgetConfigItem, MetahubMenuItemKind, VersionedLocalizedContent } from '@universo/types'
import { isEnabledComponentConfig } from '@universo/types'
import { EntityFormDialog, LocalizedInlineField } from '@universo/template-mui'
import {
    createLocalizedContent,
    generateUuidV7,
    buildVLC as utilsBuildVLC,
    ensureVLC as utilsEnsureVLC,
    isSafeMenuHref
} from '@universo/utils'

import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import { listEntityInstances } from '../../entities/api/entityInstances'
import { listEntityTypes, type MetahubEntityType } from '../../entities/api/entityTypes'
import { useTreeEntities } from '../../entities/presets/hooks/useTreeEntities'
import { getVLCString, normalizeLocale } from '../../../types'
import LayoutWidgetSharedBehaviorFields from './LayoutWidgetSharedBehaviorFields'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MenuWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    /** Current widget config (null when creating a new menuWidget). */
    config: MenuWidgetConfig | null
    layoutId?: string | null
    widgetId?: string | null
    showSharedBehavior?: boolean
    showScopeVisibility?: boolean
    onSave: (config: MenuWidgetConfig) => void
    onCancel: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// WARN-7 fix: Use shared VLC helpers from @universo/utils
const buildVLC = utilsBuildVLC
const ensureVLC = utilsEnsureVLC
type WorkspacePlacement = NonNullable<MenuWidgetConfig['workspacePlacement']>
type SectionTargetOption = {
    id: string
    label: string
    kindKey: string
    codename: string
    sortOrder: number
}

const WORKSPACE_PLACEMENTS: WorkspacePlacement[] = ['primary', 'overflow', 'hidden']
const EDITABLE_MENU_ITEM_KINDS: MetahubMenuItemKind[] = ['section', 'hub', 'link']

const normalizeMaxPrimaryItems = (value: unknown): number | null => {
    if (value == null || value === '') return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.max(1, Math.min(12, Math.trunc(parsed)))
}

const normalizeWorkspacePlacement = (value: unknown): WorkspacePlacement => {
    return WORKSPACE_PLACEMENTS.includes(value as WorkspacePlacement) ? (value as WorkspacePlacement) : 'primary'
}

export const normalizeEditableMenuItemKind = (kind: MetahubMenuItemKind | string | null | undefined): MetahubMenuItemKind => {
    if (kind === 'hub' || kind === 'link' || kind === 'section') return kind
    return 'link'
}

export const resolveMenuItemSectionTarget = (item?: MenuWidgetConfigItem | null): string => {
    return item?.sectionId ?? item?.linkedCollectionId ?? ''
}

export const isLayoutMenuSectionEntityType = (entityType: Pick<MetahubEntityType, 'components'>): boolean =>
    isEnabledComponentConfig(entityType.components.layoutConfig)

function makeDefaultConfig(): MenuWidgetConfig {
    return {
        showTitle: true,
        title: buildVLC('', ''),
        autoShowAllSections: false,
        bindToHub: false,
        boundTreeEntityId: null,
        maxPrimaryItems: 6,
        overflowLabelKey: 'runtime.menu.more',
        startPage: null,
        workspacePlacement: 'primary',
        items: []
    }
}

function normalizeMenuConfig(
    config: MenuWidgetConfig | null | undefined,
    uiLocale: string,
    defaultTitle: VersionedLocalizedContent<string>
): MenuWidgetConfig {
    if (!config) return makeDefaultConfig()
    return {
        ...makeDefaultConfig(),
        ...config,
        title: ensureVLC(config.title, uiLocale) ?? defaultTitle,
        autoShowAllSections: Boolean(config.autoShowAllSections) && !config.bindToHub,
        bindToHub: Boolean(config.bindToHub),
        boundTreeEntityId: typeof config.boundTreeEntityId === 'string' ? config.boundTreeEntityId : null,
        maxPrimaryItems: normalizeMaxPrimaryItems(config.maxPrimaryItems),
        overflowLabelKey:
            typeof config.overflowLabelKey === 'string' && config.overflowLabelKey.trim() ? config.overflowLabelKey.trim() : null,
        startPage: typeof config.startPage === 'string' && config.startPage.trim() ? config.startPage.trim() : null,
        workspacePlacement: normalizeWorkspacePlacement(config.workspacePlacement),
        items: Array.isArray(config.items) ? config.items : []
    }
}

// ---------------------------------------------------------------------------
// SortableItemRow
// ---------------------------------------------------------------------------

function SortableItemRow({
    item,
    label,
    kindLabel,
    onEdit,
    onRemove
}: {
    item: MenuWidgetConfigItem
    label: string
    kindLabel: string
    onEdit: () => void
    onRemove: () => void
}) {
    const { fieldDefinitions, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            variant='outlined'
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 1.5 }}
        >
            <IconButton size='small' sx={{ cursor: 'grab' }} {...fieldDefinitions} {...listeners}>
                <DragIndicatorRoundedIcon fontSize='small' />
            </IconButton>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant='body2' noWrap>
                    {label || '—'}
                </Typography>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                    <Chip label={kindLabel} size='small' variant='outlined' />
                    {!item.isActive && <Chip label='off' size='small' color='warning' variant='outlined' />}
                </Stack>
            </Box>
            <IconButton size='small' onClick={onEdit}>
                <EditRoundedIcon fontSize='small' />
            </IconButton>
            <IconButton size='small' onClick={onRemove}>
                <DeleteRoundedIcon fontSize='small' />
            </IconButton>
        </Paper>
    )
}

// ---------------------------------------------------------------------------
// ItemFormDialog
// ---------------------------------------------------------------------------

function ItemFormDialog({
    open,
    item,
    metahubId,
    uiLocale,
    onSave,
    onCancel
}: {
    open: boolean
    item: MenuWidgetConfigItem | null
    metahubId: string
    uiLocale: string
    onSave: (item: MenuWidgetConfigItem) => void
    onCancel: () => void
}) {
    const { t } = useTranslation(['metahubs', 'common'])
    const isEdit = Boolean(item)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [kind, setKind] = useState<MetahubMenuItemKind>(() => normalizeEditableMenuItemKind(item?.kind))
    const [titleVlc, setTitleVlc] = useState<VersionedLocalizedContent<string> | null>(
        () => ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), '')
    )
    const [icon, setIcon] = useState(item?.icon ?? '')
    const [href, setHref] = useState(item?.href ?? '')
    const [sectionTargetId, setSectionTargetId] = useState(() => resolveMenuItemSectionTarget(item))
    const [treeEntityId, setTreeEntityId] = useState(item?.treeEntityId ?? '')
    const [isActive, setIsActive] = useState(item?.isActive ?? true)

    // BUG-1 fix: Reset local state when the edited item changes
    const prevItemRef = useRef(item)
    useEffect(() => {
        if (prevItemRef.current === item) return
        prevItemRef.current = item
        setSubmitError(null)
        setKind(normalizeEditableMenuItemKind(item?.kind))
        setTitleVlc(ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), ''))
        setIcon(item?.icon ?? '')
        setHref(item?.href ?? '')
        setSectionTargetId(resolveMenuItemSectionTarget(item))
        setTreeEntityId(item?.treeEntityId ?? '')
        setIsActive(item?.isActive ?? true)
    }, [item, uiLocale])

    const sectionTargetsQuery = useQuery({
        queryKey: [...metahubsQueryKeys.detail(metahubId), 'menuWidget', 'sectionTargets', uiLocale],
        enabled: open,
        queryFn: async (): Promise<SectionTargetOption[]> => {
            const entityTypesPage = await fetchAllPaginatedItems((params) => listEntityTypes(metahubId, params), {
                limit: 1000,
                sortOrder: 'asc'
            })
            const layoutCapableTypes = entityTypesPage.items.filter(isLayoutMenuSectionEntityType)
            const groups = await Promise.all(
                layoutCapableTypes.map(async (entityType) => {
                    const instancesPage = await fetchAllPaginatedItems(
                        (params) => listEntityInstances(metahubId, { ...params, kind: entityType.kindKey }),
                        { limit: 1000, sortOrder: 'asc' }
                    )
                    const typeLabel =
                        getVLCString(entityType.codename, uiLocale) ||
                        getVLCString(entityType.codename, 'en') ||
                        entityType.ui?.nameKey ||
                        entityType.kindKey

                    return instancesPage.items.map((entity) => {
                        const label = getVLCString(entity.name, uiLocale) || getVLCString(entity.name, 'en') || String(entity.id)
                        const codename = getVLCString(entity.codename, uiLocale) || getVLCString(entity.codename, 'en') || ''

                        return {
                            id: entity.id,
                            label: `${label} · ${typeLabel}`,
                            kindKey: entityType.kindKey,
                            codename,
                            sortOrder: typeof entity.sortOrder === 'number' ? entity.sortOrder : 0
                        }
                    })
                })
            )

            return groups
                .flat()
                .sort(
                    (left, right) =>
                        left.kindKey.localeCompare(right.kindKey) ||
                        left.sortOrder - right.sortOrder ||
                        left.label.localeCompare(right.label)
                )
        }
    })
    const treeEntities = useTreeEntities(metahubId)

    const hasTitleContent = useMemo(() => {
        if (!titleVlc?.locales || typeof titleVlc.locales !== 'object') return false
        return Object.values(titleVlc.locales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    }, [titleVlc])

    const handleSave = () => {
        if (!hasTitleContent) {
            setSubmitError(t('layouts.menuEditor.validation.titleRequired', 'Name is required.'))
            return
        }

        if (kind === 'section' && !sectionTargetId.trim()) {
            setSubmitError(t('layouts.menuEditor.validation.sectionRequired', 'Select an entity section for this menu item.'))
            return
        }

        if (kind === 'hub' && !treeEntityId) {
            setSubmitError(t('layouts.menuEditor.validation.hubRequired', 'Select a hub for this menu item.'))
            return
        }

        if (kind === 'link') {
            const trimmedHref = href.trim()
            if (trimmedHref.length === 0) {
                setSubmitError(t('layouts.menuEditor.validation.hrefRequired', 'Link URL is required for link items.'))
                return
            }
            if (!isSafeMenuHref(trimmedHref)) {
                setSubmitError(
                    t(
                        'layouts.menuEditor.validation.hrefUnsafeScheme',
                        'This link type is not allowed. Use https, mailto, tel, #, or an internal path.'
                    )
                )
                return
            }
        }

        setSubmitError(null)
        onSave({
            id: item?.id ?? generateUuidV7(),
            kind,
            title: titleVlc ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
            icon: icon.trim() || null,
            href: kind === 'link' ? href.trim() || null : null,
            linkedCollectionId: kind === 'section' ? sectionTargetId.trim() || null : null,
            treeEntityId: kind === 'hub' ? treeEntityId || null : null,
            sectionId: kind === 'section' ? sectionTargetId.trim() || null : null,
            sortOrder: item?.sortOrder ?? 0,
            isActive
        })
    }

    const sectionTargets = sectionTargetsQuery.data ?? []
    const selectedSectionTarget =
        sectionTargets.find((option) => option.id === sectionTargetId || option.codename === sectionTargetId) ?? null

    return (
        <EntityFormDialog
            open={open}
            title={isEdit ? t('layouts.menuEditor.editItem') : t('layouts.menuEditor.addItem')}
            mode={isEdit ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => handleSave()}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            error={submitError ?? undefined}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <LocalizedInlineField
                        mode='localized'
                        label={t('common:fields.name', 'Name')}
                        value={titleVlc}
                        onChange={(next: VersionedLocalizedContent<string>) => {
                            setSubmitError(null)
                            setTitleVlc(next)
                        }}
                        uiLocale={uiLocale}
                    />

                    <FormControl fullWidth>
                        <InputLabel>{t('layouts.menuEditor.itemKind')}</InputLabel>
                        <Select
                            value={kind}
                            label={t('layouts.menuEditor.itemKind')}
                            onChange={(e) => {
                                setSubmitError(null)
                                setKind(normalizeEditableMenuItemKind(e.target.value as MetahubMenuItemKind))
                            }}
                        >
                            {EDITABLE_MENU_ITEM_KINDS.map((k) => {
                                const kindKey = `layouts.menuEditor.kind${
                                    k.charAt(0).toUpperCase() + k.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
                                }` as const
                                return (
                                    <MenuItem key={k} value={k}>
                                        {String(t(kindKey, k))}
                                    </MenuItem>
                                )
                            })}
                        </Select>
                    </FormControl>

                    <TextField
                        label={t('layouts.menuEditor.itemIcon')}
                        value={icon}
                        onChange={(e) => {
                            setSubmitError(null)
                            setIcon(e.target.value)
                        }}
                        fullWidth
                        placeholder={t('layouts.menuEditor.itemIconPlaceholder', 'database, link, shopping_cart...')}
                    />

                    {kind === 'link' && (
                        <TextField
                            label={t('layouts.menuEditor.itemHref')}
                            value={href}
                            onChange={(e) => {
                                setSubmitError(null)
                                setHref(e.target.value)
                            }}
                            fullWidth
                            placeholder={t('layouts.menuEditor.itemHrefPlaceholder', 'https://...')}
                        />
                    )}

                    {kind === 'section' && (
                        <Autocomplete
                            freeSolo
                            options={sectionTargets}
                            value={selectedSectionTarget ?? sectionTargetId}
                            loading={sectionTargetsQuery.isFetching}
                            getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
                            isOptionEqualToValue={(option, value) =>
                                typeof value !== 'string' && (option.id === value.id || option.codename === value.codename)
                            }
                            onChange={(_, nextValue) => {
                                setSubmitError(null)
                                if (typeof nextValue === 'string') {
                                    setSectionTargetId(nextValue)
                                    return
                                }
                                setSectionTargetId(nextValue?.id ?? '')
                            }}
                            onInputChange={(_, nextInputValue, reason) => {
                                if (reason === 'input' || reason === 'clear') {
                                    setSubmitError(null)
                                    setSectionTargetId(nextInputValue)
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('layouts.menuEditor.itemSection', 'Entity section')}
                                    helperText={t(
                                        'layouts.menuEditor.itemSectionHint',
                                        'Select any layout-capable Entity instance, or enter an id/codename manually.'
                                    )}
                                />
                            )}
                        />
                    )}
                    {kind === 'hub' && (
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.menuEditor.itemHub')}</InputLabel>
                            <Select
                                value={treeEntityId}
                                label={t('layouts.menuEditor.itemHub')}
                                onChange={(e) => {
                                    setSubmitError(null)
                                    setTreeEntityId(e.target.value)
                                }}
                            >
                                {treeEntities.length === 0 ? (
                                    <MenuItem disabled tabIndex={-1}>
                                        {t('layouts.menuEditor.noHubs')}
                                    </MenuItem>
                                ) : (
                                    treeEntities.map((hub) => {
                                        const name = getVLCString(hub.name, uiLocale) || getVLCString(hub.name, 'en') || hub.codename
                                        return (
                                            <MenuItem key={hub.id} value={hub.id}>
                                                {name}
                                            </MenuItem>
                                        )
                                    })
                                )}
                            </Select>
                        </FormControl>
                    )}
                    <FormControlLabel
                        sx={{ ml: 0 }}
                        control={
                            <Switch
                                checked={isActive}
                                onChange={(_, checked) => {
                                    setSubmitError(null)
                                    setIsActive(checked)
                                }}
                            />
                        }
                        label={t('layouts.menuEditor.itemActive', 'Active')}
                    />
                </Stack>
            )}
        />
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MenuWidgetEditorDialog({
    open,
    metahubId,
    config,
    layoutId,
    widgetId,
    showSharedBehavior = false,
    showScopeVisibility = false,
    onSave,
    onCancel
}: MenuWidgetEditorDialogProps) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const uiLocale = normalizeLocale(i18n.language)
    const isEdit = Boolean(config)
    const dialogTitle = isEdit ? t('layouts.menuEditor.editTitle') : t('layouts.menuEditor.createTitle')

    const defaultTitle = useMemo(
        () => buildVLC(t('layouts.menuEditor.defaultTitle', 'Main'), t('layouts.menuEditor.defaultTitleRu', 'Основное')),
        [t]
    )

    const [draft, setDraft] = useState<MenuWidgetConfig>(() => {
        return normalizeMenuConfig(config, uiLocale, defaultTitle)
    })
    const [itemDialog, setItemDialog] = useState<{ open: boolean; item: MenuWidgetConfigItem | null }>({ open: false, item: null })
    const [dialogError, setDialogError] = useState<string | null>(null)

    const availableHubs = useTreeEntities(metahubId)

    // WARN-1 fix: Reset draft when dialog opens with new config (moved from render to effect)
    const prevOpenRef = useRef(false)
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            prevOpenRef.current = true
            setDraft(normalizeMenuConfig(config, uiLocale, defaultTitle))
            setDialogError(null)
        }
        if (!open && prevOpenRef.current) {
            prevOpenRef.current = false
        }
    }, [open, config, uiLocale, defaultTitle])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setDraft((prev) => {
            const oldIdx = prev.items.findIndex((i) => i.id === active.id)
            const newIdx = prev.items.findIndex((i) => i.id === over.id)
            if (oldIdx < 0 || newIdx < 0) return prev
            const reordered = arrayMove(prev.items, oldIdx, newIdx).map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
            return { ...prev, items: reordered }
        })
    }, [])

    const handleAddItem = () => {
        setItemDialog({ open: true, item: null })
    }

    const handleEditItem = (item: MenuWidgetConfigItem) => {
        setItemDialog({ open: true, item })
    }

    const handleRemoveItem = (id: string) => {
        setDraft((prev) => ({
            ...prev,
            items: prev.items.filter((i) => i.id !== id).map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
        }))
    }

    const handleItemDialogSave = (saved: MenuWidgetConfigItem) => {
        setItemDialog({ open: false, item: null })
        setDraft((prev) => {
            const existing = prev.items.findIndex((i) => i.id === saved.id)
            if (existing >= 0) {
                const updated = [...prev.items]
                updated[existing] = { ...saved, sortOrder: updated[existing].sortOrder }
                return { ...prev, items: updated }
            }
            return { ...prev, items: [...prev.items, { ...saved, sortOrder: prev.items.length + 1 }] }
        })
    }

    const handleSave = () => {
        if (draft.bindToHub && !draft.boundTreeEntityId) {
            setDialogError(t('layouts.menuEditor.validation.boundHubRequired', 'Select a hub to bind this menu to.'))
            return
        }
        setDialogError(null)
        onSave({
            ...draft,
            autoShowAllSections: draft.bindToHub ? false : Boolean(draft.autoShowAllSections),
            maxPrimaryItems: normalizeMaxPrimaryItems(draft.maxPrimaryItems),
            overflowLabelKey:
                typeof draft.overflowLabelKey === 'string' && draft.overflowLabelKey.trim() ? draft.overflowLabelKey.trim() : null,
            startPage: typeof draft.startPage === 'string' && draft.startPage.trim() ? draft.startPage.trim() : null,
            workspacePlacement: normalizeWorkspacePlacement(draft.workspacePlacement),
            items: draft.items
        })
    }

    const kindLabels: Record<MetahubMenuItemKind, string> = {
        section: t('layouts.menuEditor.kindSection', 'Entity section'),
        hub: t('layouts.menuEditor.kindHub'),
        link: t('layouts.menuEditor.kindLink')
    }

    const getItemLabel = (item: MenuWidgetConfigItem): string => {
        return getVLCString(item.title, uiLocale) || getVLCString(item.title, 'en') || kindLabels[item.kind]
    }

    return (
        <>
            <EntityFormDialog
                open={open}
                title={dialogTitle}
                mode={isEdit ? 'edit' : 'create'}
                nameLabel={t('common:fields.name', 'Name')}
                descriptionLabel={t('common:fields.description', 'Description')}
                hideDefaultFields
                onClose={onCancel}
                onSave={() => handleSave()}
                saveButtonText={t('common:save', 'Save')}
                cancelButtonText={t('common:cancel', 'Cancel')}
                error={dialogError ?? undefined}
                extraFields={() => (
                    <Stack spacing={3}>
                        {/* --- Title settings --- */}
                        <Stack spacing={2}>
                            <LocalizedInlineField
                                mode='localized'
                                label={t('common:fields.name', 'Name')}
                                value={draft.title as VersionedLocalizedContent<string> | null}
                                onChange={(next: VersionedLocalizedContent<string>) => setDraft((p) => ({ ...p, title: next }))}
                                uiLocale={uiLocale}
                            />
                            <Stack spacing={1.5}>
                                <FormControlLabel
                                    sx={{ ml: 0 }}
                                    control={
                                        <Switch
                                            checked={draft.showTitle}
                                            onChange={(_, checked) => setDraft((p) => ({ ...p, showTitle: checked }))}
                                        />
                                    }
                                    label={t('layouts.menuEditor.showTitle')}
                                />
                                <Box>
                                    <FormControlLabel
                                        sx={{ ml: 0 }}
                                        control={
                                            <Switch
                                                checked={Boolean(draft.bindToHub)}
                                                onChange={(_, checked) => {
                                                    setDialogError(null)
                                                    setDraft((p) => ({
                                                        ...p,
                                                        bindToHub: checked,
                                                        autoShowAllSections: checked ? false : p.autoShowAllSections,
                                                        boundTreeEntityId: checked ? p.boundTreeEntityId ?? null : null
                                                    }))
                                                }}
                                            />
                                        }
                                        label={t('layouts.menuEditor.bindToHub')}
                                    />
                                    {draft.bindToHub && (
                                        <Stack spacing={1} sx={{ mt: 1, ml: 7 }}>
                                            <FormControl fullWidth size='small'>
                                                <InputLabel>{t('layouts.menuEditor.boundHubLabel')}</InputLabel>
                                                <Select
                                                    value={draft.boundTreeEntityId ?? ''}
                                                    label={t('layouts.menuEditor.boundHubLabel')}
                                                    onChange={(event) => {
                                                        setDialogError(null)
                                                        setDraft((p) => ({
                                                            ...p,
                                                            boundTreeEntityId:
                                                                typeof event.target.value === 'string' ? event.target.value : null
                                                        }))
                                                    }}
                                                >
                                                    <MenuItem value=''>{t('layouts.menuEditor.boundHubPlaceholder')}</MenuItem>
                                                    {availableHubs.map((hub) => {
                                                        const name =
                                                            getVLCString(hub.name, uiLocale) || getVLCString(hub.name, 'en') || hub.codename
                                                        return (
                                                            <MenuItem key={hub.id} value={hub.id}>
                                                                {name}
                                                            </MenuItem>
                                                        )
                                                    })}
                                                </Select>
                                            </FormControl>
                                            {draft.boundTreeEntityId && (
                                                <Alert severity='info' sx={{ borderRadius: 1.5 }}>
                                                    {t('layouts.menuEditor.boundHubInfo')}
                                                </Alert>
                                            )}
                                        </Stack>
                                    )}
                                    <FormControlLabel
                                        sx={{ ml: 0 }}
                                        control={
                                            <Switch
                                                checked={draft.autoShowAllSections}
                                                onChange={(_, checked) => {
                                                    setDialogError(null)
                                                    setDraft((p) => ({ ...p, autoShowAllSections: checked }))
                                                }}
                                                disabled={Boolean(draft.bindToHub)}
                                            />
                                        }
                                        label={t('layouts.menuEditor.autoShowAllSections', 'Automatically show all sections')}
                                    />
                                    <FormHelperText sx={{ mt: -0.5, ml: 7 }}>
                                        {draft.bindToHub
                                            ? t('layouts.menuEditor.autoShowAllSectionsDisabledByBinding')
                                            : t('layouts.menuEditor.autoShowAllSectionsHint')}
                                    </FormHelperText>
                                    <Stack spacing={2} sx={{ mt: 2 }}>
                                        <TextField
                                            label={t('layouts.menuEditor.maxPrimaryItems', 'Primary menu item limit')}
                                            type='number'
                                            value={draft.maxPrimaryItems ?? ''}
                                            onChange={(event) =>
                                                setDraft((p) => ({ ...p, maxPrimaryItems: normalizeMaxPrimaryItems(event.target.value) }))
                                            }
                                            inputProps={{ min: 1, max: 12, step: 1 }}
                                            fullWidth
                                            size='small'
                                            helperText={t(
                                                'layouts.menuEditor.maxPrimaryItemsHint',
                                                'Extra active menu items are moved into the overflow menu.'
                                            )}
                                        />
                                        <TextField
                                            label={t('layouts.menuEditor.overflowLabelKey', 'Overflow label i18n key')}
                                            value={draft.overflowLabelKey ?? ''}
                                            onChange={(event) =>
                                                setDraft((p) => ({
                                                    ...p,
                                                    overflowLabelKey: event.target.value.trim() || null
                                                }))
                                            }
                                            fullWidth
                                            size='small'
                                            placeholder='runtime.menu.more'
                                        />
                                        <TextField
                                            label={t('layouts.menuEditor.startPage', 'Start page code')}
                                            value={draft.startPage ?? ''}
                                            onChange={(event) =>
                                                setDraft((p) => ({
                                                    ...p,
                                                    startPage: event.target.value.trim() || null
                                                }))
                                            }
                                            fullWidth
                                            size='small'
                                            helperText={t(
                                                'layouts.menuEditor.startPageHint',
                                                'Use a hub or Entity section id/codename to choose the first opened section.'
                                            )}
                                        />
                                        <FormControl fullWidth size='small'>
                                            <InputLabel>
                                                {t('layouts.menuEditor.workspacePlacement', 'Workspace menu placement')}
                                            </InputLabel>
                                            <Select
                                                value={draft.workspacePlacement ?? 'primary'}
                                                label={t('layouts.menuEditor.workspacePlacement', 'Workspace menu placement')}
                                                onChange={(event) =>
                                                    setDraft((p) => ({
                                                        ...p,
                                                        workspacePlacement: normalizeWorkspacePlacement(event.target.value)
                                                    }))
                                                }
                                            >
                                                {WORKSPACE_PLACEMENTS.map((placement) => (
                                                    <MenuItem key={placement} value={placement}>
                                                        {t(`layouts.menuEditor.workspacePlacements.${placement}`, placement)}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </Box>
                            </Stack>
                        </Stack>

                        {showSharedBehavior ? (
                            <LayoutWidgetSharedBehaviorFields
                                value={draft}
                                onChange={(nextValue) => setDraft(nextValue as MenuWidgetConfig)}
                            />
                        ) : null}

                        {showScopeVisibility && layoutId && widgetId ? (
                            <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                        ) : null}

                        {/* --- Menu items DnD --- */}
                        <Box>
                            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
                                <Typography variant='subtitle2'>{t('layouts.menuEditor.items')}</Typography>
                                <Button size='small' startIcon={<AddRoundedIcon />} onClick={handleAddItem}>
                                    {t('layouts.menuEditor.addItem')}
                                </Button>
                            </Stack>

                            {draft.items.length === 0 ? (
                                <Typography variant='body2' color='text.secondary' sx={{ py: 2, textAlign: 'center' }}>
                                    {t('layouts.menuEditor.itemsEmpty')}
                                </Typography>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={draft.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                        <Stack spacing={1}>
                                            {draft.items.map((item) => (
                                                <SortableItemRow
                                                    key={item.id}
                                                    item={item}
                                                    label={getItemLabel(item)}
                                                    kindLabel={kindLabels[item.kind]}
                                                    onEdit={() => handleEditItem(item)}
                                                    onRemove={() => handleRemoveItem(item.id)}
                                                />
                                            ))}
                                        </Stack>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </Box>
                    </Stack>
                )}
            />

            {/* Nested item editor dialog */}
            <ItemFormDialog
                open={itemDialog.open}
                item={itemDialog.item}
                metahubId={metahubId}
                uiLocale={uiLocale}
                onSave={handleItemDialogSave}
                onCancel={() => setItemDialog({ open: false, item: null })}
            />
        </>
    )
}
