import { useState, useEffect, useCallback, Fragment, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'

// Material
import Autocomplete, { autocompleteClasses } from '@mui/material/Autocomplete'
import { Popper, CircularProgress, TextField, Box, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'

// API
import { api } from '@universo/api-client'
import { useAuth } from '@universo/auth-frontend'

const StyledPopper = styled(Popper)({
    boxShadow: '0px 8px 10px -5px rgb(0 0 0 / 20%), 0px 16px 24px 2px rgb(0 0 0 / 14%), 0px 6px 30px 5px rgb(0 0 0 / 12%)',
    borderRadius: '10px',
    [`& .${autocompleteClasses.listbox}`]: {
        boxSizing: 'border-box',
        '& ul': {
            padding: 10,
            margin: 10
        }
    }
})

export const AsyncDropdown = ({
    name,
    nodeData,
    value,
    onSelect,
    isCreateNewOption,
    onCreateNew,
    credentialNames = [],
    disabled = false,
    freeSolo = false,
    disableClearable = false,
    multiple = false
}) => {
    const customization = useSelector((state) => state.customization)
    const { unikId } = useParams()
    const { client } = useAuth()

    const [open, setOpen] = useState(false)
    const [options, setOptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false) // Track if options have been loaded

    // Use ref to track nodeData without causing re-renders
    const nodeDataRef = useRef(nodeData)
    nodeDataRef.current = nodeData

    const findMatchingOptions = (options = [], value) => {
        if (multiple) {
            let values = []
            if ('choose an option' !== value && value && typeof value === 'string') {
                values = JSON.parse(value)
            } else {
                values = value
            }
            return options.filter((option) => values.includes(option.name))
        }
        return options.find((option) => option.name === value)
    }
    const getDefaultOptionValue = () => (multiple ? [] : '')
    const addNewOption = [{ label: '- Create New -', name: '-create-' }]
    let [internalValue, setInternalValue] = useState(value ?? 'choose an option')

    const fetchCredentialList = useCallback(async () => {
        try {
            let names = ''
            if (credentialNames.length > 1) {
                names = credentialNames.join('&credentialName=')
            } else {
                names = credentialNames[0]
            }

            const resp = await api.credentials.getByName(unikId || '', names)
            if (resp) {
                const returnList = []
                for (let i = 0; i < resp.length; i += 1) {
                    const data = {
                        label: resp[i].name,
                        name: resp[i].id
                    }
                    returnList.push(data)
                }
                return returnList
            }
        } catch (error) {
            console.error(error)
        }
    }, [credentialNames, unikId])

    const fetchDynamicOptions = useCallback(async () => {
        try {
            const currentNodeData = nodeDataRef.current
            const loadMethod = currentNodeData.inputParams.find((param) => param.name === name)?.loadMethod
            const response = await client.post(`node-load-method/${currentNodeData.name}`, { ...currentNodeData, loadMethod })
            return response.data ?? []
        } catch (error) {
            console.error(error)
            return []
        }
    }, [client, name]) // Removed nodeData from dependencies - using ref instead

    useEffect(() => {
        // Only load once per component mount
        if (hasLoaded) return

        let isMounted = true
        const loadOptions = async () => {
            setLoading(true)
            try {
                const response = credentialNames.length ? await fetchCredentialList() : await fetchDynamicOptions()
                if (!isMounted) return
                const nextOptions = response ?? []
                setOptions(isCreateNewOption ? [...nextOptions, ...addNewOption] : [...nextOptions])
                setHasLoaded(true) // Mark as loaded to prevent infinite loop
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        loadOptions()

        return () => {
            isMounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only run once on mount

    return (
        <>
            <Autocomplete
                id={name}
                freeSolo={freeSolo}
                disabled={disabled}
                disableClearable={disableClearable}
                multiple={multiple}
                filterSelectedOptions={multiple}
                size='small'
                sx={{ mt: 1, width: '100%' }}
                open={open}
                onOpen={() => {
                    setOpen(true)
                }}
                onClose={() => {
                    setOpen(false)
                }}
                options={options}
                value={findMatchingOptions(options, internalValue) || getDefaultOptionValue()}
                onChange={(e, selection) => {
                    if (multiple) {
                        let value = ''
                        if (selection.length) {
                            const selectionNames = selection.map((item) => item.name)
                            value = JSON.stringify(selectionNames)
                        }
                        setInternalValue(value)
                        onSelect(value)
                    } else {
                        const value = selection ? selection.name : ''
                        if (isCreateNewOption && value === '-create-') {
                            onCreateNew()
                        } else {
                            setInternalValue(value)
                            onSelect(value)
                        }
                    }
                }}
                PopperComponent={StyledPopper}
                loading={loading}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        value={internalValue}
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <Fragment>
                                    {loading ? <CircularProgress color='inherit' size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </Fragment>
                            )
                        }}
                        sx={{ height: '100%', '& .MuiInputBase-root': { height: '100%' } }}
                    />
                )}
                renderOption={(props, option) => (
                    <Box component='li' {...props}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant='h5'>{option.label}</Typography>
                            {option.description && (
                                <Typography sx={{ color: customization.isDarkMode ? '#9e9e9e' : '' }}>{option.description}</Typography>
                            )}
                        </div>
                    </Box>
                )}
            />
        </>
    )
}

AsyncDropdown.propTypes = {
    name: PropTypes.string,
    nodeData: PropTypes.object,
    value: PropTypes.string,
    onSelect: PropTypes.func,
    onCreateNew: PropTypes.func,
    disabled: PropTypes.bool,
    freeSolo: PropTypes.bool,
    credentialNames: PropTypes.array,
    disableClearable: PropTypes.bool,
    isCreateNewOption: PropTypes.bool,
    multiple: PropTypes.bool
}
