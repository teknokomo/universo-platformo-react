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
    interpolate?: Record<string, any>
}

/**
 * Dialog configuration for an action
 * Generic types allow type-safe context handling
 */
export interface DialogConfig<TEntity = any, TData = any> {
    loader: () => Promise<{ default: React.ComponentType<any> }>
    buildProps: (ctx: ActionContext<TEntity, TData>) => Record<string, any>
}

/**
 * Action descriptor defining a single menu action
 * Generic types ensure type safety across the action pipeline
 */
export interface ActionDescriptor<TEntity = any, TData = any> {
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
export interface ActionContext<TEntity = any, TData = any> {
    entity: TEntity
    entityKind: string
    t: (key: string, params?: any) => string
    api?: {
        updateEntity?: (id: string, data: TData) => Promise<void>
        deleteEntity?: (id: string) => Promise<void>
    }
    helpers?: {
        enqueueSnackbar?:
            | ((payload: { message: string; options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' } }) => void)
            | ((message: string, options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }) => void)
        confirm?: (config: {
            title: string
            description?: string
            confirmButtonName?: string
            cancelButtonName?: string
        }) => Promise<boolean>
        refreshList?: () => Promise<void>
        openDeleteDialog?: (entity: TEntity) => void
        closeSnackbar?: (key: any) => void
        openWindow?: (url: string) => void
    }
    meta?: Record<string, any>
    runtime?: Record<string, any>
    [key: string]: any
}

/**
 * Props for BaseEntityMenu component
 * Generic types provide type safety for entity and data operations
 */
export interface BaseEntityMenuProps<TEntity = any, TData = any> {
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
    contextExtras?: Record<string, any>
}

/**
 * Dialog state for lazy-loaded dialogs
 */
interface DialogState {
    id: string
    Comp: React.ComponentType<any>
    props: Record<string, any>
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
export const BaseEntityMenu = <TEntity = any, TData = any>({
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
    const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
    const handleClose = () => setAnchorEl(null)

    const ctx = createContext({
        entity,
        entityKind,
        t,
        ...contextExtras
    })

    const visible = descriptors
        .filter((d) => !d.entityKinds || d.entityKinds.includes(entityKind))
        .filter((d) => !d.visible || d.visible(ctx))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const groups: Record<string, ActionDescriptor[]> = {}
    visible.forEach((d) => {
        const g = d.group || '_default'
        if (!groups[g]) groups[g] = []
        groups[g].push(d)
    })

    const doAction = async (d: ActionDescriptor) => {
        if (busyActionId) return
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
                    e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string'
                        ? (e as any).message
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

    return (
        <>
            {trigger({
                onClick: handleOpen,
                'aria-haspopup': 'true',
                disabled: busyActionId !== null
            })}
            <Menu open={open} onClose={handleClose} anchorEl={anchorEl} disableAutoFocusItem MenuListProps={{ autoFocusItem: false }}>
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
                                        onClick={() => doAction(a)}
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
                                                style={{ display: 'inline-flex', marginRight: 10, alignItems: 'center' }}
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
            {dialogState && (
                <Suspense fallback={null}>
                    <dialogState.Comp {...dialogState.props} onCancel={() => setDialogState(null)} onClose={() => setDialogState(null)} />
                </Suspense>
            )}
        </>
    )
}
