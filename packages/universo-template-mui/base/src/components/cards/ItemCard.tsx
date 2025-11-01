import React from 'react'
import { styled } from '@mui/material/styles'
import { Box, Grid, Typography, useTheme, Card } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

// Generic data interface with common fields
export interface ItemCardData {
    iconSrc?: string
    color?: string
    templateName?: string
    name?: string
    description?: string
    [key: string]: any
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    data: T
    images?: any[]
    onClick?: () => void
    allowStretch?: boolean
    footerEndContent?: React.ReactNode
    headerAction?: React.ReactNode
    sx?: SxProps<Theme>
}

// Use Card instead of MainCard for new UI
const CardWrapper = styled(Card, {
    shouldForwardProp: (prop) => prop !== 'allowStretch'
})<{ allowStretch?: boolean }>(({ theme, allowStretch }) => ({
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)',
    cursor: 'pointer',
    '&:hover': {
        background: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
        boxShadow: '0 2px 14px 0 rgb(32 40 45 / 20%)'
    },
    height: '180px',
    minWidth: 220,
    maxWidth: allowStretch ? '100%' : 360,
    width: '100%',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-line'
}))

// ===========================|| ITEM CARD ||=========================== //

export const ItemCard = <T extends ItemCardData = ItemCardData>({
    data,
    images,
    onClick,
    allowStretch = false,
    footerEndContent = null,
    headerAction = null,
    sx = {}
}: ItemCardProps<T>): React.ReactElement => {
    const theme = useTheme()
    const imageList = Array.isArray(images) ? images : []
    const hasImages = imageList.length > 0
    const hasFooterEndContent = Boolean(footerEndContent)
    const showFooter = hasImages || hasFooterEndContent

    return (
        <CardWrapper
            allowStretch={allowStretch}
            onClick={onClick}
            sx={{ border: 1, borderColor: theme.palette.grey[300], borderRadius: 1, ...sx }}
        >
            <Box sx={{ height: '100%', p: 2, position: 'relative' }}>
                {/* Header action positioned tighter to the top-right corner */}
                {headerAction && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -12,
                            right: -12,
                            zIndex: 1
                        }}
                    >
                        {headerAction}
                    </Box>
                )}
                <Grid container justifyContent='space-between' direction='column' sx={{ height: '100%', gap: 1.5 }}>
                    <Box display='flex' flexDirection='column' sx={{ width: '100%' }}>
                        <div
                            style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                overflow: 'hidden'
                            }}
                        >
                            {data.iconSrc && (
                                <div
                                    style={{
                                        width: 35,
                                        height: 35,
                                        display: 'flex',
                                        flexShrink: 0,
                                        marginRight: 10,
                                        borderRadius: '50%',
                                        backgroundImage: `url(${data.iconSrc})`,
                                        backgroundSize: 'contain',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'center center'
                                    }}
                                ></div>
                            )}
                            {!data.iconSrc && data.color && (
                                <div
                                    style={{
                                        width: 35,
                                        height: 35,
                                        display: 'flex',
                                        flexShrink: 0,
                                        marginRight: 10,
                                        borderRadius: '50%',
                                        background: data.color
                                    }}
                                ></div>
                            )}
                            <Typography
                                sx={{
                                    fontSize: '1.25rem',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                    flexShrink: 1
                                }}
                            >
                                {data.templateName || data.name}
                            </Typography>
                        </div>
                        {data.description && (
                            <Typography
                                sx={{
                                    display: '-webkit-box',
                                    mt: 1.25,
                                    fontSize: '0.875rem',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    wordBreak: 'break-word'
                                }}
                            >
                                {data.description}
                            </Typography>
                        )}
                    </Box>
                    {showFooter && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent:
                                    hasImages && hasFooterEndContent ? 'space-between' : hasFooterEndContent ? 'flex-end' : 'flex-start',
                                gap: 1
                            }}
                        >
                            {hasImages && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'start',
                                        gap: 1,
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    {imageList.slice(0, imageList.length > 3 ? 3 : imageList.length).map((img, index) => (
                                        <Box
                                            key={`${img}-${index}`}
                                            sx={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: '50%',
                                                backgroundColor:
                                                    theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.grey[300]
                                            }}
                                        >
                                            <img
                                                style={{ width: '100%', height: '100%', padding: 5, objectFit: 'contain' }}
                                                alt=''
                                                src={img}
                                            />
                                        </Box>
                                    ))}
                                    {imageList.length > 3 && (
                                        <Typography sx={{ alignItems: 'center', display: 'flex', fontSize: '.9rem', fontWeight: 200 }}>
                                            + {imageList.length - 3} More
                                        </Typography>
                                    )}
                                </Box>
                            )}
                            {hasFooterEndContent && (
                                <Box sx={{ display: 'flex', alignItems: 'center', ml: hasImages ? 1 : 0 }}>{footerEndContent}</Box>
                            )}
                        </Box>
                    )}
                </Grid>
            </Box>
        </CardWrapper>
    )
}

export default ItemCard
