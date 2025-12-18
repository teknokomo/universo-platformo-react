import PropTypes from 'prop-types'
import { useRef, useContext, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { NodeToolbar } from 'reactflow'

import { styled, useTheme, alpha, darken, lighten } from '@mui/material/styles'
import { ButtonGroup, IconButton, Box, TextField } from '@mui/material'
import { IconCopy, IconTrash } from '@tabler/icons-react'
import MainCard from '@flowise/template-mui/ui-components/cards/MainCard'
import { flowContext, SET_DIRTY } from '@flowise/store'

const CardWrapper = styled(MainCard)(({ theme }) => ({
    background: theme.palette.card?.main || theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: 'solid 1px',
    width: 'max-content',
    height: 'auto',
    padding: '10px',
    boxShadow: 'none'
}))

const StyledNodeToolbar = styled(NodeToolbar)(({ theme }) => ({
    backgroundColor: theme.palette.card?.main || theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: '5px',
    borderRadius: '10px',
    boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)'
}))

const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiInputBase-root': {
        backgroundColor: 'transparent',
        fontSize: '0.875rem',
        minWidth: '150px'
    },
    '& .MuiOutlinedInput-notchedOutline': {
        border: 'none'
    },
    '& .MuiInputBase-input': {
        color: theme.palette.text.primary,
        padding: '8px'
    }
}))

/**
 * StickyNoteNode - Simple note node for AgentFlow canvases
 * Features:
 * - Editable text content
 * - Configurable color
 * - Toolbar with duplicate/delete
 * - Hover state color transitions
 */
const StickyNoteNode = ({ data }) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const ref = useRef(null)

    const { deleteNode, duplicateNode } = useContext(flowContext)
    const [isHovered, setIsHovered] = useState(false)
    const [noteText, setNoteText] = useState(data.inputs?.note || data.inputs?.stickyNote || '')

    const defaultColor = '#666666'
    const nodeColor = data.color || defaultColor

    const getStateColor = useCallback(() => {
        if (data.selected) return nodeColor
        if (isHovered) return alpha(nodeColor, 0.8)
        return alpha(nodeColor, 0.5)
    }, [data.selected, isHovered, nodeColor])

    const getBackgroundColor = useCallback(() => {
        const isDark = customization?.isDarkMode
        if (isDark) {
            return isHovered ? darken(nodeColor, 0.7) : darken(nodeColor, 0.8)
        }
        return isHovered ? lighten(nodeColor, 0.8) : lighten(nodeColor, 0.9)
    }, [customization?.isDarkMode, isHovered, nodeColor])

    const handleTextChange = useCallback(
        (e) => {
            const newValue = e.target.value
            setNoteText(newValue)
            // Update node data
            if (data.inputs) {
                data.inputs.note = newValue
                data.inputs.stickyNote = newValue
            }
            dispatch({ type: SET_DIRTY })
        },
        [data.inputs, dispatch]
    )

    const handleDuplicate = useCallback(() => {
        duplicateNode(data.id)
    }, [duplicateNode, data.id])

    const handleDelete = useCallback(() => {
        deleteNode(data.id)
    }, [deleteNode, data.id])

    return (
        <div ref={ref} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <StyledNodeToolbar>
                <ButtonGroup sx={{ gap: 1 }} variant='outlined' aria-label='Sticky note actions'>
                    <IconButton
                        size='small'
                        title='Duplicate'
                        onClick={handleDuplicate}
                        sx={{
                            color: customization?.isDarkMode ? 'white' : 'inherit',
                            '&:hover': {
                                color: theme.palette.primary.main
                            }
                        }}
                    >
                        <IconCopy size={20} />
                    </IconButton>
                    <IconButton
                        size='small'
                        title='Delete'
                        onClick={handleDelete}
                        sx={{
                            color: customization?.isDarkMode ? 'white' : 'inherit',
                            '&:hover': {
                                color: theme.palette.error.main
                            }
                        }}
                    >
                        <IconTrash size={20} />
                    </IconButton>
                </ButtonGroup>
            </StyledNodeToolbar>

            <CardWrapper
                content={false}
                sx={{
                    borderColor: getStateColor(),
                    borderWidth: '1px',
                    boxShadow: data.selected ? `0 0 0 1px ${getStateColor()} !important` : 'none',
                    minHeight: 60,
                    height: 'auto',
                    backgroundColor: getBackgroundColor(),
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': {
                        boxShadow: data.selected ? `0 0 0 1px ${getStateColor()} !important` : 'none'
                    }
                }}
                border={false}
            >
                <Box>
                    <StyledTextField
                        multiline
                        minRows={2}
                        maxRows={10}
                        placeholder='Add a note...'
                        value={noteText}
                        onChange={handleTextChange}
                        className='nodrag'
                        variant='outlined'
                        size='small'
                    />
                </Box>
            </CardWrapper>
        </div>
    )
}

StickyNoteNode.propTypes = {
    data: PropTypes.object
}

export default StickyNoteNode
