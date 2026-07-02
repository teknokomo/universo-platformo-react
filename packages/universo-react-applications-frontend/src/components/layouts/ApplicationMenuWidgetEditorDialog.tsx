import { useEffect, useId, useMemo, useState } from 'react'
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
import {
    defaultDashboardSideMenuConfig,
    type DashboardSideMenuMode,
    type MenuWidgetConfig,
    type MenuWidgetConfigItem,
    type MetahubMenuItemKind,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { EntityFormDialog, LocalizedInlineField, MenuWidgetSideMenuSettings, normalizeSideMenuConfig } from '@universo-react/template-mui'
import { buildVLC, createLocalizedContent, ensureVLC, generateUuidV7, isSafeMenuHref } from '@universo-react/utils'
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
    sectionOptions: OptionItem[]
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
    sectionId: string
    isActive: boolean
}

type WorkspacePlacement = NonNullable<MenuWidgetConfig['workspacePlacement']>

const WORKSPACE_PLACEMENTS: WorkspacePlacement[] = ['primary', 'overflow', 'hidden']
const EDITABLE_MENU_ITEM_KINDS: MetahubMenuItemKind[] = ['section', 'link']

const isEditableMenuItemKind = (kind: MetahubMenuItemKind | string | null | undefined): kind is 'section' | 'link' =>
    kind === 'section' || kind === 'link'

const normalizeMaxPrimaryItems = (value: unknown): number | undefined => {
    if (value == null || value === '') return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return undefined
    return Math.max(1, Math.min(12, Math.trunc(parsed)))
}

const normalizeWorkspacePlacement = (value: unknown): WorkspacePlacement => {
    return WORKSPACE_PLACEMENTS.includes(value as WorkspacePlacement) ? (value as WorkspacePlacement) : 'primary'
}

const normalizeConfiguredStartPage = (startPage: string | null | undefined): string | null =>
    typeof startPage === 'string' && startPage.trim() ? startPage.trim() : null

const normalizeEditableMenuItemKind = (kind: MetahubMenuItemKind | string | null | undefined): MetahubMenuItemKind => {
    if (kind === 'section' || kind === 'link' || kind === 'hub') return kind
    return 'link'
}

const resolveMenuItemSectionTarget = (item?: MenuWidgetConfigItem | null): string => {
    return item?.sectionId ?? item?.objectCollectionId ?? ''
}

const makeDefaultConfig = (_uiLocale: string): MenuWidgetConfig => ({
    showTitle: true,
    title: buildVLC('', ''),
    autoShowAllSections: false,
    bindToHub: false,
    boundHubId: null,
    maxPrimaryItems: 6,
    overflowLabelKey: 'runtime.menu.more',
    startPage: null,
    workspacePlacement: 'primary',
    sideMenu: { ...defaultDashboardSideMenuConfig },
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
        startPage: normalizeConfiguredStartPage(config.startPage),
        workspacePlacement: normalizeWorkspacePlacement(config.workspacePlacement),
        sideMenu: normalizeSideMenuConfig(config.sideMenu),
        items: Array.isArray(config.items) ? config.items : []
    }
}

const createItemDraft = (uiLocale: string, item?: MenuWidgetConfigItem | null): ItemDraft => ({
    id: item?.id ?? generateUuidV7(),
    kind: normalizeEditableMenuItemKind(item?.kind),
    title: ensureVLC(item?.title, uiLocale) ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
    icon: item?.icon ?? '',
    href: item?.href ?? '',
    sectionId: resolveMenuItemSectionTarget(item),
    isActive: item?.isActive ?? true
})

export default function ApplicationMenuWidgetEditorDialog({
    open,
    config,
    sectionOptions,
    showSharedBehavior = false,
    onSave,
    onCancel
}: Props) {
    const { t, i18n } = useTranslation(['applications', 'common'])
    const uiLocale = normalizeLocale(i18n.language)
    const workspacePlacementLabelId = useId()
    const startPageLabelId = useId()
    const itemKindLabelId = useId()
    const itemSectionLabelId = useId()
    const [draft, setDraft] = useState<MenuWidgetConfig>(() => normalizeMenuConfig(config, uiLocale))
    const [itemEditorOpen, setItemEditorOpen] = useState(false)
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
    const [itemDraft, setItemDraft] = useState<ItemDraft>(() => createItemDraft(uiLocale))
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [sharedBehaviorValue, setSharedBehaviorValue] = useState(() => getSharedBehaviorFromWidgetConfig(config))
    const sideMenuLabels = useMemo(
        () => ({
            title: t('layouts.menuEditor.sideMenu.title', 'Side menu display'),
            primaryMode: t('layouts.menuEditor.sideMenu.primaryMode', 'Primary display mode'),
            rememberUserChoice: t('layouts.menuEditor.sideMenu.rememberUserChoice', 'Remember user choice'),
            modes: {
                wide: t('layouts.menuEditor.sideMenu.modes.wide', 'Wide'),
                compact: t('layouts.menuEditor.sideMenu.modes.compact', 'Compact icons'),
                overlay: t('layouts.menuEditor.sideMenu.modes.overlay', 'Overlay drawer')
            } satisfies Record<DashboardSideMenuMode, string>
        }),
        [t]
    )

    useEffect(() => {
        if (!open) return
        setDraft(normalizeMenuConfig(config, uiLocale))
        setItemEditorOpen(false)
        setEditingItemIndex(null)
        setItemDraft(createItemDraft(uiLocale))
        setSubmitError(null)
        setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(config))
    }, [config, open, uiLocale])

    const kindOptions = useMemo(
        () =>
            EDITABLE_MENU_ITEM_KINDS.includes(itemDraft.kind) ? EDITABLE_MENU_ITEM_KINDS : [itemDraft.kind, ...EDITABLE_MENU_ITEM_KINDS],
        [itemDraft.kind]
    )
    const startPageOptions = useMemo(() => {
        const normalizedStartPage = normalizeConfiguredStartPage(draft.startPage)
        const selectableOptions = sectionOptions
        if (!normalizedStartPage || selectableOptions.some((option) => option.id === normalizedStartPage)) return selectableOptions
        return [
            {
                id: normalizedStartPage,
                label: t('layouts.menuEditor.unavailableStartPage', 'Unavailable section'),
                disabled: true
            },
            ...selectableOptions
        ]
    }, [draft.startPage, sectionOptions, t])

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
        if (itemDraft.kind !== 'hub' && !isEditableMenuItemKind(itemDraft.kind)) {
            setSubmitError(t('layouts.menuEditor.validation.unsupportedKind', 'This menu item type is read-only.'))
            return
        }
        if (itemDraft.kind === 'section' && !itemDraft.sectionId.trim()) {
            setSubmitError(t('layouts.menuEditor.validation.sectionRequired', 'Select an entity section for this menu item.'))
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

        const currentItem = editingItemIndex == null ? null : draft.items[editingItemIndex] ?? null
        const nextItem: MenuWidgetConfigItem = {
            ...(currentItem?.kind === 'hub' && itemDraft.kind === 'hub' ? currentItem : {}),
            id: itemDraft.id,
            kind: itemDraft.kind,
            title: itemDraft.title ?? createLocalizedContent(normalizeLocale(uiLocale), ''),
            icon: itemDraft.icon.trim() || null,
            href: itemDraft.kind === 'link' ? itemDraft.href.trim() || null : null,
            hubId: itemDraft.kind === 'hub' ? currentItem?.hubId ?? null : null,
            treeEntityId: itemDraft.kind === 'hub' ? currentItem?.treeEntityId ?? null : null,
            objectCollectionId: itemDraft.kind === 'section' ? itemDraft.sectionId.trim() || null : null,
            sectionId: itemDraft.kind === 'section' ? itemDraft.sectionId.trim() || null : null,
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

    const buildSaveConfig = (): MenuWidgetConfig => {
        const startPage = normalizeConfiguredStartPage(draft.startPage)
        const initialStartPage = normalizeConfiguredStartPage(config?.startPage)
        const startTarget = startPage === initialStartPage ? draft.startTarget ?? null : null

        return setSharedBehaviorInWidgetConfig(
            {
                ...draft,
                maxPrimaryItems: normalizeMaxPrimaryItems(draft.maxPrimaryItems),
                overflowLabelKey:
                    typeof draft.overflowLabelKey === 'string' && draft.overflowLabelKey.trim() ? draft.overflowLabelKey.trim() : null,
                startPage,
                startTarget,
                workspacePlacement: normalizeWorkspacePlacement(draft.workspacePlacement),
                sideMenu: normalizeSideMenuConfig(draft.sideMenu)
            },
            sharedBehaviorValue
        ) as unknown as MenuWidgetConfig
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
                onSave={() => onSave(buildSaveConfig())}
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
                                    checked={draft.autoShowAllSections}
                                    onChange={(_, checked) => setDraft((current) => ({ ...current, autoShowAllSections: checked }))}
                                />
                            }
                            label={t('layouts.menuEditor.autoShowAllSections', 'Show all sections automatically')}
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
                        <FormControl fullWidth>
                            <InputLabel id={startPageLabelId}>{t('layouts.menuEditor.startPage', 'Start page')}</InputLabel>
                            <Select
                                labelId={startPageLabelId}
                                value={draft.startPage ?? ''}
                                label={t('layouts.menuEditor.startPage', 'Start page')}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        startPage: typeof event.target.value === 'string' && event.target.value ? event.target.value : null,
                                        startTarget: null
                                    }))
                                }
                            >
                                <MenuItem value=''>{t('layouts.menuEditor.startPageDefault', 'Layout default')}</MenuItem>
                                {startPageOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id} disabled={'disabled' in option && option.disabled}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>
                                {t('layouts.menuEditor.startPageHint', 'Choose the section that opens first in the published application.')}
                            </FormHelperText>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id={workspacePlacementLabelId}>
                                {t('layouts.menuEditor.workspacePlacement', 'Workspace menu placement')}
                            </InputLabel>
                            <Select
                                labelId={workspacePlacementLabelId}
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
                        <MenuWidgetSideMenuSettings
                            sideMenu={draft.sideMenu}
                            labels={sideMenuLabels}
                            onChange={(sideMenu) => setDraft((current) => ({ ...current, sideMenu }))}
                        />
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
                                        <IconButton
                                            size='small'
                                            onClick={() => openItemEditor(index)}
                                            aria-label={t('layouts.menuEditor.editItemNamed', 'Edit menu item: {{label}}', {
                                                label:
                                                    getVLCString(item.title, uiLocale) ||
                                                    getVLCString(item.title, 'en') ||
                                                    t('layouts.menuEditor.untitledItem', 'Untitled item')
                                            })}
                                            title={t('layouts.menuEditor.editItemNamed', 'Edit menu item: {{label}}', {
                                                label:
                                                    getVLCString(item.title, uiLocale) ||
                                                    getVLCString(item.title, 'en') ||
                                                    t('layouts.menuEditor.untitledItem', 'Untitled item')
                                            })}
                                        >
                                            <EditRoundedIcon fontSize='small' />
                                        </IconButton>
                                        <IconButton
                                            size='small'
                                            aria-label={t('layouts.menuEditor.removeItemNamed', 'Remove menu item: {{label}}', {
                                                label:
                                                    getVLCString(item.title, uiLocale) ||
                                                    getVLCString(item.title, 'en') ||
                                                    t('layouts.menuEditor.untitledItem', 'Untitled item')
                                            })}
                                            title={t('layouts.menuEditor.removeItemNamed', 'Remove menu item: {{label}}', {
                                                label:
                                                    getVLCString(item.title, uiLocale) ||
                                                    getVLCString(item.title, 'en') ||
                                                    t('layouts.menuEditor.untitledItem', 'Untitled item')
                                            })}
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
                                onChange={(nextValue) => setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(nextValue))}
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
                            <InputLabel id={itemKindLabelId}>{t('layouts.menuEditor.kind', 'Type')}</InputLabel>
                            <Select
                                labelId={itemKindLabelId}
                                value={itemDraft.kind}
                                label={t('layouts.menuEditor.kind', 'Type')}
                                onChange={(event) =>
                                    setItemDraft((current) => ({
                                        ...current,
                                        kind: isEditableMenuItemKind(event.target.value as MetahubMenuItemKind)
                                            ? normalizeEditableMenuItemKind(event.target.value as MetahubMenuItemKind)
                                            : current.kind
                                    }))
                                }
                            >
                                {kindOptions.map((kind) => (
                                    <MenuItem key={kind} value={kind} disabled={!isEditableMenuItemKind(kind)}>
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
                        {itemDraft.kind === 'section' ? (
                            <FormControl fullWidth>
                                <InputLabel id={itemSectionLabelId}>{t('layouts.menuEditor.section', 'Entity section')}</InputLabel>
                                <Select
                                    labelId={itemSectionLabelId}
                                    value={itemDraft.sectionId}
                                    label={t('layouts.menuEditor.section', 'Entity section')}
                                    onChange={(event) => setItemDraft((current) => ({ ...current, sectionId: String(event.target.value) }))}
                                >
                                    {sectionOptions.map((option) => (
                                        <MenuItem key={option.id} value={option.id}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
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
