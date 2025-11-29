import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'
import { Button, Dialog, DialogContent, DialogTitle } from '@mui/material'
import { StyledButton } from '@flowise/template-mui'

const DeleteConfirmDialog = ({ show, dialogProps, onCancel, onDelete, onDeleteBoth }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='xs'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <span>{dialogProps.description}</span>
                <div style={{ display: 'flex', flexDirection: 'row', marginTop: 20 }}>
                    <Button sx={{ flex: 1, mb: 1, mr: 1 }} color='error' variant='outlined' onClick={onDelete}>
                        {t('assistants:openai.deleteConfirm.onlyFlowise')}
                    </Button>
                    <StyledButton sx={{ flex: 1, mb: 1, ml: 1 }} color='error' variant='contained' onClick={onDeleteBoth}>
                        {t('assistants:openai.deleteConfirm.openaiAndFlowise')}
                    </StyledButton>
                </div>
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

DeleteConfirmDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onDeleteBoth: PropTypes.func,
    onDelete: PropTypes.func,
    onCancel: PropTypes.func
}

export default DeleteConfirmDialog
