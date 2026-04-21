import { useEffect, useRef, useState } from 'react'
import { Button, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import type { QRCodeWidgetConfig } from '@universo/types'
import { useDashboardDetails } from '../DashboardDetailsContext'

const buildResolvedUrl = (explicitUrl: string, applicationId?: string | null, publicLinkSlug?: string) => {
    const normalizedExplicitUrl = typeof explicitUrl === 'string' ? explicitUrl.trim() : ''
    if (normalizedExplicitUrl) {
        if (/^https?:\/\//i.test(normalizedExplicitUrl)) {
            return normalizedExplicitUrl
        }

        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        return origin ? new URL(normalizedExplicitUrl, origin).toString() : normalizedExplicitUrl
    }

    const normalizedSlug = typeof publicLinkSlug === 'string' ? publicLinkSlug.trim() : ''
    if (!applicationId || !normalizedSlug) {
        return ''
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const path = `/public/a/${applicationId}/links/${encodeURIComponent(normalizedSlug)}`
    return origin ? new URL(path, origin).toString() : path
}

export default function QRCodeWidget({ config }: { config?: Record<string, unknown> }) {
    const { t } = useTranslation('apps')
    const details = useDashboardDetails()
    const widgetConfig = (config ?? {}) as unknown as QRCodeWidgetConfig
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const resetCopiedTimeoutRef = useRef<number | null>(null)
    const [copied, setCopied] = useState(false)

    const url = buildResolvedUrl(widgetConfig.url || '', details?.applicationId, widgetConfig.publicLinkSlug)
    const size = widgetConfig.size || 256
    const title = widgetConfig.title || t('qrCode.defaultTitle', 'Scan QR Code')

    useEffect(() => {
        if (!url || !canvasRef.current) return

        void QRCode.toCanvas(canvasRef.current, url, {
            width: size,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        }).catch(() => undefined)
    }, [url, size])

    useEffect(
        () => () => {
            if (resetCopiedTimeoutRef.current !== null) {
                window.clearTimeout(resetCopiedTimeoutRef.current)
            }
        },
        []
    )

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            if (resetCopiedTimeoutRef.current !== null) {
                window.clearTimeout(resetCopiedTimeoutRef.current)
            }
            resetCopiedTimeoutRef.current = window.setTimeout(() => {
                setCopied(false)
                resetCopiedTimeoutRef.current = null
            }, 2000)
        } catch {
            setCopied(false)
        }
    }

    if (!url) {
        return (
            <Card variant='outlined'>
                <CardContent>
                    <Typography variant='body2' color='text.secondary'>
                        {t('qrCode.noUrl', 'No URL configured for QR code generation.')}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card variant='outlined'>
            <CardHeader title={title} />
            <CardContent>
                <Stack spacing={2} alignItems='center'>
                    <canvas ref={canvasRef} />
                    <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-all', textAlign: 'center' }}>
                        {url}
                    </Typography>
                    <Button variant='outlined' startIcon={<ContentCopyIcon />} onClick={handleCopy} size='small'>
                        {copied ? t('qrCode.copied', 'Copied!') : t('qrCode.copyLink', 'Copy link')}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )
}
