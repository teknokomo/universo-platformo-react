import { forwardRef } from 'react'
import Badge, { badgeClasses } from '@mui/material/Badge'
import IconButton, { IconButtonProps } from '@mui/material/IconButton'

export interface MenuButtonProps extends IconButtonProps {
    showBadge?: boolean
}

const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton({ showBadge = false, ...props }, ref) {
    return (
        <Badge color='error' variant='dot' invisible={!showBadge} sx={{ [`& .${badgeClasses.badge}`]: { right: 2, top: 2 } }}>
            <IconButton ref={ref} size='small' {...props} />
        </Badge>
    )
})

export default MenuButton
