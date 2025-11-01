// Universo Platformo | QR Code Section Component
// Reusable component for generating QR codes from publication URLs

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'react-qr-code'
import { Box, Typography, Switch, FormControlLabel, CircularProgress, Alert, Paper, Button, Snackbar } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { downloadQRCode } from '../utils/svgToPng'

/**
 * Props for QRCodeSection component
 */
interface QRCodeSectionProps {
    /** The URL to generate QR code for */
    publishedUrl: string | null | undefined
    /** Whether the component is disabled */
    disabled?: boolean
    /** Callback when QR code toggle changes */
    onToggle?: (enabled: boolean) => void
}

/**
 * Snackbar state
 */
interface SnackbarState {
    open: boolean
    message: string
}

/**
 * Validates if the provided URL is safe for QR code generation
 * @param url - URL to validate
 * @returns Whether the URL is valid
 */
const isValidUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url)
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
        return false
    }
}

/**
 * QR Code Section Component
 * Displays a toggle to generate QR code for publication URLs
 */
const QRCodeSection: React.FC<QRCodeSectionProps> = ({ publishedUrl, disabled = false, onToggle = () => {} }) => {
    const { t } = useTranslation('publish')
    const [showQRCode, setShowQRCode] = useState<boolean>(false)
    const [isGenerating, setIsGenerating] = useState<boolean>(false)
    const [isDownloading, setIsDownloading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '' })
    const qrCodeRef = useRef<HTMLDivElement>(null)

    // Reset state when URL changes
    useEffect(() => {
        if (!publishedUrl) {
            setShowQRCode(false)
            setError(null)
        }
    }, [publishedUrl])

    const handleToggleQRCode = async (checked: boolean): Promise<void> => {
        if (!publishedUrl) return

        setError(null)

        if (checked) {
            // Validate URL before generating QR code
            if (!isValidUrl(publishedUrl)) {
                setError(t('qrCode.invalidUrl'))
                return
            }

            setIsGenerating(true)
            try {
                // Simulate generation delay for better UX
                await new Promise((resolve) => setTimeout(resolve, 300))
                setShowQRCode(true)
                onToggle(true)
            } catch (err) {
                setError(t('qrCode.error'))
                console.error('QR Code generation error:', err)
            } finally {
                setIsGenerating(false)
            }
        } else {
            setShowQRCode(false)
            onToggle(false)
        }
    }

    const handleDownloadQRCode = async (): Promise<void> => {
        if (!qrCodeRef.current || !publishedUrl) return

        setIsDownloading(true)
        setError(null)

        try {
            // Find the SVG element within the QR code container
            const svgElement = qrCodeRef.current.querySelector('svg')
            if (!svgElement) {
                throw new Error('SVG element not found')
            }

            // Download QR code using utility function
            await downloadQRCode(svgElement, publishedUrl)

            // Show success notification
            setSnackbar({ open: true, message: t('qrCode.downloadSuccess') })
        } catch (err) {
            setError(t('qrCode.downloadError'))
            console.error('QR Code download error:', err)
        } finally {
            setIsDownloading(false)
        }
    }

    /**
     * Handle snackbar close
     */
    const handleSnackbarClose = (): void => {
        setSnackbar({ ...snackbar, open: false })
    }

    // Don't render if no URL is available
    if (!publishedUrl) return null

    return (
        <Box sx={{ my: 2 }}>
            {/* QR Code Toggle */}
            <FormControlLabel
                control={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Switch
                            checked={showQRCode}
                            onChange={(e) => handleToggleQRCode(e.target.checked)}
                            disabled={disabled || isGenerating}
                            color='primary'
                            inputProps={{
                                'aria-label': t('qrCode.toggle'),
                                role: 'switch'
                            }}
                        />
                        {isGenerating && <CircularProgress size={20} sx={{ ml: 1 }} aria-label={t('common.loading', 'Loading...')} />}
                    </Box>
                }
                label={t('qrCode.toggle')}
                sx={{
                    width: '100%',
                    m: 0,
                    '& .MuiFormControlLabel-label': {
                        width: '100%',
                        flexGrow: 1
                    }
                }}
                labelPlacement='start'
            />

            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                {t('qrCode.description')}
            </Typography>

            {/* Error Display */}
            {error && (
                <Alert severity='error' sx={{ mt: 2 }} role='alert' aria-live='assertive'>
                    {error}
                </Alert>
            )}

            {/* QR Code Display */}
            {showQRCode && !isGenerating && !error && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant='body2' gutterBottom>
                        {t('qrCode.scanInstruction')}
                    </Typography>
                    <Paper
                        ref={qrCodeRef}
                        elevation={1}
                        sx={{
                            display: 'inline-block',
                            p: 2,
                            bgcolor: 'white',
                            borderRadius: 1
                        }}
                    >
                        <QRCode
                            value={publishedUrl}
                            size={180}
                            level='M'
                            fgColor='#000000'
                            bgColor='#FFFFFF'
                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                        />
                    </Paper>

                    {/* Download Button */}
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant='outlined'
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadQRCode}
                            disabled={isDownloading || disabled}
                            size='small'
                            aria-label={isDownloading ? t('qrCode.downloading') : t('qrCode.download')}
                        >
                            {isDownloading ? t('qrCode.downloading') : t('qrCode.download')}
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Success Notification */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

export default QRCodeSection
