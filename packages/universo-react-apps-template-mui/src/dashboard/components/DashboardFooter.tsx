import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { sanitizeMenuHref } from '@universo-react/utils'
import { useTranslation } from 'react-i18next'

import { useDashboardDetails } from '../DashboardDetailsContext'
import { RuntimeWidgetStatus } from './RuntimeWidgetStatus'

const spacingByVariant = {
    compact: 1,
    standard: 2,
    spacious: 4
} as const

const alignmentByVariant = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end'
} as const

export default function DashboardFooter({ config }: { config: unknown }) {
    const { t } = useTranslation('apps')
    const details = useDashboardDetails()
    const parsed = dashboardWidgetConfigSchemaByKey.footer.safeParse(config)
    if (!parsed.success) return <RuntimeWidgetStatus invalid />

    const metadata = details?.footerMetadata
    if (!metadata) return null

    const alignment = parsed.data.alignment ?? 'left'
    const spacing = spacingByVariant[parsed.data.spacing ?? 'standard']
    const legalLinks =
        parsed.data.showLegalLinks ?? true
            ? (metadata.legalLinks ?? []).flatMap((link) => {
                  const href = sanitizeMenuHref(link.href)
                  return href && link.label.trim() ? [{ ...link, href }] : []
              })
            : []
    const contactLinks =
        parsed.data.showContact ?? true
            ? (metadata.contactLinks ?? []).flatMap((link) => {
                  const href = sanitizeMenuHref(link.href)
                  return href && link.label.trim() ? [{ ...link, href }] : []
              })
            : []
    const siteName = metadata.siteName.trim()
    if (!siteName && legalLinks.length === 0 && contactLinks.length === 0) return null

    return (
        <Box
            component='footer'
            data-testid='runtime-footer-widget'
            sx={{
                width: '100%',
                minWidth: 0,
                py: spacing,
                display: 'flex',
                flexDirection: 'column',
                alignItems: alignmentByVariant[alignment],
                textAlign: alignment
            }}
        >
            {siteName ? (
                <Typography variant='body2' color='text.secondary'>
                    © {new Date().getFullYear()} {siteName}
                </Typography>
            ) : null}
            {legalLinks.length > 0 ? (
                <Stack
                    component='nav'
                    aria-label={t('dashboard.widget.footer.legal', 'Legal links')}
                    direction='row'
                    spacing={1.5}
                    useFlexGap
                    sx={{ flexWrap: 'wrap', justifyContent: alignmentByVariant[alignment] }}
                >
                    {legalLinks.map((link) => (
                        <Link key={link.label + ':' + link.href} href={link.href} variant='body2'>
                            {link.label}
                        </Link>
                    ))}
                </Stack>
            ) : null}
            {contactLinks.length > 0 ? (
                <Stack
                    component='nav'
                    aria-label={t('dashboard.widget.footer.contact', 'Contact links')}
                    direction='row'
                    spacing={1.5}
                    useFlexGap
                    sx={{ flexWrap: 'wrap', justifyContent: alignmentByVariant[alignment] }}
                >
                    {contactLinks.map((link) => (
                        <Link key={link.label + ':' + link.href} href={link.href} variant='body2'>
                            {link.label}
                        </Link>
                    ))}
                </Stack>
            ) : null}
        </Box>
    )
}
