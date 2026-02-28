import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

export interface CollapsibleSectionProps {
    /** Section header label */
    label: string
    /** Whether the section is expanded by default */
    defaultOpen?: boolean
    /** Section content */
    children: React.ReactNode
}

/**
 * Reusable collapsible section with a clickable header.
 * Matches the existing Collapse pattern used in AttributeFormFields.
 */
// eslint-disable-next-line react/prop-types -- Props typed via CollapsibleSectionProps interface
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ label, defaultOpen = false, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <Box>
            <Box
                role='button'
                tabIndex={0}
                aria-expanded={isOpen}
                aria-label={label}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    py: 1,
                    '&:hover': { color: 'primary.main' }
                }}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setIsOpen(!isOpen)
                    }
                }}
            >
                {isOpen ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
                <Typography variant='body2' sx={{ ml: 0.5, fontWeight: 500 }}>
                    {label}
                </Typography>
            </Box>
            <Collapse in={isOpen}>
                <Box sx={{ pt: 1 }}>{children}</Box>
            </Collapse>
        </Box>
    )
}
