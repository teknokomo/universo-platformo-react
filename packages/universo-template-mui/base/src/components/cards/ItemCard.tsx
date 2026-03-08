import React from 'react'
import { styled } from '@mui/material/styles'
import { Box, Grid, Typography, useTheme, Card } from '@mui/material'
import { Link } from 'react-router-dom'
import type { SxProps, Theme } from '@mui/material'
import type { PendingAction } from '@universo/utils'
import { isPendingInteractionBlocked, shouldShowPendingFeedback } from '@universo/utils'
import { deletingCardSx, pendingCardSx } from '../../styles/pendingAnimations'
import { PendingCardOverlay } from './PendingCardOverlay'

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
    href?: string
    allowStretch?: boolean
    /** Content to display at the start (left) of the footer */
    footerStartContent?: React.ReactNode
    /** Content to display at the end (right) of the footer */
    footerEndContent?: React.ReactNode
    headerAction?: React.ReactNode
    sx?: SxProps<Theme>
    /** Size of the color dot in pixels (default: 35) */
    colorDotSize?: number
    /** Whether this entity is in a pending (optimistic) state */
    pending?: boolean
    /** The pending action type — controls animation style */
    pendingAction?: PendingAction
    /** Called when a user tries to open an optimistic create/copy before it is ready. */
    onPendingInteractionAttempt?: () => void
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
    href,
    allowStretch = false,
    footerStartContent = null,
    footerEndContent = null,
    headerAction = null,
    sx = {},
    colorDotSize = 35,
    pending = false,
    pendingAction,
    onPendingInteractionAttempt
}: ItemCardProps<T>): React.ReactElement => {
    const theme = useTheme()
    const imageList = Array.isArray(images) ? images : []
    const hasImages = imageList.length > 0
    const hasFooterStartContent = Boolean(footerStartContent)
    const hasFooterEndContent = Boolean(footerEndContent)
    const showFooter = hasImages || hasFooterStartContent || hasFooterEndContent
    const interactionBlocked = pending && isPendingInteractionBlocked(data)
    // Deferred feedback: spinner + pulsating glow only after user clicks a pending entity
    const showPendingSpinner = pending && shouldShowPendingFeedback(data) && (pendingAction === 'create' || pendingAction === 'copy')

    const handleCardClick = () => {
        if (interactionBlocked) {
            onPendingInteractionAttempt?.()
            return
        }

        if (!href && !pending) {
            onClick?.()
        }
    }

    const cardContent = (
        <CardWrapper
            allowStretch={allowStretch}
            onClick={!href ? handleCardClick : undefined}
            sx={{
                border: 1,
                borderColor: theme.palette.grey[300],
                borderRadius: 1,
                cursor: interactionBlocked ? 'wait' : pending ? 'default' : href || onClick ? 'pointer' : 'default',
                ...sx,
                ...(pending && pendingAction === 'delete' ? deletingCardSx : {}),
                ...(showPendingSpinner ? pendingCardSx : {})
            }}
        >
            <Box sx={{ height: '100%', p: 2, position: 'relative' }}>
                {/* Spinner for pending create/copy cards */}
                {showPendingSpinner && pendingAction && <PendingCardOverlay action={pendingAction} />}
                {/* Header action positioned tighter to the top-right corner */}
                {headerAction && (
                    <Box
                        data-header-action
                        onClickCapture={
                            interactionBlocked
                                ? (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      onPendingInteractionAttempt?.()
                                  }
                                : undefined
                        }
                        onMouseDownCapture={
                            interactionBlocked
                                ? (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                  }
                                : undefined
                        }
                        onClick={(e) => {
                            e.stopPropagation()
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation()
                        }}
                        sx={{
                            position: 'absolute',
                            top: -12,
                            right: -12,
                            zIndex: 10,
                            ...(interactionBlocked ? { pointerEvents: 'none' as const } : {})
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
                                        width: colorDotSize,
                                        height: colorDotSize,
                                        display: 'flex',
                                        flexShrink: 0,
                                        marginRight: 10,
                                        borderRadius: '50%',
                                        background: data.color,
                                        border: colorDotSize <= 16 ? '1px solid rgba(0,0,0,0.12)' : undefined
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
                                justifyContent: 'space-between',
                                gap: 1
                            }}
                        >
                            {/* Left side: footerStartContent or images */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                {hasFooterStartContent && footerStartContent}
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
                            </Box>
                            {/* Right side: footerEndContent */}
                            {hasFooterEndContent && (
                                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{footerEndContent}</Box>
                            )}
                        </Box>
                    )}
                </Grid>
            </Box>
            {href && !pending && (
                <Link
                    to={href}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 5,
                        opacity: 0
                    }}
                />
            )}
            {href && interactionBlocked && onPendingInteractionAttempt && (
                <Box
                    component='button'
                    type='button'
                    aria-label='pending-item-interaction'
                    onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onPendingInteractionAttempt()
                    }}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 6,
                        border: 0,
                        background: 'transparent',
                        cursor: 'wait',
                        p: 0,
                        m: 0
                    }}
                />
            )}
        </CardWrapper>
    )

    return cardContent
}

export default ItemCard
