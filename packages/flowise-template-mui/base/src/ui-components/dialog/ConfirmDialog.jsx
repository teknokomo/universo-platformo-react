import { createPortal } from 'react-dom'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import useConfirm from '../../hooks/useConfirm.js'
import { StyledButton } from '../button/StyledButton'
import { useTranslation } from '@universo/i18n/hooks'

const ConfirmDialog = () => {
    const { onConfirm, onCancel, confirmState } = useConfirm()
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

    const component = confirmState.show ? (
        <Dialog
            fullWidth
            maxWidth='xs'
            open={confirmState.show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {confirmState.title || t('dialog.confirm.title')}
            </DialogTitle>
            <DialogContent>
                <span>{confirmState.description}</span>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{confirmState.cancelButtonName || t('dialog.confirm.cancelButtonText')}</Button>
                <StyledButton variant='contained' onClick={onConfirm}>
                    {confirmState.confirmButtonName || t('dialog.confirm.confirmButtonText')}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

export default ConfirmDialog
