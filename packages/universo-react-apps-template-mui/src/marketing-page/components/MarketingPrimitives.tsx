import * as React from 'react'
import type { ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import Box from '@mui/material/Box'
import Button, { type ButtonProps } from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded'
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import EdgesensorHighRoundedIcon from '@mui/icons-material/EdgesensorHighRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded'
import ViewQuiltRoundedIcon from '@mui/icons-material/ViewQuiltRounded'
import GitHubIcon from '@mui/icons-material/GitHub'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import XIcon from '@mui/icons-material/X'
import { useColorScheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import { parseSafeExternalUrl } from '@universo-react/types'
import { parseMarketingActionHref, toMarketingActionLinkAttributes } from '@universo-react/utils'

import type { MarketingAction, MarketingActionHandler, MarketingIconKey, MarketingMedia, MarketingSectionCopy } from '../types'
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown'

export const MARKETING_SECTION_ANCHORS = {
    hero: 'hero',
    logoCollection: 'logoCollection',
    features: 'features',
    testimonials: 'testimonials',
    highlights: 'highlights',
    pricing: 'pricing',
    faq: 'faq',
    footer: 'footer'
} as const

const MARKETING_SECTION_ANCHOR_VALUES: ReadonlySet<string> = new Set(Object.values(MARKETING_SECTION_ANCHORS))
const UNSAFE_MARKETING_CONTROL_RE = new RegExp(String.raw`[\u0000-\u001f\u007f\s]`)

const ICONS: Record<MarketingIconKey, React.ComponentType<SvgIconProps>> = {
    autoFixHigh: AutoFixHighRoundedIcon,
    autoAwesome: AutoAwesomeRoundedIcon,
    construction: ConstructionRoundedIcon,
    devices: DevicesRoundedIcon,
    edgesensor: EdgesensorHighRoundedIcon,
    queryStats: QueryStatsRoundedIcon,
    settingsSuggest: SettingsSuggestRoundedIcon,
    supportAgent: SupportAgentRoundedIcon,
    thumbUp: ThumbUpAltRoundedIcon,
    viewQuilt: ViewQuiltRoundedIcon,
    github: GitHubIcon,
    x: XIcon,
    linkedin: LinkedInIcon
}

const isSafeRelativePath = (value: string): boolean => {
    if (value.startsWith('//') || !value.startsWith('/') || value.includes('\\') || UNSAFE_MARKETING_CONTROL_RE.test(value)) return false

    try {
        const parsed = new URL(value, 'https://platform.invalid')
        return parsed.origin === 'https://platform.invalid' && !parsed.username && !parsed.password
    } catch {
        return false
    }
}

const isSafeSectionHash = (value: string): boolean => value.startsWith('#') && MARKETING_SECTION_ANCHOR_VALUES.has(value.slice(1))

const isSafeExternalUrl = (value: string): boolean => {
    if (value.startsWith('//') || UNSAFE_MARKETING_CONTROL_RE.test(value)) return false

    try {
        parseSafeExternalUrl(value)
        return true
    } catch {
        return false
    }
}

export interface ResolvedMarketingAction {
    href: string
    target?: '_self' | '_blank'
    rel?: 'noopener noreferrer'
}

export function resolveMarketingAction(action?: MarketingAction): ResolvedMarketingAction | null {
    if (!action || typeof action.href !== 'string' || typeof action.label !== 'string' || !action.label.trim()) return null

    const canonical = parseMarketingActionHref(action.href, {
        externalTarget: action.target === '_blank' ? 'new-tab' : 'same-tab'
    })
    if (!canonical) return null

    const expectedKind = action.actionKind === 'mailto' ? 'email' : action.actionKind
    const kindMatches =
        (expectedKind === 'internal' && (canonical.kind === 'internal' || canonical.kind === 'anchor')) || canonical.kind === expectedKind
    if (!kindMatches) return null
    if (canonical.kind === 'anchor' && !isSafeSectionHash(canonical.href)) return null

    const attributes = toMarketingActionLinkAttributes(canonical)
    return {
        href: attributes.href,
        target: attributes.target,
        rel: attributes.rel
    }
}

export function isSafeMarketingMediaSource(value: string): boolean {
    const src = value.trim()
    if (!src || src.startsWith('//') || UNSAFE_MARKETING_CONTROL_RE.test(src)) return false
    if (src.startsWith('/')) return isSafeRelativePath(src)
    return isSafeExternalUrl(src)
}

export function sortVisibleMarketingItems<T extends { order?: number; visible?: boolean; isVisible?: boolean }>(items: T[]): T[] {
    return items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.visible !== false && item.isVisible !== false)
        .sort((left, right) => (left.item.order ?? left.index) - (right.item.order ?? right.index) || left.index - right.index)
        .map(({ item }) => item)
}

export function MarketingIcon({ name, ...props }: MarketingIconProps & SvgIconProps) {
    if (!name) return null
    const Icon = ICONS[name]
    return Icon ? <Icon {...props} aria-hidden='true' focusable='false' /> : null
}

export function MarketingSectionHeader({
    section,
    id,
    inverse = false
}: {
    section: MarketingSectionCopy
    id: string
    /** Use a light-on-dark heading treatment for sections with an inverted surface. */
    inverse?: boolean
}) {
    return (
        <Box
            sx={{
                width: { sm: '100%', md: '60%' },
                textAlign: { sm: 'left', md: 'center' }
            }}
        >
            <Typography
                component='h2'
                id={`${id}-title`}
                variant='h4'
                gutterBottom
                sx={{ color: inverse ? 'common.white' : 'text.primary' }}
            >
                {section.title}
            </Typography>
            {section.description ? (
                <Typography variant='body1' sx={{ color: inverse ? 'grey.200' : 'text.secondary' }}>
                    {section.description}
                </Typography>
            ) : null}
        </Box>
    )
}

export function MarketingEmptyState({ section }: { section: string }) {
    const { t } = useTranslation('apps')
    return (
        <Typography role='status' variant='body2' sx={{ color: 'text.secondary', py: 2 }}>
            {t('marketingPage.empty', { section })}
        </Typography>
    )
}

export interface MarketingActionButtonProps extends Omit<ButtonProps, 'action' | 'onClick'> {
    action?: MarketingAction
    onAction?: MarketingActionHandler
    children?: ReactNode
}

export const invokeMarketingAction = (
    event: React.MouseEvent<HTMLElement>,
    action: MarketingAction,
    onAction?: MarketingActionHandler
): void => {
    // Hosts can handle application-relative routes without a full document
    // reload. Hash, external, mailto and tel actions retain the browser's
    // native navigation semantics.
    if (onAction && action.actionKind === 'internal' && action.href.startsWith('/')) {
        event.preventDefault()
    }
    onAction?.(action)
}

export function MarketingActionButton({ action, onAction, children, ...props }: MarketingActionButtonProps) {
    const resolved = resolveMarketingAction(action)
    if (!resolved || !action) return null
    const AnchorButton = Button as React.ElementType

    return (
        <AnchorButton
            {...props}
            href={resolved.href}
            target={resolved.target}
            rel={resolved.rel}
            onClick={(event: React.MouseEvent<HTMLElement>) => invokeMarketingAction(event, action, onAction)}
        >
            {children ?? action.label}
        </AnchorButton>
    )
}

export function MarketingActionLink({
    action,
    onAction,
    sx,
    children
}: {
    action?: MarketingAction
    onAction?: MarketingActionHandler
    sx?: SxProps<Theme>
    children?: ReactNode
}) {
    const resolved = resolveMarketingAction(action)
    if (!resolved || !action) return null

    return (
        <Link
            href={resolved.href}
            target={resolved.target}
            rel={resolved.rel}
            onClick={(event) => invokeMarketingAction(event, action, onAction)}
            color='text.secondary'
            variant='body2'
            sx={sx}
        >
            {children ?? action.label}
        </Link>
    )
}

export function MarketingMediaView({
    media,
    sx,
    className,
    loading = 'lazy'
}: {
    media?: MarketingMedia
    sx?: SxProps<Theme>
    className?: string
    loading?: 'eager' | 'lazy'
}) {
    const { t } = useTranslation('apps')
    const { mode, systemMode } = useColorScheme()
    const [failedSources, setFailedSources] = React.useState<ReadonlySet<string>>(new Set())

    React.useEffect(() => {
        setFailedSources(new Set())
    }, [media?.src, media?.darkSrc, media?.resource?.url, media?.darkResource?.url])

    if (!media) return null

    const prefersDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark')
    const candidateSources = prefersDark
        ? [media.darkSrc, media.darkResource?.url, media.src, media.resource?.url]
        : [media.src, media.resource?.url, media.darkSrc, media.darkResource?.url]
    const validSource =
        candidateSources.find(
            (candidate): candidate is string =>
                typeof candidate === 'string' &&
                candidate.length > 0 &&
                isSafeMarketingMediaSource(candidate) &&
                !failedSources.has(candidate)
        ) ?? null
    const alt = media.decorative ? '' : media.alt.trim() || t('marketingPage.mediaMissing')

    if (!validSource) {
        return (
            <Box
                role={media.decorative ? undefined : 'img'}
                aria-label={media.decorative ? undefined : alt}
                aria-hidden={media.decorative || undefined}
                sx={sx}
                className={className}
            >
                <Typography variant='body2' sx={{ color: 'text.secondary', p: 2 }}>
                    {media.resource?.storageKey || media.darkResource?.storageKey
                        ? t('marketingPage.mediaDeferred', 'Media is configured but is not available in this runtime.')
                        : t('marketingPage.mediaMissing')}
                </Typography>
            </Box>
        )
    }

    return (
        <Box
            component='img'
            src={validSource}
            alt={alt}
            loading={loading}
            decoding='async'
            referrerPolicy='no-referrer'
            onError={() =>
                setFailedSources((previous) => {
                    if (previous.has(validSource)) return previous
                    return new Set([...previous, validSource])
                })
            }
            aria-hidden={media.decorative || undefined}
            sx={sx}
            className={className}
        />
    )
}

export interface MarketingColorModeControlProps {
    size?: 'small' | 'medium'
}

export function MarketingColorModeControl({ size = 'small' }: MarketingColorModeControlProps) {
    const { t } = useTranslation('apps')
    return (
        <ColorModeIconDropdown
            size={size}
            aria-label={t('marketingPage.colorMode.label')}
            labels={{
                system: t('marketingPage.colorMode.system'),
                light: t('marketingPage.colorMode.light'),
                dark: t('marketingPage.colorMode.dark')
            }}
        />
    )
}

export interface MarketingIconProps extends SvgIconProps {
    name?: MarketingIconKey
}
