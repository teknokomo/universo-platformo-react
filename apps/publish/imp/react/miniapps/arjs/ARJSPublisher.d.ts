// Universo Platformo | TypeScript declaration for ARJSPublisher
import React from 'react'

interface ARJSPublisherProps {
    /**
     * Flow data to publish
     */
    flow: any

    /**
     * Unik ID for organization context
     */
    unikId?: string

    /**
     * Callback function called when publish is successful
     * @param result The result of the publication
     */
    onPublish?: (result: any) => void

    /**
     * Callback function called when operation is cancelled
     */
    onCancel?: () => void

    /**
     * Initial configuration for the publisher
     */
    initialConfig?: any
}

declare const ARJSPublisher: React.FC<ARJSPublisherProps>

export { ARJSPublisher }
export default ARJSPublisher
