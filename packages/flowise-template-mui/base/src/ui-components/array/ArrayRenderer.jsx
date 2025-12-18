import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import { Chip, Box, Button, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import NodeInputHandler from '../canvas/NodeInputHandler'
import { cloneDeep } from 'lodash'

// Note: showHideInputs must be passed as a prop or imported from the consuming package
// since flowise-template-mui is a shared UI library without direct dependency on spaces-frontend.
// For now, provide a fallback implementation that just returns params unchanged.
const fallbackShowHideInputs = (data, inputType, params, _arrayIndex) => {
    // Simple fallback: return params with display = true
    return (params || []).map((p) => ({ ...p, display: p.display !== false }))
}

/**
 * ArrayRenderer - renders a dynamic list of sub-input groups for array-type inputParams.
 * Adapted from Flowise 3.0.12 ui-component/array/ArrayRenderer.jsx.
 */
export const ArrayRenderer = ({ inputParam, data, disabled = false, onArrayChange }) => {
    const [arrayItems, setArrayItems] = useState([]) // actual values per array element
    const [itemParameters, setItemParameters] = useState([]) // display params per element after show/hide
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    // Handle input value change inside an array element
    const handleItemInputChange = ({ inputParam: changedParam, newValue }, itemIndex) => {
        const clonedData = cloneDeep(data)
        const updatedArrayItems = [...arrayItems]
        const updatedItem = { ...updatedArrayItems[itemIndex] }

        // Reset fields with show/hide rules to avoid stale values
        for (const fieldDef of inputParam.array) {
            if (fieldDef.show || fieldDef.hide) {
                updatedItem[fieldDef.name] = fieldDef.default || ''
            }
        }

        updatedItem[changedParam.name] = newValue
        updatedArrayItems[itemIndex] = updatedItem

        setArrayItems(updatedArrayItems)
        data.inputs[inputParam.name] = updatedArrayItems
        clonedData.inputs[inputParam.name] = updatedArrayItems

        // Recalculate item parameters
        const newItemParams = fallbackShowHideInputs(clonedData, 'inputParams', cloneDeep(inputParam.array), itemIndex)
        if (newItemParams.length) {
            const updatedItemParams = [...itemParameters]
            updatedItemParams[itemIndex] = newItemParams
            setItemParameters(updatedItemParams)
        }

        // Notify parent
        if (onArrayChange) {
            onArrayChange({ name: inputParam.name, value: updatedArrayItems })
        }
    }

    // Initialize on mount or data/inputParam change
    useEffect(() => {
        const initialArrayItems = data.inputs[inputParam.name] || []
        setArrayItems(initialArrayItems)

        const initialItemParameters = []
        for (let i = 0; i < initialArrayItems.length; i += 1) {
            const itemParams = fallbackShowHideInputs(data, 'inputParams', cloneDeep(inputParam.array), i)
            if (itemParams.length) {
                initialItemParameters.push(itemParams)
            }
        }
        setItemParameters(initialItemParameters)
    }, [data, inputParam])

    // Add new array element
    const handleAddItem = () => {
        const newItem = {}
        for (const fieldDef of inputParam.array) {
            newItem[fieldDef.name] = fieldDef.default || ''
        }

        const updatedArrayItems = [...arrayItems, newItem]
        setArrayItems(updatedArrayItems)
        data.inputs[inputParam.name] = updatedArrayItems

        const updatedItemParameters = []
        for (let i = 0; i < updatedArrayItems.length; i += 1) {
            const itemParams = fallbackShowHideInputs(data, 'inputParams', cloneDeep(inputParam.array), i)
            if (itemParams.length) {
                updatedItemParameters.push(itemParams)
            }
        }
        setItemParameters(updatedItemParameters)

        if (onArrayChange) {
            onArrayChange({ name: inputParam.name, value: updatedArrayItems })
        }
    }

    // Delete array element
    const handleDeleteItem = (indexToDelete) => {
        const updatedArrayItems = arrayItems.filter((_, i) => i !== indexToDelete)
        setArrayItems(updatedArrayItems)
        data.inputs[inputParam.name] = updatedArrayItems

        const updatedItemParameters = itemParameters.filter((_, i) => i !== indexToDelete)
        setItemParameters(updatedItemParameters)

        if (onArrayChange) {
            onArrayChange({ name: inputParam.name, value: updatedArrayItems })
        }
    }

    return (
        <>
            {/* Render each array item */}
            {arrayItems.map((itemValues, index) => {
                const itemData = {
                    ...data,
                    inputs: itemValues,
                    inputParams: itemParameters[index] || []
                }

                return (
                    <Box
                        sx={{
                            p: 2,
                            mt: 2,
                            mb: 1,
                            border: 1,
                            borderColor: theme.palette.grey[900] + '25',
                            borderRadius: 2,
                            position: 'relative'
                        }}
                        key={index}
                    >
                        {/* Delete button */}
                        <IconButton
                            title='Delete'
                            onClick={() => handleDeleteItem(index)}
                            sx={{
                                position: 'absolute',
                                height: '35px',
                                width: '35px',
                                right: 10,
                                top: 10,
                                color: customization?.isDarkMode ? theme.palette.grey[300] : 'inherit',
                                '&:hover': { color: 'red' }
                            }}
                        >
                            <IconTrash />
                        </IconButton>

                        <Chip label={`${index}`} size='small' sx={{ position: 'absolute', right: 50, top: 16 }} />

                        {/* Render input fields for array item */}
                        {(itemParameters[index] || [])
                            .filter((param) => param.display !== false)
                            .map((param, pIdx) => (
                                <NodeInputHandler
                                    key={pIdx}
                                    disabled={disabled}
                                    inputParam={param}
                                    data={itemData}
                                    isAdditionalParams={true}
                                    parentParamForArray={inputParam}
                                    arrayIndex={index}
                                    onCustomDataChange={({ inputParam: ip, newValue: nv }) => {
                                        handleItemInputChange({ inputParam: ip, newValue: nv }, index)
                                    }}
                                />
                            ))}
                    </Box>
                )
            })}

            {/* Add new item button */}
            <Button
                fullWidth
                size='small'
                variant='outlined'
                sx={{ borderRadius: '16px', mt: 2 }}
                startIcon={<IconPlus />}
                onClick={handleAddItem}
            >
                Add {inputParam.label}
            </Button>
        </>
    )
}

ArrayRenderer.propTypes = {
    inputParam: PropTypes.object.isRequired,
    data: PropTypes.object.isRequired,
    disabled: PropTypes.bool,
    onArrayChange: PropTypes.func
}

export default ArrayRenderer
