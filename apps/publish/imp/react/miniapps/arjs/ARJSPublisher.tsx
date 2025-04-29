// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences

import React, { useState } from 'react'
import { MiniAppPublisherProps } from '../../interfaces/PublisherProps'
import { publishARJSFlow, PublishResult } from '../../services/api'

/**
 * AR.js Publisher Component
 */
export function ARJSPublisher({ flow, onPublish, onCancel, initialConfig }: MiniAppPublisherProps) {
    // State for marker type
    const [marker, setMarker] = useState<string>(initialConfig?.marker || 'hiro')

    // State for loading state
    const [isPublishing, setIsPublishing] = useState<boolean>(false)

    // State for error message
    const [error, setError] = useState<string | null>(null)

    /**
     * Handle marker selection change
     */
    const handleMarkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setMarker(e.target.value)
    }

    /**
     * Handle publish button click
     */
    const handlePublish = async () => {
        setIsPublishing(true)
        setError(null)

        try {
            const result = await publishARJSFlow(flow.id, { marker })
            onPublish(result)
        } catch (err: any) {
            setError(err?.message || 'Failed to publish AR.js experience')
            console.error('Error publishing AR.js flow:', err)
        } finally {
            setIsPublishing(false)
        }
    }

    /**
     * Handle cancel button click
     */
    const handleCancel = () => {
        if (onCancel) {
            onCancel()
        }
    }

    return (
        <div className='arjs-publisher'>
            <h3>AR.js Publication Settings</h3>

            <div className='form-group'>
                <label htmlFor='marker-select'>AR Marker:</label>
                <select id='marker-select' value={marker} onChange={handleMarkerChange} disabled={isPublishing}>
                    <option value='hiro'>Hiro (Standard)</option>
                    <option value='kanji'>Kanji</option>
                    <option value='a'>Letter A</option>
                    <option value='b'>Letter B</option>
                    <option value='c'>Letter C</option>
                </select>
                <p className='helper-text'>Select the AR marker that will trigger your experience.</p>
            </div>

            {error && <div className='error-message'>{error}</div>}

            <div className='action-buttons'>
                <button onClick={handleCancel} disabled={isPublishing} className='cancel-button'>
                    Cancel
                </button>
                <button onClick={handlePublish} disabled={isPublishing} className='publish-button primary'>
                    {isPublishing ? 'Publishing...' : 'Publish AR.js Experience'}
                </button>
            </div>
        </div>
    )
}
