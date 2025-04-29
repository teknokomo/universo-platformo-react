// Universo Platformo | Publisher Component
// Main component for publishing UPDL flows

import React, { useState } from 'react'
import { PublisherProps, PublishResult } from '../interfaces/PublisherProps'
import { ExporterSelector } from './ExporterSelector'
import { ARJSPublisher } from '../miniapps/arjs/ARJSPublisher'
import { publishFlow } from '../services/api'

/**
 * Main Publisher component for publishing UPDL flows
 */
export const Publisher: React.FC<PublisherProps> = ({ flow, onPublish, onCancel, initialConfig }) => {
    // State for selected exporter
    const [selectedExporterId, setSelectedExporterId] = useState<string>(initialConfig?.exporterId || '')

    // State for publishing status
    const [isPublishing, setIsPublishing] = useState<boolean>(false)

    // State for errors
    const [error, setError] = useState<string | null>(null)

    /**
     * Handle exporter selection
     */
    const handleExporterSelect = (exporterId: string) => {
        setSelectedExporterId(exporterId)
        setError(null)
    }

    /**
     * Handle generic publish
     */
    const handleGenericPublish = async (options: any = {}) => {
        if (!selectedExporterId) {
            setError('Please select an exporter')
            return
        }

        try {
            setIsPublishing(true)
            setError(null)

            const result = await publishFlow(flow.id, selectedExporterId, options)
            onPublish(result)
        } catch (err: any) {
            setError(err.message || 'Failed to publish flow')
            onPublish({
                success: false,
                error: err.message || 'Failed to publish flow',
                publishedUrl: '',
                metadata: {}
            })
        } finally {
            setIsPublishing(false)
        }
    }

    /**
     * Handle cancellation
     */
    const handleCancel = () => {
        onCancel()
    }

    /**
     * Render specific miniapp based on selected exporter
     */
    const renderMiniApp = () => {
        if (!selectedExporterId) {
            return null
        }

        switch (selectedExporterId) {
            case 'arjs':
                return <ARJSPublisher flow={flow} onPublish={onPublish} onCancel={onCancel} initialConfig={initialConfig?.options} />

            default:
                return (
                    <div className='generic-publisher'>
                        <h3>Publish to {selectedExporterId}</h3>
                        {error && <p className='error-message'>{error}</p>}
                        <div className='publisher-actions'>
                            <button className='cancel-button' onClick={handleCancel} disabled={isPublishing}>
                                Cancel
                            </button>
                            <button
                                className='publish-button'
                                onClick={() => handleGenericPublish(initialConfig?.options)}
                                disabled={isPublishing}
                            >
                                {isPublishing ? 'Publishing...' : 'Publish'}
                            </button>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className='publisher-container'>
            <h2>Publish Your Experience</h2>
            <p>Flow: {flow.name}</p>

            <div className='publisher-content'>
                <div className='exporter-selection'>
                    <ExporterSelector onSelect={handleExporterSelect} initialExporterId={selectedExporterId} isLoading={isPublishing} />
                </div>

                <div className='miniapp-container'>{renderMiniApp()}</div>
            </div>
        </div>
    )
}
