import { createPortal } from 'react-dom'
import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Dialog, DialogContent, DialogTitle } from '@mui/material'

// store
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@flowise/store'
import useNotifier from '@flowise/template-mui/hooks/useNotifier'

// Project imports
import SpeechToText from '../extended/SpeechToText'

const SpeechToTextDialog = ({ show, dialogProps, onCancel }) => {
    const portalElement = document.getElementById('portal')
    // Bind to dialog namespace for speech to text specific dialog strings
    const { t } = useTranslation('speechToTextDialog')
    const dispatch = useDispatch()

    useNotifier()

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const component = show ? (
        <Dialog
            onClose={onCancel}
            open={show}
            fullWidth
            maxWidth='sm'
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title || t('title')}
            </DialogTitle>
            <DialogContent>
                <SpeechToText dialogProps={dialogProps} />
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

SpeechToTextDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default SpeechToTextDialog
