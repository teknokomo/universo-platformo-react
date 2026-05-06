import React, { useState, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'
import { Menu, MenuItem, Divider, IconButton } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'

/**
 * Props passed to the custom trigger renderer function
 */
export interface TriggerProps {
    onClick: (e: React.MouseEvent<HTMLElement>) => void
    'aria-haspopup': 'true'
    disabled: boolean
}

/**
 * Confirmation specification returned by action's confirm function
 */
export interface ConfirmSpec {
    titleKey: string
    descriptionKey?: string
    confirmKey?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
}

export type TranslationFunction = (key: string, params?: Record<string, unknown> | string) => string
export type SnackbarOptions = { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
export type SnackbarNotifier =
    | ((payload: { message: string; options?: SnackbarOptions }) => void)
    | ((message: string, options?: SnackbarOptions) => void)

/**
 * Dialog configuration for an action
 * Generic types allow type-safe context handling
 */
export interface DialogConfig<TEntity = unknown, TData = unknown> {
    loader: () => Promise<{ default: React.ElementType }>
    buildProps: (ctx: ActionContext<TEntity, TData>) => Record<string, unknown>
}

/**
 * Action descriptor defining a single menu action
 * Generic types ensure type safety across the action pipeline
 */
export interface ActionDescriptor<TEntity = unknown, TData = unknown> {
    id: string
    labelKey: string
    icon?: React.ReactNode | (() => React.ReactNode)
    tone?: 'default' | 'danger'
    order?: number
    group?: string
    dividerBefore?: boolean
    dividerAfter?: boolean
    entityKinds?: string[]
    visible?: (ctx: ActionContext<TEntity, TData>) => boolean
    enabled?: (ctx: ActionContext<TEntity, TData>) => boolean
    confirm?: (ctx: ActionContext<TEntity, TData>) => ConfirmSpec | null | undefined
    dialog?: DialogConfig<TEntity, TData>
    onSelect?: (ctx: ActionContext<TEntity, TData>) => void | Promise<void>
}

/**
 * Context object passed to action handlers
 * Generic type TEntity allows for type-safe entity access
 * Generic type TData allows for type-safe update data
 */
export interface ActionContext<TEntity = unknown, TData = unknown> {
    entity: TEntity
    entityKind: string
    t: TranslationFunction
    api?: {
        updateEntity?: (id: string, data: TData) => Promise<void>
        deleteEntity?: (id: string) => Promise<void>
    }
    helpers?: {
        enqueueSnackbar?: SnackbarNotifier
        confirm?: (config: {
            title: string
            description?: string
            confirmButtonName?: string
            cancelButtonName?: string
        }) => Promise<boolean>
        refreshList?: () => Promise<void>
        openDeleteDialog?: (entity: TEntity) => void
        openEditDialog?: (entity: TEntity) => void | Promise<void>
        openCopyDialog?: (entity: TEntity) => void | Promise<void>
        closeSnackbar?: (key: unknown) => void
        openWindow?: (url: string) => void
    }
    meta?: Record<string, unknown>
    runtime?: Record<string, unknown>
    [key: string]: unknown
}

/**
 * Props for BaseEntityMenu component
 * Generic types provide type safety for entity and data operations
 */
export interface BaseEntityMenuProps<TEntity = unknown, TData = unknown> {
    /** Entity object being acted upon */
    entity: TEntity
    /** Entity type identifier (e.g., 'metaverse', 'cluster', 'unik') */
    entityKind: string
    /** Array of action descriptors defining menu items */
    descriptors: ActionDescriptor<TEntity, TData>[]
    /** i18n namespace for translations (default: 'flowList') */
    namespace?: string
    /** Translation key for menu button label (default: 'menu.button') */
    menuButtonLabelKey?: string
    /** Custom trigger renderer function (optional, uses Button by default) */
    renderTrigger?: (props: TriggerProps) => React.ReactElement
    /** Optional i18n instance to use for translations (helps when multiple providers exist) */
    i18nInstance?: I18nInstance
    /** Factory function to create action context */
    createContext: (base: Partial<ActionContext<TEntity, TData>>) => ActionContext<TEntity, TData>
    /** Additional context properties to merge */
    contextExtras?: Record<string, unknown>
}

/**
 * Dialog state for lazy-loaded dialogs
 */
interface DialogState {
    id: string
    Comp: React.ElementType
    props: Record<string, unknown>
}

/**
 * BaseEntityMenu - Reusable entity action menu with render prop pattern
 *
 * Provides a flexible menu component for entity actions with support for:
 * - Custom trigger elements via renderTrigger prop
 * - Lazy-loaded dialogs
 * - Confirmation prompts
 * - Action grouping with dividers
 * - Conditional visibility and enablement
 *
 * @example
 * ```tsx
 * <BaseEntityMenu
 *   entity={metaverse}
 *   entityKind="metaverse"
 *   descriptors={metaverseActions}
 *   namespace="metaverses"
 *   createContext={createMetaverseContext}
 *   renderTrigger={(props) => (
 *     <IconButton {...props}>
 *       <MoreVertIcon />
 *     </IconButton>
 *   )}
 * />
 * ```
 */
export const BaseEntityMenu = <TEntity = unknown, TData = unknown>({
    entity,
    entityKind,
    descriptors,
    namespace = 'flowList',
    menuButtonLabelKey = 'menu.button',
    renderTrigger,
    i18nInstance,
    createContext,
    contextExtras
}: BaseEntityMenuProps<TEntity, TData>) => {
    const { t } = useTranslation(namespace, i18nInstance ? { i18n: i18nInstance } : undefined)
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [dialogState, setDialogState] = useState<DialogState | null>(null)
    const [busyActionId, setBusyActionId] = useState<string | null>(null)

    const open = Boolean(anchorEl)
    const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setAnchorEl(e.currentTarget)
    }
    const handleClose = () => setAnchorEl(null)

    const ctx = createContext({
        entity,
        entityKind,
        t: t as TranslationFunction,
        ...contextExtras
    })

    const visible = descriptors
        .filter((d) => !d.entityKinds || d.entityKinds.includes(entityKind))
        .filter((d) => !d.visible || d.visible(ctx))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const groups: Record<string, ActionDescriptor<TEntity, TData>[]> = {}
    visible.forEach((d) => {
        const g = d.group || '_default'
        if (!groups[g]) groups[g] = []
        groups[g].push(d)
    })

    const doAction = async (event: React.MouseEvent<HTMLElement>, d: ActionDescriptor<TEntity, TData>) => {
        event.preventDefault()
        event.stopPropagation()
        if (busyActionId) return
        event.currentTarget.blur()
        if (document.activeElement instanceof HTMLElement && document.activeElement !== event.currentTarget) {
            document.activeElement.blur()
        }
        handleClose()
        try {
            setBusyActionId(d.id)
            if (d.confirm) {
                const spec = d.confirm(ctx)
                if (spec && ctx.helpers?.confirm) {
                    const confirmed = await ctx.helpers.confirm({
                        title: t(spec.titleKey, spec.interpolate),
                        description: spec.descriptionKey ? t(spec.descriptionKey, spec.interpolate) : undefined,
                        confirmButtonName: t(spec.confirmKey || 'confirm.delete.confirm'),
                        cancelButtonName: t(spec.cancelKey || 'confirm.delete.cancel')
                    })
                    if (!confirmed) return
                }
            }
            if (d.dialog) {
                const module = await d.dialog.loader()
                const Comp = module.default
                const props = d.dialog.buildProps(ctx)
                setDialogState({ id: d.id, Comp, props })
                return
            }
            if (d.onSelect) await d.onSelect(ctx)
        } catch (e) {
            console.error('Action execution failed', d.id, e)
            if (ctx.helpers?.enqueueSnackbar) {
                const enqueue = ctx.helpers.enqueueSnackbar
                const candidateMessage =
                    e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string'
                        ? (e as { message: string }).message
                        : typeof e === 'string'
                        ? e
                        : 'Action failed'
                const message = candidateMessage && candidateMessage.length > 0 ? candidateMessage : 'Action failed'
                if (typeof enqueue === 'function') {
                    if (enqueue.length >= 2) {
                        ;(enqueue as (message: string, options?: { variant?: string }) => void)(message, {
                            variant: 'error'
                        })
                    } else {
                        ;(enqueue as (payload: { message: string; options?: { variant?: string } }) => void)({
                            message,
                            options: { variant: 'error' }
                        })
                    }
                }
            }
        } finally {
            setBusyActionId(null)
        }
    }

    // Default trigger: compact icon button with three dots
    const defaultTrigger = ({ onClick, disabled }: TriggerProps) => (
        <IconButton
            size='small'
            aria-label={t(menuButtonLabelKey)}
            aria-haspopup='true'
            disabled={disabled}
            sx={{
                width: 28,
                height: 28,
                p: 0.5
            }}
            onClick={(event) => {
                event.stopPropagation()
                onClick(event)
            }}
        >
            <MoreVertRoundedIcon fontSize='small' />
        </IconButton>
    )

    // Use custom trigger if provided, otherwise use default
    const trigger = renderTrigger || defaultTrigger
    const entityId =
        entity && typeof entity === 'object' && 'id' in entity && typeof entity.id === 'string' && entity.id.length > 0
            ? entity.id
            : 'unknown'

    return (
        <>
            {React.cloneElement(
                trigger({
                    onClick: handleOpen,
                    'aria-haspopup': 'true',
                    disabled: busyActionId !== null
                }),
                {
                    'data-testid': `entity-menu-trigger-${entityKind}-${entityId}`
                }
            )}
            <Menu
                open={open}
                onClose={handleClose}
                anchorEl={anchorEl}
                disableAutoFocusItem
                MenuListProps={{
                    autoFocusItem: false,
                    onClick: (event) => {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                }}
            >
                {Object.entries(groups).map(([group, acts], gi, arr) => (
                    <React.Fragment key={group}>
                        {acts.map((a) => {
                            const disabled = busyActionId === a.id || (a.enabled ? !a.enabled(ctx) : false)
                            const IconNode = typeof a.icon === 'function' ? a.icon() : a.icon
                            const isDanger = a.tone === 'danger'
                            return (
                                <React.Fragment key={a.id}>
                                    {a.dividerBefore && <Divider />}
                                    <MenuItem
                                        disabled={disabled}
                                        onClick={(event) => void doAction(event, a)}
                                        data-testid={`entity-menu-item-${entityKind}-${a.id}-${entityId}`}
                                        sx={
                                            isDanger
                                                ? {
                                                      color: 'error.main',
                                                      '& .base-entity-menu-icon': { color: 'error.main' }
                                                  }
                                                : undefined
                                        }
                                    >
                                        {IconNode && (
                                            <span
                                                className='base-entity-menu-icon'
                                                style={{
                                                    display: 'inline-flex',
                                                    width: 24,
                                                    minWidth: 24,
                                                    marginRight: 10,
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {IconNode}
                                            </span>
                                        )}
                                        {t(a.labelKey)}
                                    </MenuItem>
                                    {a.dividerAfter && <Divider />}
                                </React.Fragment>
                            )
                        })}
                        {gi < arr.length - 1 && <Divider />}
                    </React.Fragment>
                ))}
            </Menu>
            {dialogState &&
                (() => {
                    const dialogOnSubmit = dialogState.props.onSubmit
                    return (
                        <Suspense fallback={null}>
                            <dialogState.Comp
                                {...dialogState.props}
                                onCancel={() => setDialogState(null)}
                                onClose={() => setDialogState(null)}
                                onSubmit={
                                    typeof dialogOnSubmit === 'function'
                                        ? async (...args: unknown[]) => {
                                              try {
                                                  await dialogOnSubmit(...args)
                                                  setDialogState(null)
                                              } catch {
                                                  // Dialog stays open; the original onSubmit handler manages its own error state
                                              }
                                          }
                                        : undefined
                                }
                            />
                        </Suspense>
                    )
                })()}
        </>
    )
}
