import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { StyledButton } from '../button/StyledButton'
import { CodeEditor } from '../editor/CodeEditor'
import { useTranslation } from '@universo/i18n/hooks'

const PasteJSONDialog = ({ show, onCancel, onConfirm, customization }) => {
    const portalElement = document.getElementById('portal')
    const [jsonInput, setJsonInput] = useState('')
    const [error, setError] = useState('')
    const { t } = useTranslation(['tools'])

    const handleConfirm = () => {
        try {
            const parsedJSON = JSON.parse(jsonInput)
            if (!Array.isArray(parsedJSON)) throw new Error(t('tools.dialog.inputMustBeArray'))
            const formattedData = parsedJSON.map((item, index) => ({
                id: index + 1,
                property: item.property || '',
                type: item.type || 'string',
                description: item.description || '',
                required: item.required || false
            }))
            onConfirm(formattedData)
            setError('')
        } catch (err) {
            setError(t('tools.dialog.invalidJSONFormat'))
        }
    }

    const exampleJSON = `[
    {
        "property": "name",
        "type": "string",
        "description": "User's name",
        "required": true
    },
    {
        "property": "age",
        "type": "number",
        "description": "User's age",
        "required": false
    }
]`

    const component = show ? (
        <Dialog fullWidth maxWidth='md' open={show} onClose={onCancel} aria-labelledby='paste-json-dialog-title'>
            <DialogTitle sx={{ fontSize: '1rem' }} id='paste-json-dialog-title'>
                {t('tools.dialog.pasteJsonSchema')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Button variant='outlined' size='small' onClick={() => setJsonInput(exampleJSON)} sx={{ mb: 2 }}>
                        {t('tools.dialog.seeExample')}
                    </Button>
                    <CodeEditor
                        value={jsonInput}
                        theme={customization.isDarkMode ? 'dark' : 'light'}
                        lang='json'
                        onValueChange={(code) => {
                            setJsonInput(code)
                            setError('')
                        }}
                    />
                    {error && <Box sx={{ color: 'error.main', mt: 1, fontSize: '0.875rem' }}>{error}</Box>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{t('tools.common.cancel')}</Button>
                <StyledButton variant='contained' onClick={handleConfirm}>
                    {t('tools.common.confirm')}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

PasteJSONDialog.propTypes = {
    show: PropTypes.bool,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
    customization: PropTypes.object
}

export default PasteJSONDialog
