import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../hooks/useConfirm'

/**
 * ConfirmDialog - Imperative confirmation dialog that renders via Portal
 * Works with useConfirm hook for Promise-based confirmations
 *
 * This component should be rendered once at the root level of the application
 * and requires:
 * - ConfirmContextProvider in the component tree
 * - A DOM element with id="portal" in index.html
 *
 * Usage pattern:
 * ```tsx
 * // In your root component:
 * <ConfirmContextProvider>
 *   <YourApp />
 *   <ConfirmDialog />
 * </ConfirmContextProvider>
 *
 * // In any child component:
 * const { confirm } = useConfirm()
 * const result = await confirm({
 *   title: 'Delete item?',
 *   description: 'This action cannot be undone',
 *   confirmButtonName: 'Delete',
 *   cancelButtonName: 'Cancel'
 * })
 * ```
 */
export const ConfirmDialog = () => {
    const { onConfirm, onCancel, confirmState } = useConfirm()
    const { t } = useTranslation()

    const portalElement = typeof document !== 'undefined' ? document.getElementById('portal') : null

    if (!confirmState.show) {
        return null
    }

    return (
        <Dialog
            fullWidth
            maxWidth='sm'
            open={confirmState.show}
            onClose={onCancel}
            aria-labelledby='confirm-dialog-title'
            aria-describedby='confirm-dialog-description'
            container={portalElement ?? undefined}
            disablePortal={!portalElement}
            PaperProps={{
                'data-confirm-dialog-request-id': confirmState.requestId || undefined
            }}
            sx={{
                zIndex: (theme) => theme.zIndex.modal + 20,
                '& .MuiBackdrop-root': {
                    zIndex: (theme) => theme.zIndex.modal + 19
                },
                '& .MuiDialog-paper': {
                    position: 'relative',
                    zIndex: (theme) => theme.zIndex.modal + 21
                }
            }}
        >
            <DialogTitle id='confirm-dialog-title' sx={{ fontSize: '1rem' }}>
                {confirmState.title || t('common:confirm.title')}
            </DialogTitle>
            <DialogContent id='confirm-dialog-description'>
                <span>{confirmState.description}</span>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {!confirmState.hideCancelButton && (
                    <Button onClick={onCancel}>{confirmState.cancelButtonName || t('common:confirm.cancelButtonText')}</Button>
                )}
                <Button variant='contained' color='primary' onClick={onConfirm}>
                    {confirmState.confirmButtonName || t('common:confirm.confirmButtonText')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDialog
