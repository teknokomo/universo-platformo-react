import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Box, Typography, IconButton } from '@mui/material'
import { IconArrowsMaximize, IconAlertTriangle } from '@tabler/icons-react'

// project import
import { Dropdown } from '../dropdown/Dropdown'
import { Input } from '../input/Input'
import { SwitchInput } from '../switch/Switch'
import { JsonEditorInput } from '../json/JsonEditor'
import { TooltipWithParser } from '../tooltip/TooltipWithParser'

// ===========================|| NodeInputHandler ||=========================== //

const CredentialInputHandler = ({ inputParam, data, disabled = false }) => {
    const customization = useSelector((state) => state.customization)
    const ref = useRef(null)
    const { t } = useTranslation('credentials')

    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})

    const onExpandDialogClicked = (value, inputParam) => {
        const dialogProp = {
            value,
            inputParam,
            disabled,
            confirmButtonName: t('credentials.common.save'),
            cancelButtonName: t('credentials.common.cancel')
        }
        setExpandDialogProps(dialogProp)
        setShowExpandDialog(true)
    }

    const onExpandDialogSave = (newValue, inputParamName) => {
        setShowExpandDialog(false)
        data[inputParamName] = newValue
    }

    return (
        <div ref={ref}>
            {inputParam && (
                <>
                    <Box sx={{ p: 2 }}>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                {inputParam.label}
                                {!inputParam.optional && <span style={{ color: 'red' }}>&nbsp;*</span>}
                                {inputParam.description && <TooltipWithParser style={{ marginLeft: 10 }} title={inputParam.description} />}
                            </Typography>
                            <div style={{ flexGrow: 1 }}></div>
                            {inputParam.type === 'string' && inputParam.rows && (
                                <IconButton
                                    size='small'
                                    sx={{
                                        height: 25,
                                        width: 25
                                    }}
                                    title={t('credentials.common.expand')}
                                    color='primary'
                                    onClick={() => onExpandDialogClicked(data[inputParam.name] ?? inputParam.default ?? '', inputParam)}
                                >
                                    <IconArrowsMaximize />
                                </IconButton>
                            )}
                        </div>
                        {inputParam.warning && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    borderRadius: 10,
                                    background: 'rgb(254,252,191)',
                                    padding: 10,
                                    marginTop: 10,
                                    marginBottom: 10
                                }}
                            >
                                <IconAlertTriangle size={36} color='orange' />
                                <span style={{ color: 'rgb(116,66,16)', marginLeft: 10 }}>{inputParam.warning}</span>
                            </div>
                        )}

                        {inputParam.type === 'boolean' && (
                            <SwitchInput
                                disabled={disabled}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? false}
                            />
                        )}
                        {(inputParam.type === 'string' || inputParam.type === 'password' || inputParam.type === 'number') && (
                            <Input
                                key={data[inputParam.name]}
                                disabled={disabled}
                                inputParam={inputParam}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? ''}
                                showDialog={showExpandDialog}
                                dialogProps={expandDialogProps}
                                onDialogCancel={() => setShowExpandDialog(false)}
                                onDialogConfirm={(newValue, inputParamName) => onExpandDialogSave(newValue, inputParamName)}
                            />
                        )}
                        {inputParam.type === 'json' && (
                            <JsonEditorInput
                                disabled={disabled}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? ''}
                                isDarkMode={customization.isDarkMode}
                            />
                        )}
                        {inputParam.type === 'options' && (
                            <Dropdown
                                disabled={disabled}
                                name={inputParam.name}
                                options={inputParam.options}
                                onSelect={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? t('credentials.chooseAnOption')}
                            />
                        )}
                    </Box>
                </>
            )}
        </div>
    )
}

CredentialInputHandler.propTypes = {
    inputAnchor: PropTypes.object,
    inputParam: PropTypes.object,
    data: PropTypes.object,
    disabled: PropTypes.bool
}

export default CredentialInputHandler
