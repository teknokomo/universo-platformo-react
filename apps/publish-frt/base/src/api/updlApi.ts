// Universo Platformo | UPDL API for AR.js streaming and pregeneration
import httpClient from './httpClient'
import { UPDLScene } from '../interfaces/UPDLInterfaces'

/**
 * Fetch UPDL scene data by chatflow ID
 */
export async function fetchUPDLScene(flowId: string): Promise<UPDLScene> {
    const response = await httpClient.get<UPDLScene>(`/chatflows/${flowId}`)
    return response.data
}

/**
 * Publish AR.js project
 */
export async function publishARJSProject(request: {
    chatflowId: string
    title: string
    html?: string
    markerType?: string
    markerValue?: string
    isPublic?: boolean
    generationMode?: string
}): Promise<any> {
    const response = await httpClient.post(`/api/v1/publish/arjs`, request)
    return response
}

/**
 * Generate AR.js HTML locally as a fallback
 */
export function generateARJSHTMLLocally(flowData: any, options: { title?: string; markerType?: string; markerValue?: string }): string {
    const markerPreset = options.markerType === 'pattern' ? options.markerValue || 'hiro' : options.markerValue || ''
    return `<!DOCTYPE html>
<html>
  <head>
    <title>${options.title || 'AR.js Experience'}</title>
    <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
  </head>
  <body style="margin: 0; overflow: hidden;">
    <a-scene embedded arjs>
      <a-marker preset="${markerPreset}">
        <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
      </a-marker>
      <a-entity camera></a-entity>
    </a-scene>
  </body>
</html>`
}

/**
 * Export UPDLScene type
 */
export type { UPDLScene }
