// Universo Platformo | AR Preview Pane Component
// Component for displaying AR instructions and QR code

import React from 'react'
import { Box, Typography } from '@mui/material'
import { PublicationLinks } from '../../../components/PublicationLinks'
import QRCodeSection from '../../../components/QRCodeSection'
import type { PublicationLink, ARDisplayType, MarkerType } from '../../../types'

export interface ARPreviewPaneProps {
    publishLinkRecords: PublicationLink[]
    publishedUrl: string
    arDisplayType: ARDisplayType
    markerType?: MarkerType
    markerValue?: string
    isPublishing: boolean
    onDownloadSuccess: (message: string) => void
}

/**
 * AR Preview Pane Component
 * Displays publication links, QR code, and usage instructions
 */
export const ARPreviewPane = React.memo<ARPreviewPaneProps>(
    ({ publishLinkRecords, publishedUrl, arDisplayType, markerType, markerValue, isPublishing }) => {
        if (publishLinkRecords.length === 0) {
            return null
        }

        return (
            <>
                {/* Publication Links Component */}
                <PublicationLinks links={publishLinkRecords} technology='arjs' />

                {/* QR Code Section */}
                {publishedUrl && <QRCodeSection publishedUrl={publishedUrl} disabled={isPublishing} />}

                {/* Usage Instructions */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant='body2' gutterBottom>
                        Инструкция по использованию:
                    </Typography>
                    <Box sx={{ textAlign: 'left', pl: 2 }}>
                        <Typography variant='body2' component='div'>
                            {arDisplayType === 'wallpaper' ? (
                                <ol>
                                    <li>Разрешите доступ к камере</li>
                                    <li>Маркер не требуется — фон появится автоматически</li>
                                    <li>Проходите квиз</li>
                                </ol>
                            ) : (
                                <ol>
                                    <li>Откройте URL на устройстве с камерой</li>
                                    <li>Разрешите доступ к камере</li>
                                    <li>Наведите камеру на маркер {markerType === 'preset' ? `"${markerValue}"` : ''}</li>
                                    <li>Дождитесь появления 3D объекта</li>
                                </ol>
                            )}
                        </Typography>
                    </Box>
                </Box>
            </>
        )
    }
)

ARPreviewPane.displayName = 'ARPreviewPane'
