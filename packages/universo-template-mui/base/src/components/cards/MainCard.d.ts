import { ReactNode, ForwardRefExoticComponent, RefAttributes } from 'react'
import { CardProps, SxProps, Theme } from '@mui/material'

export interface MainCardProps extends Omit<CardProps, 'children'> {
    border?: boolean
    boxShadow?: boolean
    children?: ReactNode
    content?: boolean
    contentClass?: string
    contentSX?: SxProps<Theme>
    darkTitle?: boolean
    disableContentPadding?: boolean
    disableHeader?: boolean
    secondary?: ReactNode | string | Record<string, any>
    shadow?: string | false
    sx?: SxProps<Theme>
    title?: ReactNode | string | Record<string, any>
}

declare const MainCard: ForwardRefExoticComponent<MainCardProps & RefAttributes<any>>

export default MainCard
