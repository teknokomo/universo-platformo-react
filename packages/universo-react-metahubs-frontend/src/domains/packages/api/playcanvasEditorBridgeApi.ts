import type { PlayCanvasEditorBridgeCommand, PlayCanvasEditorBridgeResponse } from '@universo-react/types'
import { apiClient } from '../../shared'

const getHttpStatus = (error: unknown): number | undefined => {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === 'number' ? status : undefined
}

export const playcanvasEditorBridgeApi = {
    sendCommand: async (metahubId: string, payload: { sessionToken: string; command: PlayCanvasEditorBridgeCommand }) => {
        try {
            const { data } = await apiClient.post<PlayCanvasEditorBridgeResponse>(
                `/metahub/${metahubId}/playcanvas/editor-bridge/commands`,
                payload
            )
            return data
        } catch (error) {
            if (getHttpStatus(error) === 419) {
                const csrfError = new Error('PlayCanvas Editor bridge CSRF token required') as Error & {
                    response?: { status: number; data: PlayCanvasEditorBridgeResponse }
                }
                csrfError.response = {
                    status: 419,
                    data: {
                        ok: false,
                        requestId: payload.command.requestId,
                        code: 'csrfRequired',
                        status: 419
                    }
                }
                throw csrfError
            }
            throw error
        }
    }
}
