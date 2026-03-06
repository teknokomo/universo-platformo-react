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
import type { MenuWidgetConfig, MenuWidgetConfigItem, MetahubMenuItemKind, VersionedLocalizedContent } from '@universo/types'
import { METAHUB_MENU_ITEM_KINDS } from '@universo/types'
import { EntityFormDialog, LocalizedInlineField } from '@universo/template-mui'
import { createLocalizedContent, generateUuidV7, buildVLC as utilsBuildVLC, ensureVLC as utilsEnsureVLC } from '@universo/utils'

import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import * as catalogsApi from '../../catalogs/api'
import * as hubsApi from '../../hubs/api'
import type { Hub, PaginatedResponse } from '../../../types'
import { getVLCString, normalizeLocale } from '../../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MenuWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    /** Current widget config (null when creating a new menuWidget). */
    config: MenuWidgetConfig | null
    onSave: (config: MenuWidgetConfig) => void
    onCancel: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// WARN-7 fix: Use shared VLC helpers from @universo/utils
const buildVLC = utilsBuildVLC
const ensureVLC = utilsEnsureVLC

function makeDefaultConfig(): MenuWidgetConfig {
    return {
        showTitle: true,
        title: buildVLC('', ''),
        autoShowAllCatalogs: false,
        bindToHub: false,
        boundHubId: null,
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
        autoShowAllCatalogs: Boolean(config.autoShowAllCatalogs) && !config.bindToHub,
        bindToHub: Boolean(config.bindToHub),
        boundHubId: typeof config.boundHubId === 'string' ? config.boundHubId : null,
        items: Array.isArray(config.items) ? config.items.filter((item) => item.kind !== 'catalogs_all') : []
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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            variant='outlined'
            sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 1.5 }}
        >
            <IconButton size='small' sx={{ cursor: 'grab' }} {...attributes} {...listeners}>
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
    const [kind, setKind] = useState<MetahubMenuItemKind>(item?.kind ?? 'link')
    const [titleVlc, setTitleVlc] = useState<VersionedLocalizedContent<string> | null>(
        () => ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), '')
    )
    const [icon, setIcon] = useState(item?.icon ?? '')
    const [href, setHref] = useState(item?.href ?? '')
    const [catalogId, setCatalogId] = useState(item?.catalogId ?? '')
    const [hubId, setHubId] = useState(item?.hubId ?? '')
    const [isActive, setIsActive] = useState(item?.isActive ?? true)

    // BUG-1 fix: Reset local state when the edited item changes
    const prevItemRef = useRef(item)
    useEffect(() => {
        if (prevItemRef.current === item) return
        prevItemRef.current = item
        setSubmitError(null)
        setKind(item?.kind ?? 'link')
        setTitleVlc(ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), ''))
        setIcon(item?.icon ?? '')
        setHref(item?.href ?? '')
        setCatalogId(item?.catalogId ?? '')
        setHubId(item?.hubId ?? '')
        setIsActive(item?.isActive ?? true)
    }, [item, uiLocale])

    const catalogsQuery = useQuery({
        queryKey: metahubsQueryKeys.allCatalogsList(metahubId),
        enabled: open,
        queryFn: () => catalogsApi.listAllCatalogs(metahubId, { limit: 200 })
    })
    const hubsQuery = useQuery({
        queryKey: metahubsQueryKeys.hubsList(metahubId, { limit: 200, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' }),
        enabled: open,
        queryFn: () => hubsApi.listHubs(metahubId, { limit: 200, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' })
    })

    const hasTitleContent = useMemo(() => {
        if (!titleVlc?.locales || typeof titleVlc.locales !== 'object') return false
        return Object.values(titleVlc.locales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    }, [titleVlc])

    const handleSave = () => {
        if (!hasTitleContent) {
            setSubmitError(t('layouts.menuEditor.validation.titleRequired', 'Name is required.'))
            return
        }

        if (kind === 'catalog' && !catalogId) {
            setSubmitError(t('layouts.menuEditor.validation.catalogRequired', 'Select a catalog for this menu item.'))
            return
        }

        if (kind === 'hub' && !hubId) {
            setSubmitError(t('layouts.menuEditor.validation.hubRequired', 'Select a hub for this menu item.'))
            return
        }

        if (kind === 'link' && href.trim().length === 0) {
            setSubmitError(t('layouts.menuEditor.validation.hrefRequired', 'Link URL is required for link items.'))
            return
        }

        setSubmitError(null)
        onSave({
            id: item?.id ?? generateUuidV7(),
            kind,
            title: titleVlc ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
            icon: icon.trim() || null,
            href: kind === 'link' ? href.trim() || null : null,
            catalogId: kind === 'catalog' ? catalogId || null : null,
            hubId: kind === 'hub' ? hubId || null : null,
            sortOrder: item?.sortOrder ?? 0,
            isActive
        })
    }

    const catalogs = catalogsQuery.data?.items ?? []
    const hubs = hubsQuery.data?.items ?? []

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
                                setKind(e.target.value as MetahubMenuItemKind)
                            }}
                        >
                            {METAHUB_MENU_ITEM_KINDS.map((k: MetahubMenuItemKind) => {
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

                    {kind === 'catalog' && (
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.menuEditor.itemCatalog')}</InputLabel>
                            <Select
                                value={catalogId}
                                label={t('layouts.menuEditor.itemCatalog')}
                                onChange={(e) => {
                                    setSubmitError(null)
                                    setCatalogId(e.target.value)
                                }}
                            >
                                {catalogs.length === 0 ? (
                                    <MenuItem disabled>{t('layouts.menuEditor.noCatalogs')}</MenuItem>
                                ) : (
                                    catalogs.map((cat) => {
                                        const name = getVLCString(cat.name, uiLocale) || getVLCString(cat.name, 'en') || cat.codename
                                        return (
                                            <MenuItem key={cat.id} value={cat.id}>
                                                {name}
                                            </MenuItem>
                                        )
                                    })
                                )}
                            </Select>
                        </FormControl>
                    )}
                    {kind === 'hub' && (
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.menuEditor.itemHub')}</InputLabel>
                            <Select
                                value={hubId}
                                label={t('layouts.menuEditor.itemHub')}
                                onChange={(e) => {
                                    setSubmitError(null)
                                    setHubId(e.target.value)
                                }}
                            >
                                {hubs.length === 0 ? (
                                    <MenuItem disabled>{t('layouts.menuEditor.noHubs')}</MenuItem>
                                ) : (
                                    hubs.map((hub) => {
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

export default function MenuWidgetEditorDialog({ open, metahubId, config, onSave, onCancel }: MenuWidgetEditorDialogProps) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const uiLocale = normalizeLocale(i18n.language)
    const isEdit = Boolean(config)
    const dialogTitle = isEdit ? t('layouts.menuEditor.editTitle') : t('layouts.menuEditor.createTitle')

    const defaultTitle = useMemo(
        () => buildVLC(t('layouts.menuEditor.defaultTitle', 'Main'), t('layouts.menuEditor.defaultTitleRu', 'Главное')),
        [t]
    )

    const [draft, setDraft] = useState<MenuWidgetConfig>(() => {
        return normalizeMenuConfig(config, uiLocale, defaultTitle)
    })
    const [itemDialog, setItemDialog] = useState<{ open: boolean; item: MenuWidgetConfigItem | null }>({ open: false, item: null })
    const [dialogError, setDialogError] = useState<string | null>(null)

    const hubsQuery = useQuery<PaginatedResponse<Hub>>({
        queryKey: metahubsQueryKeys.hubsList(metahubId, { limit: 1000, offset: 0, sortBy: 'sortOrder', sortOrder: 'asc' }),
        enabled: open && Boolean(metahubId),
        queryFn: () =>
            fetchAllPaginatedItems((params) => hubsApi.listHubs(metahubId, params), {
                limit: 1000,
                sortBy: 'sortOrder',
                sortOrder: 'asc'
            })
    })

    const availableHubs = useMemo(() => hubsQuery.data?.items ?? [], [hubsQuery.data?.items])

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
        if (draft.bindToHub && !draft.boundHubId) {
            setDialogError(t('layouts.menuEditor.validation.boundHubRequired', 'Select a hub to bind this menu to.'))
            return
        }
        setDialogError(null)
        onSave({
            ...draft,
            autoShowAllCatalogs: draft.bindToHub ? false : Boolean(draft.autoShowAllCatalogs),
            items: draft.items.filter((item) => item.kind !== 'catalogs_all')
        })
    }

    const kindLabels: Record<MetahubMenuItemKind, string> = {
        catalog: t('layouts.menuEditor.kindCatalog'),
        catalogs_all: t('layouts.menuEditor.kindCatalogsAll'),
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
                                                        autoShowAllCatalogs: checked ? false : p.autoShowAllCatalogs,
                                                        boundHubId: checked ? p.boundHubId ?? null : null
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
                                                    value={draft.boundHubId ?? ''}
                                                    label={t('layouts.menuEditor.boundHubLabel')}
                                                    onChange={(event) => {
                                                        setDialogError(null)
                                                        setDraft((p) => ({
                                                            ...p,
                                                            boundHubId: typeof event.target.value === 'string' ? event.target.value : null
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
                                            {draft.boundHubId && (
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
                                                checked={draft.autoShowAllCatalogs}
                                                onChange={(_, checked) => {
                                                    setDialogError(null)
                                                    setDraft((p) => ({ ...p, autoShowAllCatalogs: checked }))
                                                }}
                                                disabled={Boolean(draft.bindToHub)}
                                            />
                                        }
                                        label={t('layouts.menuEditor.autoShowAllCatalogs')}
                                    />
                                    <FormHelperText sx={{ mt: -0.5, ml: 7 }}>
                                        {draft.bindToHub
                                            ? t('layouts.menuEditor.autoShowAllCatalogsDisabledByBinding')
                                            : t('layouts.menuEditor.autoShowAllCatalogsHint')}
                                    </FormHelperText>
                                </Box>
                            </Stack>
                        </Stack>

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
