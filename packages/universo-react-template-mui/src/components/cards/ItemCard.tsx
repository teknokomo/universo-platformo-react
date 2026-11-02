import React from 'react'
import { useTranslation } from 'react-i18next'
import { styled } from '@mui/material/styles'
import { Box, ButtonBase, Grid, Tooltip, Typography, useTheme, Card } from '@mui/material'
import { Link } from 'react-router-dom'
import type { SxProps, Theme } from '@mui/material'
import type { PendingAction } from '@universo-react/utils'
import { isPendingInteractionBlocked, shouldShowPendingFeedback } from '@universo-react/utils'
import { deletingCardSx, pendingCardSx } from '../../styles/pendingAnimations'
import { PendingCardOverlay } from './PendingCardOverlay'

// Generic data interface with common fields
export interface ItemCardData {
    iconSrc?: string
    color?: string
    templateName?: string
    name?: string
    description?: string
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    data: T
    images?: string[]
    onClick?: () => void
    /** Accessible name for a full-card action button, kept separate from header controls. */
    actionLabel?: string
    href?: string
    allowStretch?: boolean
    /** Content to display at the start (left) of the footer */
    footerStartContent?: React.ReactNode
    /** Content to display at the end (right) of the footer */
    footerEndContent?: React.ReactNode
    /** Stack footer content below the start content on narrow viewports. */
    footerStackOnMobile?: boolean
    /** Content to display next to the title */
    titleEndContent?: React.ReactNode
    /** Full title text to reveal when the visible title is truncated. */
    titleTooltip?: string
    /** Wrap long titles instead of truncating them to one line. */
    wrapTitle?: boolean
    /** Show the full description instead of clamping it to two lines. */
    wrapDescription?: boolean
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
    '&:focus-within': {
        boxShadow: `inset 0 0 0 3px ${theme.palette.primary.main}`
    },
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
    actionLabel,
    href,
    allowStretch = false,
    footerStartContent = null,
    footerEndContent = null,
    footerStackOnMobile = false,
    titleEndContent = null,
    titleTooltip,
    wrapTitle = false,
    wrapDescription = false,
    headerAction = null,
    sx = {},
    colorDotSize = 35,
    pending = false,
    pendingAction,
    onPendingInteractionAttempt
}: ItemCardProps<T>): React.ReactElement => {
    const { t } = useTranslation('common')
    const theme = useTheme()
    const imageList = Array.isArray(images) ? images : []
    const hasImages = imageList.length > 0
    const hasFooterStartContent = Boolean(footerStartContent)
    const hasFooterEndContent = Boolean(footerEndContent)
    const showFooter = hasImages || hasFooterStartContent || hasFooterEndContent
    const interactionBlocked = pending && isPendingInteractionBlocked(data)
    const cardTitleText = data.templateName?.trim() || data.name?.trim() || ''
    const buildAccessibleActionName = (label?: string): string => {
        const normalizedLabel = label?.trim()
        if (!cardTitleText) return normalizedLabel || t('openItem', 'Open item')
        if (!normalizedLabel || normalizedLabel.includes(cardTitleText)) return normalizedLabel || cardTitleText
        return `${cardTitleText} — ${normalizedLabel}`
    }
    const hasActionButton = Boolean(onClick && !href)
    const linkAccessibleName = buildAccessibleActionName(titleTooltip)
    const buttonAccessibleName = buildAccessibleActionName(actionLabel)
    // Deferred feedback: spinner + pulsating glow only after user clicks a pending entity
    const showPendingSpinner = pending && shouldShowPendingFeedback(data) && (pendingAction === 'create' || pendingAction === 'copy')
    const cardTitle = (
        <Typography
            aria-label={titleTooltip}
            sx={{
                fontSize: '1.25rem',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: wrapTitle ? 'normal' : 'nowrap',
                overflowWrap: wrapTitle ? 'anywhere' : undefined,
                wordBreak: wrapTitle ? 'break-word' : undefined,
                minWidth: 0,
                flexShrink: 1
            }}
        >
            {cardTitleText}
        </Typography>
    )

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
            onClick={!href && !hasActionButton ? handleCardClick : undefined}
            sx={{
                border: 1,
                borderColor: theme.palette.grey[300],
                borderRadius: 1,
                cursor: interactionBlocked ? 'wait' : pending ? 'default' : href || onClick ? 'pointer' : 'default',
                ...(footerStackOnMobile
                    ? {
                          height: { xs: 'auto', sm: '180px' },
                          minHeight: { xs: '180px', sm: '180px' }
                      }
                    : {}),
                ...sx,
                ...(wrapTitle || wrapDescription ? { height: 'auto', minHeight: '180px' } : {}),
                ...(pending && pendingAction === 'delete' ? deletingCardSx : {}),
                ...(showPendingSpinner ? pendingCardSx : {})
            }}
        >
            {hasActionButton && (
                <ButtonBase
                    type='button'
                    disableRipple
                    aria-label={buttonAccessibleName}
                    aria-disabled={pending || undefined}
                    onClick={handleCardClick}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        border: 0,
                        borderRadius: 'inherit',
                        p: 0,
                        color: 'inherit',
                        backgroundColor: 'transparent',
                        cursor: interactionBlocked ? 'wait' : pending ? 'default' : 'pointer',
                        '&:focus-visible': {
                            outline: `3px solid ${theme.palette.primary.main}`,
                            outlineOffset: '-3px'
                        }
                    }}
                />
            )}
            <Box sx={{ height: footerStackOnMobile ? { xs: 'auto', sm: '100%' } : '100%', p: 2, position: 'relative' }}>
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
                <Grid
                    container
                    sx={{
                        height: footerStackOnMobile ? { xs: 'auto', sm: '100%' } : '100%',
                        gap: 1.5,
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}
                >
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                                {titleTooltip ? <Tooltip title={titleTooltip}>{cardTitle}</Tooltip> : cardTitle}
                                {titleEndContent ? <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>{titleEndContent}</Box> : null}
                            </Box>
                        </div>
                        {data.description && (
                            <Typography
                                sx={{
                                    display: wrapDescription ? 'block' : '-webkit-box',
                                    mt: 1.25,
                                    fontSize: '0.875rem',
                                    ...(wrapDescription
                                        ? { overflow: 'visible', overflowWrap: 'anywhere' }
                                        : {
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: 'vertical',
                                              textOverflow: 'ellipsis',
                                              overflow: 'hidden'
                                          }),
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
                                position: 'relative',
                                zIndex: 6,
                                display: 'flex',
                                flexDirection: footerStackOnMobile ? { xs: 'column', sm: 'row' } : 'row',
                                alignItems: footerStackOnMobile ? { xs: 'stretch', sm: 'center' } : 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                width: '100%',
                                minWidth: 0
                            }}
                        >
                            {/* Left side: footerStartContent or images */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    flexShrink: footerStackOnMobile ? { xs: 1, sm: 0 } : 0,
                                    minWidth: 0
                                }}
                            >
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
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        alignSelf: footerStackOnMobile ? { xs: 'flex-end', sm: 'auto' } : 'auto',
                                        flexShrink: 0
                                    }}
                                >
                                    {footerEndContent}
                                </Box>
                            )}
                        </Box>
                    )}
                </Grid>
            </Box>
            {href && !pending && (
                <Link
                    to={href}
                    aria-label={linkAccessibleName}
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
