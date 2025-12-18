// English-only comments as per repository guidelines.
import React, { useState, Suspense } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'
import { Menu, MenuItem, Divider, Button } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

// This component is runtime JS equivalent of previous TS variant. Typing preserved via JSDoc in entityActions.js.

const BaseEntityMenu = ({
    entity,
    entityKind,
    descriptors,
    namespace = 'flowList',
    menuButtonLabelKey = 'menu.button',
    renderTrigger, // Custom trigger renderer function (optional)
    createContext,
    contextExtras
}) => {
    const { t } = useTranslation(namespace)
    const [anchorEl, setAnchorEl] = useState(null)
    const [dialogState, setDialogState] = useState(null) // { id, Comp, props }
    const [busyActionId, setBusyActionId] = useState(null)

    const open = Boolean(anchorEl)
    const handleOpen = (e) => setAnchorEl(e.currentTarget)
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

    const groups = {}
    visible.forEach((d) => {
        const g = d.group || '_default'
        if (!groups[g]) groups[g] = []
        groups[g].push(d)
    })

    const doAction = async (d) => {
        if (busyActionId) return
        handleClose()
        try {
            setBusyActionId(d.id)
            if (d.confirm) {
                const spec = d.confirm(ctx)
                if (spec) {
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
            // eslint-disable-next-line no-console
            console.error('Action execution failed', d.id, e)
            if (ctx.helpers.enqueueSnackbar) {
                const enqueue = ctx.helpers.enqueueSnackbar
                const candidateMessage =
                    e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
                        ? e.message
                        : typeof e === 'string'
                        ? e
                        : 'Action failed'
                const message = candidateMessage && candidateMessage.length > 0 ? candidateMessage : 'Action failed'
                if (typeof enqueue === 'function') {
                    if (enqueue.length >= 2) {
                        enqueue(message, { variant: 'error' })
                    } else {
                        enqueue({
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
    const defaultTrigger = (props) => (
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
                    <dialogState.Comp {...dialogState.props} onCancel={() => setDialogState(null)} onClose={() => setDialogState(null)} />
                </Suspense>
            )}
        </>
    )
}

BaseEntityMenu.propTypes = {
    entity: PropTypes.any,
    entityKind: PropTypes.string.isRequired,
    descriptors: PropTypes.arrayOf(PropTypes.object).isRequired,
    namespace: PropTypes.string,
    menuButtonLabelKey: PropTypes.string,
    renderTrigger: PropTypes.func,
    createContext: PropTypes.func.isRequired,
    contextExtras: PropTypes.object
}

export default BaseEntityMenu
