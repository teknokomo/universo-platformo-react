import { ReactNode } from 'react'
import { SxProps, Theme } from '@mui/material'

export interface ItemCardData {
    iconSrc?: string
    name?: string
    description?: string
    [key: string]: any
}

export interface ItemCardProps {
    data: ItemCardData
    images?: any[]
    onClick?: () => void
    allowStretch?: boolean
    footerEndContent?: ReactNode
    headerAction?: ReactNode
    sx?: SxProps<Theme>
}

declare const ItemCard: React.FC<ItemCardProps>

export default ItemCard
