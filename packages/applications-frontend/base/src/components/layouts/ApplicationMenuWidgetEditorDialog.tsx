import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
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
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import type { MenuWidgetConfig, MenuWidgetConfigItem, MetahubMenuItemKind, VersionedLocalizedContent } from '@universo/types'
import { EntityFormDialog, LocalizedInlineField } from '@universo/template-mui'
import { METAHUB_MENU_ITEM_KINDS } from '@universo/types'
import { buildVLC, createLocalizedContent, ensureVLC, generateUuidV7, isSafeMenuHref } from '@universo/utils'
import { useTranslation } from 'react-i18next'

import ApplicationLayoutSharedBehaviorFields, {
    getSharedBehaviorFromWidgetConfig,
    setSharedBehaviorInWidgetConfig
} from './ApplicationLayoutSharedBehaviorFields'

type OptionItem = { id: string; label: string }

const normalizeLocale = (locale?: string | null): string => {
    if (!locale) return 'en'
    return String(locale).toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

const getVLCString = (value: VersionedLocalizedContent<string> | null | undefined, locale: string): string => {
    if (!value?.locales) return ''
    return value.locales[locale]?.content ?? value.locales[value._primary ?? 'en']?.content ?? ''
}

type Props = {
    open: boolean
    config: MenuWidgetConfig | null
    catalogOptions: OptionItem[]
    showSharedBehavior?: boolean
    onSave: (config: MenuWidgetConfig) => void
    onCancel: () => void
}

type ItemDraft = {
    id: string
    kind: MetahubMenuItemKind
    title: VersionedLocalizedContent<string> | null
    icon: string
    href: string
    catalogId: string
    hubId: string
    isActive: boolean
}

type WorkspacePlacement = NonNullable<MenuWidgetConfig['workspacePlacement']>

const WORKSPACE_PLACEMENTS: WorkspacePlacement[] = ['primary', 'overflow', 'hidden']

const normalizeMaxPrimaryItems = (value: unknown): number | null => {
    if (value == null || value === '') return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.max(1, Math.min(12, Math.trunc(parsed)))
}

const normalizeWorkspacePlacement = (value: unknown): WorkspacePlacement => {
    return WORKSPACE_PLACEMENTS.includes(value as WorkspacePlacement) ? (value as WorkspacePlacement) : 'primary'
}

const makeDefaultConfig = (_uiLocale: string): MenuWidgetConfig => ({
    showTitle: true,
    title: buildVLC('', ''),
    autoShowAllCatalogs: false,
    bindToHub: false,
    boundHubId: null,
    maxPrimaryItems: 6,
    overflowLabelKey: 'runtime.menu.more',
    startPage: null,
    workspacePlacement: 'primary',
    items: [],
    sharedBehavior: undefined
})

const normalizeMenuConfig = (config: MenuWidgetConfig | null | undefined, uiLocale: string): MenuWidgetConfig => {
    if (!config) return makeDefaultConfig(uiLocale)
    return {
        ...makeDefaultConfig(uiLocale),
        ...config,
        title: ensureVLC(config.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
        maxPrimaryItems: normalizeMaxPrimaryItems(config.maxPrimaryItems),
        overflowLabelKey:
            typeof config.overflowLabelKey === 'string' && config.overflowLabelKey.trim() ? config.overflowLabelKey.trim() : null,
        startPage: typeof config.startPage === 'string' && config.startPage.trim() ? config.startPage.trim() : null,
        workspacePlacement: normalizeWorkspacePlacement(config.workspacePlacement),
        items: Array.isArray(config.items) ? config.items.filter((item) => item.kind !== 'catalogs_all') : []
    }
}

const createItemDraft = (uiLocale: string, item?: MenuWidgetConfigItem | null): ItemDraft => ({
    id: item?.id ?? generateUuidV7(),
    kind: item?.kind ?? 'link',
    title: ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
    icon: item?.icon ?? '',
    href: item?.href ?? '',
    catalogId: item?.catalogId ?? '',
    hubId: item?.hubId ?? '',
    isActive: item?.isActive ?? true
})

export default function ApplicationMenuWidgetEditorDialog({
    open,
    config,
    catalogOptions,
    showSharedBehavior = false,
    onSave,
    onCancel
}: Props) {
    const { t, i18n } = useTranslation(['applications', 'common'])
    const uiLocale = normalizeLocale(i18n.language)
    const [draft, setDraft] = useState<MenuWidgetConfig>(() => normalizeMenuConfig(config, uiLocale))
    const [itemEditorOpen, setItemEditorOpen] = useState(false)
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
    const [itemDraft, setItemDraft] = useState<ItemDraft>(() => createItemDraft(uiLocale))
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [sharedBehaviorValue, setSharedBehaviorValue] = useState(() => getSharedBehaviorFromWidgetConfig(config))

    useEffect(() => {
        if (!open) return
        setDraft(normalizeMenuConfig(config, uiLocale))
        setItemEditorOpen(false)
        setEditingItemIndex(null)
        setItemDraft(createItemDraft(uiLocale))
        setSubmitError(null)
        setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(config))
    }, [config, open, uiLocale])

    const kindOptions = useMemo(() => METAHUB_MENU_ITEM_KINDS.filter((kind) => kind === 'link' || kind === 'catalog' || kind === 'hub'), [])

    const openItemEditor = (index: number | null) => {
        const sourceItem = index == null ? null : draft.items[index] ?? null
        setEditingItemIndex(index)
        setItemDraft(createItemDraft(uiLocale, sourceItem))
        setSubmitError(null)
        setItemEditorOpen(true)
    }

    const handleSaveItem = () => {
        const hasTitle =
            Boolean(itemDraft.title?.locales) &&
            Object.values(itemDraft.title?.locales ?? {}).some(
                (entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0
            )
        if (!hasTitle) {
            setSubmitError(t('layouts.menuEditor.validation.titleRequired', 'Name is required.'))
            return
        }
        if (itemDraft.kind === 'catalog' && !itemDraft.catalogId) {
            setSubmitError(t('layouts.menuEditor.validation.catalogRequired', 'Select a catalog for this menu item.'))
            return
        }
        if (itemDraft.kind === 'link') {
            const trimmedHref = itemDraft.href.trim()
            if (!trimmedHref) {
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

        const nextItem: MenuWidgetConfigItem = {
            id: itemDraft.id,
            kind: itemDraft.kind,
            title: itemDraft.title ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
            icon: itemDraft.icon.trim() || null,
            href: itemDraft.kind === 'link' ? itemDraft.href.trim() || null : null,
            catalogId: itemDraft.kind === 'catalog' ? itemDraft.catalogId || null : null,
            hubId: itemDraft.kind === 'hub' ? itemDraft.hubId.trim() || null : null,
            sortOrder: 0,
            isActive: itemDraft.isActive
        }

        setDraft((current) => {
            const items = [...current.items]
            if (editingItemIndex == null) {
                items.push(nextItem)
            } else {
                items[editingItemIndex] = nextItem
            }
            return {
                ...current,
                items: items.map((item, index) => ({ ...item, sortOrder: index }))
            }
        })
        setItemEditorOpen(false)
        setEditingItemIndex(null)
    }

    return (
        <>
            <EntityFormDialog
                open={open}
                title={t('layouts.menuEditor.title', 'Menu widget')}
                mode={config ? 'edit' : 'create'}
                nameLabel={t('common:fields.name', 'Name')}
                descriptionLabel={t('common:fields.description', 'Description')}
                hideDefaultFields
                onClose={onCancel}
                onSave={() =>
                    onSave(
                        setSharedBehaviorInWidgetConfig(
                            {
                                ...draft,
                                maxPrimaryItems: normalizeMaxPrimaryItems(draft.maxPrimaryItems),
                                overflowLabelKey:
                                    typeof draft.overflowLabelKey === 'string' && draft.overflowLabelKey.trim()
                                        ? draft.overflowLabelKey.trim()
                                        : null,
                                startPage: typeof draft.startPage === 'string' && draft.startPage.trim() ? draft.startPage.trim() : null,
                                workspacePlacement: normalizeWorkspacePlacement(draft.workspacePlacement)
                            },
                            sharedBehaviorValue
                        ) as unknown as MenuWidgetConfig
                    )
                }
                saveButtonText={t('common:save', 'Save')}
                cancelButtonText={t('common:cancel', 'Cancel')}
                extraFields={() => (
                    <Stack spacing={2.5}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={draft.showTitle}
                                    onChange={(_, checked) => setDraft((current) => ({ ...current, showTitle: checked }))}
                                />
                            }
                            label={t('layouts.menuEditor.showTitle', 'Show title')}
                        />
                        <LocalizedInlineField
                            mode='localized'
                            label={t('layouts.menuEditor.titleField', 'Title')}
                            value={draft.title ?? null}
                            onChange={(next) => setDraft((current) => ({ ...current, title: next ?? buildVLC('', '') }))}
                            uiLocale={uiLocale}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={draft.autoShowAllCatalogs}
                                    onChange={(_, checked) => setDraft((current) => ({ ...current, autoShowAllCatalogs: checked }))}
                                />
                            }
                            label={t('layouts.menuEditor.autoShowAllCatalogs', 'Show all catalogs automatically')}
                        />
                        <TextField
                            label={t('layouts.menuEditor.maxPrimaryItems', 'Primary menu item limit')}
                            type='number'
                            value={draft.maxPrimaryItems ?? ''}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, maxPrimaryItems: normalizeMaxPrimaryItems(event.target.value) }))
                            }
                            inputProps={{ min: 1, max: 12, step: 1 }}
                            fullWidth
                            helperText={t(
                                'layouts.menuEditor.maxPrimaryItemsHint',
                                'Extra active menu items are moved into the overflow menu.'
                            )}
                        />
                        <TextField
                            label={t('layouts.menuEditor.overflowLabelKey', 'Overflow label i18n key')}
                            value={draft.overflowLabelKey ?? ''}
                            onChange={(event) =>
                                setDraft((current) => ({ ...current, overflowLabelKey: event.target.value.trim() || null }))
                            }
                            fullWidth
                            placeholder='runtime.menu.more'
                        />
                        <TextField
                            label={t('layouts.menuEditor.startPage', 'Start page code')}
                            value={draft.startPage ?? ''}
                            onChange={(event) => setDraft((current) => ({ ...current, startPage: event.target.value.trim() || null }))}
                            fullWidth
                            helperText={t(
                                'layouts.menuEditor.startPageHint',
                                'Use a hub/catalog id or codename to choose the first opened section.'
                            )}
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.menuEditor.workspacePlacement', 'Workspace menu placement')}</InputLabel>
                            <Select
                                value={draft.workspacePlacement ?? 'primary'}
                                label={t('layouts.menuEditor.workspacePlacement', 'Workspace menu placement')}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
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
                            <FormHelperText>
                                {t(
                                    'layouts.menuEditor.workspacePlacementHint',
                                    'Workspace navigation can stay in the main menu, move to overflow, or be hidden.'
                                )}
                            </FormHelperText>
                        </FormControl>
                        <Stack spacing={1}>
                            <Typography variant='subtitle2'>{t('layouts.menuEditor.itemsTitle', 'Menu items')}</Typography>
                            {draft.items.map((item, index) => (
                                <Paper key={item.id} variant='outlined' sx={{ px: 1.5, py: 1, borderRadius: 1.5 }}>
                                    <Stack direction='row' spacing={1} alignItems='center'>
                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                            <Typography variant='body2' noWrap>
                                                {getVLCString(item.title, uiLocale) || getVLCString(item.title, 'en') || '—'}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {t(`layouts.menuEditor.kinds.${item.kind}`, item.kind)}
                                            </Typography>
                                        </Box>
                                        <IconButton size='small' onClick={() => openItemEditor(index)}>
                                            <EditRoundedIcon fontSize='small' />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            onClick={() =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    items: current.items
                                                        .filter((_, itemIndex) => itemIndex !== index)
                                                        .map((entry, itemIndex) => ({ ...entry, sortOrder: itemIndex }))
                                                }))
                                            }
                                        >
                                            <DeleteRoundedIcon fontSize='small' />
                                        </IconButton>
                                    </Stack>
                                </Paper>
                            ))}
                            <Button startIcon={<AddRoundedIcon />} onClick={() => openItemEditor(null)} sx={{ alignSelf: 'flex-start' }}>
                                {t('layouts.menuEditor.addItem', 'Add item')}
                            </Button>
                        </Stack>
                        {showSharedBehavior ? (
                            <ApplicationLayoutSharedBehaviorFields
                                value={setSharedBehaviorInWidgetConfig(draft, sharedBehaviorValue)}
                                onChange={setSharedBehaviorValue}
                            />
                        ) : null}
                    </Stack>
                )}
            />

            <EntityFormDialog
                open={itemEditorOpen}
                title={
                    editingItemIndex == null ? t('layouts.menuEditor.addItem', 'Add item') : t('layouts.menuEditor.editItem', 'Edit item')
                }
                mode={editingItemIndex == null ? 'create' : 'edit'}
                nameLabel={t('common:fields.name', 'Name')}
                descriptionLabel={t('common:fields.description', 'Description')}
                hideDefaultFields
                onClose={() => setItemEditorOpen(false)}
                onSave={handleSaveItem}
                saveButtonText={t('common:save', 'Save')}
                cancelButtonText={t('common:cancel', 'Cancel')}
                extraFields={() => (
                    <Stack spacing={2.5}>
                        {submitError ? <Alert severity='error'>{submitError}</Alert> : null}
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.menuEditor.kind', 'Type')}</InputLabel>
                            <Select
                                value={itemDraft.kind}
                                label={t('layouts.menuEditor.kind', 'Type')}
                                onChange={(event) =>
                                    setItemDraft((current) => ({
                                        ...current,
                                        kind: event.target.value as MetahubMenuItemKind
                                    }))
                                }
                            >
                                {kindOptions.map((kind) => (
                                    <MenuItem key={kind} value={kind}>
                                        {t(`layouts.menuEditor.kinds.${kind}`, kind)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <LocalizedInlineField
                            mode='localized'
                            label={t('layouts.menuEditor.itemTitle', 'Item title')}
                            required
                            value={itemDraft.title}
                            onChange={(next) => setItemDraft((current) => ({ ...current, title: next }))}
                            uiLocale={uiLocale}
                        />
                        <TextField
                            label={t('layouts.menuEditor.icon', 'Icon')}
                            value={itemDraft.icon}
                            onChange={(event) => setItemDraft((current) => ({ ...current, icon: event.target.value }))}
                            fullWidth
                        />
                        {itemDraft.kind === 'link' ? (
                            <TextField
                                label={t('layouts.menuEditor.href', 'Link URL')}
                                value={itemDraft.href}
                                onChange={(event) => setItemDraft((current) => ({ ...current, href: event.target.value }))}
                                fullWidth
                            />
                        ) : null}
                        {itemDraft.kind === 'catalog' ? (
                            <FormControl fullWidth>
                                <InputLabel>{t('layouts.menuEditor.catalog', 'Catalog')}</InputLabel>
                                <Select
                                    value={itemDraft.catalogId}
                                    label={t('layouts.menuEditor.catalog', 'Catalog')}
                                    onChange={(event) => setItemDraft((current) => ({ ...current, catalogId: String(event.target.value) }))}
                                >
                                    {catalogOptions.map((option) => (
                                        <MenuItem key={option.id} value={option.id}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        {itemDraft.kind === 'hub' ? (
                            <TextField
                                label={t('layouts.menuEditor.hubId', 'Hub id')}
                                value={itemDraft.hubId}
                                onChange={(event) => setItemDraft((current) => ({ ...current, hubId: event.target.value }))}
                                fullWidth
                            />
                        ) : null}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={itemDraft.isActive}
                                    onChange={(_, checked) => setItemDraft((current) => ({ ...current, isActive: checked }))}
                                />
                            }
                            label={t('layouts.menuEditor.isActive', 'Active')}
                        />
                    </Stack>
                )}
            />
        </>
    )
}
