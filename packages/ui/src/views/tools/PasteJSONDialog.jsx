import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { StyledButton } from '@/ui-component/button/StyledButton'
import { CodeEditor } from '@/ui-component/editor/CodeEditor'
import { useTranslation } from 'react-i18next'

const PasteJSONDialog = ({ show, onCancel, onConfirm, customization }) => {
    const portalElement = document.getElementById('portal')
    const [jsonInput, setJsonInput] = useState('')
    const [error, setError] = useState('')
    const { t } = useTranslation()

    const handleConfirm = () => {
        try {
            const parsedJSON = JSON.parse(jsonInput)
            if (!Array.isArray(parsedJSON)) throw new Error(t('tools.dialog.inputMustBeArray', 'Input must be an array of properties'))
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
            setError(t('tools.dialog.invalidJSONFormat', 'Invalid JSON format. Please check your input.'))
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
                {t('tools.dialog.pasteJsonSchema', 'Paste JSON Schema')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Button variant='outlined' size='small' onClick={() => setJsonInput(exampleJSON)} sx={{ mb: 2 }}>
                        {t('tools.dialog.seeExample', 'See Example')}
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
                <Button onClick={onCancel}>{t('common.cancel', 'Cancel')}</Button>
                <StyledButton variant='contained' onClick={handleConfirm}>
                    {t('common.confirm', 'Confirm')}
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
