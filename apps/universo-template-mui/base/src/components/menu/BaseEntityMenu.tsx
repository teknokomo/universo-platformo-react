import React, { useState, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'
import { Menu, MenuItem, Divider, Button } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

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
 */
export interface DialogConfig {
    loader: () => Promise<{ default: React.ComponentType<any> }>
    buildProps: (ctx: ActionContext) => Record<string, any>
}

/**
 * Action descriptor defining a single menu action
 */
export interface ActionDescriptor {
    id: string
    labelKey: string
    icon?: React.ReactNode | (() => React.ReactNode)
    order?: number
    group?: string
    entityKinds?: string[]
    visible?: (ctx: ActionContext) => boolean
    enabled?: (ctx: ActionContext) => boolean
    confirm?: (ctx: ActionContext) => ConfirmSpec | null | undefined
    dialog?: DialogConfig
    onSelect?: (ctx: ActionContext) => void | Promise<void>
}

/**
 * Context object passed to action handlers
 */
export interface ActionContext {
    entity: any
    entityKind: string
    t: (key: string, params?: any) => string
    api?: {
        updateEntity?: (id: string, data: any) => Promise<void>
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
        openDeleteDialog?: (entity: any) => void
        closeSnackbar?: (key: any) => void
        openWindow?: (url: string) => void
    }
    meta?: Record<string, any>
    runtime?: Record<string, any>
    [key: string]: any
}

/**
 * Props for BaseEntityMenu component
 */
export interface BaseEntityMenuProps {
    /** Entity object being acted upon */
    entity: any
    /** Entity type identifier (e.g., 'metaverse', 'cluster', 'unik') */
    entityKind: string
    /** Array of action descriptors defining menu items */
    descriptors: ActionDescriptor[]
    /** i18n namespace for translations (default: 'flowList') */
    namespace?: string
    /** Translation key for menu button label (default: 'menu.button') */
    menuButtonLabelKey?: string
    /** Custom trigger renderer function (optional, uses Button by default) */
    renderTrigger?: (props: TriggerProps) => React.ReactElement
    /** Optional i18n instance to use for translations (helps when multiple providers exist) */
    i18nInstance?: I18nInstance
    /** Factory function to create action context */
    createContext: (base: Partial<ActionContext>) => ActionContext
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
export const BaseEntityMenu: React.FC<BaseEntityMenuProps> = ({
    entity,
    entityKind,
    descriptors,
    namespace = 'flowList',
    menuButtonLabelKey = 'menu.button',
    renderTrigger,
    i18nInstance,
    createContext,
    contextExtras
}) => {
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
                const message =
                    e instanceof Error ? e.message : typeof e === 'string' && e.length > 0 ? e : 'Action failed'
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

    // Default trigger: Button with dropdown icon
    const defaultTrigger = (props: TriggerProps) => (
        <Button endIcon={<KeyboardArrowDownIcon />} {...props}>
            {t(menuButtonLabelKey)}
        </Button>
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
            <Menu open={open} onClose={handleClose} anchorEl={anchorEl}>
                {Object.entries(groups).map(([group, acts], gi, arr) => (
                    <React.Fragment key={group}>
                        {acts.map((a) => {
                            const disabled = busyActionId === a.id || (a.enabled ? !a.enabled(ctx) : false)
                            const IconNode = typeof a.icon === 'function' ? a.icon() : a.icon
                            return (
                                <MenuItem key={a.id} disabled={disabled} onClick={() => doAction(a)}>
                                    {IconNode}
                                    {t(a.labelKey)}
                                </MenuItem>
                            )
                        })}
                        {gi < arr.length - 1 && <Divider />}
                    </React.Fragment>
                ))}
            </Menu>
            {dialogState && (
                <Suspense fallback={null}>
                    <dialogState.Comp
                        {...dialogState.props}
                        onCancel={() => setDialogState(null)}
                        onClose={() => setDialogState(null)}
                    />
                </Suspense>
            )}
        </>
    )
}
