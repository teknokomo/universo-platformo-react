// Universo Platformo | Exporter Selector
// React component for selecting an exporter

import React, { useEffect, useState } from 'react'
import { getExporters, ExporterInfo } from '../services/api'
import { ExporterSelectorProps } from '../interfaces/types'

/**
 * Component for selecting an exporter
 */
export const ExporterSelector: React.FC<ExporterSelectorProps> = ({ onSelect, initialExporterId, isLoading = false }) => {
    // State for exporters
    const [exporters, setExporters] = useState<ExporterInfo[]>([])

    // State for loading state
    const [loading, setLoading] = useState<boolean>(true)

    // State for error
    const [error, setError] = useState<string | null>(null)

    // State for selected exporter
    const [selectedExporterId, setSelectedExporterId] = useState<string | null>(initialExporterId || null)

    // Fetch exporters on mount
    useEffect(() => {
        const fetchExporters = async () => {
            try {
                setLoading(true)
                setError(null)

                const exporterList = await getExporters()
                setExporters(exporterList)

                // Select first exporter if none is selected
                if (!selectedExporterId && exporterList.length > 0) {
                    setSelectedExporterId(exporterList[0].id)
                    onSelect(exporterList[0].id)
                }
            } catch (err) {
                setError('Failed to load exporters. Please try again later.')
                console.error('Error fetching exporters:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchExporters()
    }, [onSelect, selectedExporterId])

    /**
     * Handle exporter selection
     */
    const handleExporterSelect = (exporterId: string) => {
        setSelectedExporterId(exporterId)
        onSelect(exporterId)
    }

    // Show loading state
    if (loading || isLoading) {
        return (
            <div className='exporter-selector loading'>
                <h3>Loading Exporters...</h3>
                <div className='loading-spinner'></div>
            </div>
        )
    }

    // Show error state
    if (error) {
        return (
            <div className='exporter-selector error'>
                <h3>Error</h3>
                <p className='error-message'>{error}</p>
            </div>
        )
    }

    return (
        <div className='exporter-selector'>
            <h3>Select Technology</h3>
            <div className='exporter-list'>
                {exporters.map((exporter) => (
                    <div
                        key={exporter.id}
                        className={`exporter-card ${selectedExporterId === exporter.id ? 'selected' : ''}`}
                        onClick={() => handleExporterSelect(exporter.id)}
                    >
                        <h4>{exporter.name}</h4>
                        <p>{exporter.description}</p>
                        <div className='exporter-features'>
                            {exporter.features.map((feature: string) => (
                                <span key={feature} className='feature-badge'>
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
