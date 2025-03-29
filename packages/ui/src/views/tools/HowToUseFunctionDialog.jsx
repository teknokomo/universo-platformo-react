import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { useTranslation } from 'react-i18next'

const HowToUseFunctionDialog = ({ show, onCancel }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()

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
                {t('tools.dialog.howToUseFunction', 'How To Use Function')}
            </DialogTitle>
            <DialogContent>
                <ul>
                    <li style={{ marginTop: 10 }}>{t('tools.function.useLibraries', 'You can use any libraries imported in Flowise')}</li>
                    <li style={{ marginTop: 10 }}>
                        {t('tools.function.usePropertiesAsVariables', 'You can use properties specified in Input Schema as variables with prefix $:')}
                        <ul style={{ marginTop: 10 }}>
                            <li>
                                {t('tools.function.property', 'Property')} = <code>userid</code>
                            </li>
                            <li>
                                {t('tools.function.variable', 'Variable')} = <code>$userid</code>
                            </li>
                        </ul>
                    </li>
                    <li style={{ marginTop: 10 }}>
                        {t('tools.function.getFlowConfig', 'You can get default flow config:')}
                        <ul style={{ marginTop: 10 }}>
                            <li>
                                <code>$flow.sessionId</code>
                            </li>
                            <li>
                                <code>$flow.chatId</code>
                            </li>
                            <li>
                                <code>$flow.chatflowId</code>
                            </li>
                            <li>
                                <code>$flow.input</code>
                            </li>
                            <li>
                                <code>$flow.state</code>
                            </li>
                        </ul>
                    </li>
                    <li style={{ marginTop: 10 }}>
                        {t('tools.function.getCustomVariables', 'You can get custom variables:')}&nbsp;<code>{`$vars.<variable-name>`}</code>
                    </li>
                    <li style={{ marginTop: 10 }}>{t('tools.function.returnString', 'Must return a string value at the end of function')}</li>
                </ul>
            </DialogContent>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

HowToUseFunctionDialog.propTypes = {
    show: PropTypes.bool,
    onCancel: PropTypes.func
}

export default HowToUseFunctionDialog
