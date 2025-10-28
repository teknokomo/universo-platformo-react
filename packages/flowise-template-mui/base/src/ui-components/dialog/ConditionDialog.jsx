import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'

// MUI
import { Button, Dialog, DialogActions, DialogContent } from '@mui/material'
import { Tabs } from '@mui/base/Tabs'

// Project Import
import { StyledButton } from '../button/StyledButton'
import { TabPanel } from '../tabs/TabPanel'
import { TabsList } from '../tabs/TabsList'
import { Tab } from '../tabs/Tab'
import NodeInputHandler from '../canvas/NodeInputHandler'

// Store
import { HIDE_CANVAS_DIALOG, SHOW_CANVAS_DIALOG } from '@flowise/store'

const ConditionDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const [inputParam, setInputParam] = useState(null)
    const [tabValue, setTabValue] = useState(0)
    const [data, setData] = useState({})

    useEffect(() => {
        if (dialogProps.inputParam) {
            setInputParam(dialogProps.inputParam)
        }

        if (dialogProps.data) setData(dialogProps.data)

        return () => {
            setInputParam(null)
            setData({})
        }
    }, [dialogProps])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const component = show ? (
        <Dialog open={show} fullWidth maxWidth='md' aria-labelledby='alert-dialog-title' aria-describedby='alert-dialog-description'>
            <DialogContent>
                <>
                    {inputParam && inputParam.type.includes('conditionFunction') && (
                        <>
                            <Tabs value={tabValue} onChange={(event, val) => setTabValue(val)} aria-label='tabs' variant='fullWidth'>
                                <TabsList>
                                    {inputParam.tabs.map((inputChildParam, index) => (
                                        <Tab key={index}>{inputChildParam.label}</Tab>
                                    ))}
                                </TabsList>
                            </Tabs>
                            {inputParam.tabs.map((inputChildParam, index) => (
                                <TabPanel key={index} value={tabValue} index={index}>
                                    <NodeInputHandler
                                        disabled={inputChildParam.disabled}
                                        inputParam={inputChildParam}
                                        data={data}
                                        isAdditionalParams={true}
                                        disablePadding={true}
                                    />
                                </TabPanel>
                            ))}
                        </>
                    )}
                </>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>{dialogProps.cancelButtonName || t('dialog.condition.cancelButtonText')}</Button>
                <StyledButton disabled={dialogProps.disabled} variant='contained' onClick={() => onConfirm(data, inputParam, tabValue)}>
                    {dialogProps.confirmButtonName || t('dialog.condition.confirmButtonText')}
                </StyledButton>
            </DialogActions>
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

ConditionDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default ConditionDialog
