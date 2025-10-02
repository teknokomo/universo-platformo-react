import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, OutlinedInput } from '@mui/material'
import { StyledButton } from '@/ui-component/button/StyledButton'

const SaveCanvasDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()
    const [canvasName, setCanvasName] = useState(dialogProps.initialValue || '')
    const [isReadyToSave, setIsReadyToSave] = useState(false)

    useEffect(() => {
        if (canvasName) setIsReadyToSave(true)
        else setIsReadyToSave(false)
    }, [canvasName])

    const component =
        show ? (
            <Dialog
                open={show}
                fullWidth
                maxWidth='xs'
                onClose={onCancel}
                aria-labelledby='alert-dialog-title'
                aria-describedby='alert-dialog-description'
                disableRestoreFocus
            >
                <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                    {dialogProps.title}
                </DialogTitle>
                <DialogContent>
                    <OutlinedInput
                        autoFocus
                        sx={{ mt: 1 }}
                        id='canvas-name'
                        type='text'
                        fullWidth
                        placeholder={dialogProps.initialValue ? '' : dialogProps.placeholder || t('dialog.saveCanvas.placeholder')}
                        value={canvasName}
                        onChange={(e) => setCanvasName(e.target.value)}
                        onKeyDown={(e) => {
                            if (isReadyToSave && e.key === 'Enter') onConfirm(e.target.value)
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancel}>{dialogProps.cancelButtonName || t('common.cancel')}</Button>
                    <StyledButton disabled={!isReadyToSave} variant='contained' onClick={() => onConfirm(canvasName)}>
                        {dialogProps.confirmButtonName || t('common.save')}
                    </StyledButton>
                </DialogActions>
            </Dialog>
        ) : null

    return createPortal(component, portalElement)
}

SaveCanvasDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default SaveCanvasDialog
