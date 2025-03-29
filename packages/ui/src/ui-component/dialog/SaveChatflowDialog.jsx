import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Button, Dialog, DialogActions, DialogContent, OutlinedInput, DialogTitle } from '@mui/material'
import { StyledButton } from '@/ui-component/button/StyledButton'

const SaveChatflowDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

    const [chatflowName, setChatflowName] = useState('')
    const [isReadyToSave, setIsReadyToSave] = useState(false)

    useEffect(() => {
        if (chatflowName) setIsReadyToSave(true)
        else setIsReadyToSave(false)
    }, [chatflowName])

    const component = show ? (
        <Dialog
            open={show}
            fullWidth
            maxWidth='xs'
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
            disableRestoreFocus // needed due to StrictMode
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <OutlinedInput
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    sx={{ mt: 1 }}
                    id='chatflow-name'
                    type='text'
                    fullWidth
                    placeholder={t('dialog.saveChatflow.placeholder')}
                    value={chatflowName}
                    onChange={(e) => setChatflowName(e.target.value)}
                    onKeyDown={(e) => {
                        if (isReadyToSave && e.key === 'Enter') onConfirm(e.target.value)
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{dialogProps.cancelButtonName || t('common.cancel')}</Button>
                <StyledButton disabled={!isReadyToSave} variant='contained' onClick={() => onConfirm(chatflowName)}>
                    {dialogProps.confirmButtonName || t('common.save')}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

SaveChatflowDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default SaveChatflowDialog
