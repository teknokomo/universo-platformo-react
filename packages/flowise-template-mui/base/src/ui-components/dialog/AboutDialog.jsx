import PropTypes from 'prop-types'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useTranslation } from '@universo/i18n'
import { createPortal } from 'react-dom'

// Minimal AboutDialog stub to keep template-mui package self-contained during migration.
const AboutDialog = ({ show, onCancel }) => {
    const portalElement = typeof document !== 'undefined' ? document.getElementById('portal') : null
    const { t } = useTranslation()

    const component = show ? (
        <Dialog onClose={onCancel} open={show} fullWidth maxWidth='sm' aria-labelledby='about-dialog-title'>
            <DialogTitle id='about-dialog-title'>{t ? t('dialog.about.title') : 'About'}</DialogTitle>
            <DialogContent>{t ? t('dialog.about.description') : null}</DialogContent>
        </Dialog>
    ) : null

    return portalElement ? createPortal(component, portalElement) : component
}

AboutDialog.propTypes = {
    show: PropTypes.bool,
    onCancel: PropTypes.func
}

export default AboutDialog
