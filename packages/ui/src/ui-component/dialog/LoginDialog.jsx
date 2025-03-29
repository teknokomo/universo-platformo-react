import { createPortal } from 'react-dom'
import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { Dialog, DialogActions, DialogContent, Typography, DialogTitle } from '@mui/material'
import { StyledButton } from '@/ui-component/button/StyledButton'
import { Input } from '@/ui-component/input/Input'

const LoginDialog = ({ show, dialogProps, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const { t } = useTranslation()
    const usernameInput = {
        label: t('dialog.login.username'),
        name: 'username',
        type: 'string',
        placeholder: 'john doe'
    }
    const passwordInput = {
        label: t('dialog.login.password'),
        name: 'password',
        type: 'password'
    }
    const [usernameVal, setUsernameVal] = useState('')
    const [passwordVal, setPasswordVal] = useState('')

    const component = show ? (
        <Dialog
            onKeyUp={(e) => {
                if (e.key === 'Enter') {
                    onConfirm(usernameVal, passwordVal)
                }
            }}
            open={show}
            fullWidth
            maxWidth='xs'
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <Typography>{t('dialog.login.username')}</Typography>
                <Input
                    inputParam={usernameInput}
                    onChange={(newValue) => setUsernameVal(newValue)}
                    value={usernameVal}
                    showDialog={false}
                />
                <div style={{ marginTop: 20 }}></div>
                <Typography>{t('dialog.login.password')}</Typography>
                <Input inputParam={passwordInput} onChange={(newValue) => setPasswordVal(newValue)} value={passwordVal} />
            </DialogContent>
            <DialogActions>
                <StyledButton variant='contained' onClick={() => onConfirm(usernameVal, passwordVal)}>
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

LoginDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onConfirm: PropTypes.func
}

export default LoginDialog
