import React, { forwardRef } from 'react'
import { Card, CardContent, CardHeader, Divider, Typography } from '@mui/material'
import type { CardProps, SxProps, Theme } from '@mui/material'

// Constant
const headerSX = {
    '& .MuiCardHeader-action': { mr: 0 }
}

export interface MainCardProps extends Omit<CardProps, 'children' | 'title' | 'content'> {
    border?: boolean
    boxShadow?: boolean
    children?: React.ReactNode
    content?: boolean
    contentClass?: string
    contentSX?: SxProps<Theme>
    darkTitle?: boolean
    disableContentPadding?: boolean
    disableHeader?: boolean
    secondary?: React.ReactNode
    shadow?: string | false
    sx?: SxProps<Theme>
    title?: React.ReactNode
}

// ==============================|| CUSTOM MAIN CARD ||============================== //

export const MainCard = forwardRef<HTMLDivElement, MainCardProps>(function MainCard(
    {
        boxShadow,
        children,
        content = true,
        contentClass = '',
        contentSX = {
            px: 2,
            py: 0
        },
        darkTitle,
        border = true,
        disableContentPadding = false,
        disableHeader = false,
        secondary,
        shadow,
        sx = {},
        title,
        ...others
    },
    ref
) {
    return (
        <Card
            ref={ref}
            {...others}
            sx={{
                background: 'transparent',
                boxShadow: shadow === false ? 'none' : undefined,
                border: border === false ? 'none' : undefined,
                ':hover': {
                    boxShadow: boxShadow ? shadow || '0 2px 14px 0 rgb(32 40 45 / 8%)' : 'inherit'
                },
                maxWidth: disableHeader ? '100%' : '1280px',
                mx: disableHeader ? undefined : 'auto',
                ...sx
            }}
        >
            {/* card header and action */}
            {!disableHeader && !darkTitle && title && <CardHeader sx={headerSX} title={title} action={secondary} />}
            {!disableHeader && darkTitle && title && (
                <CardHeader sx={headerSX} title={<Typography variant='h3'>{title}</Typography>} action={secondary} />
            )}

            {/* content & header divider */}
            {!disableHeader && title && <Divider />}

            {/* card content */}
            {content && (
                <CardContent
                    sx={disableContentPadding ? { px: 0, py: 0, '&:last-child': { pb: 0 }, ...contentSX } : contentSX}
                    className={contentClass}
                >
                    {children}
                </CardContent>
            )}
            {!content && children}
        </Card>
    )
})

export default MainCard
