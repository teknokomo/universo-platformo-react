import type { Response } from '@playwright/test'

const STABLE_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export const SPACE_SECTION_CODENAME = 'FlightWorld'
export const VISUAL_LINKUP_LAB_SECTION_CODENAME = 'VisualLinkupLab'
export const WELCOME_SECTION_CODENAME = 'WelcomePage'
export const APP_RUNTIME_TIMEOUT = 180_000

export const localizedText = (en: string, ru: string, primary: 'en' | 'ru' = 'en') => ({
    _schema: '1',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP },
        ru: { content: ru, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP }
    },
    _primary: primary
})

export const localizedInput = (en: string, ru: string) => ({ en, ru })

export const readRequestJson = (response: Response): Record<string, unknown> | null => {
    try {
        const postData = response.request().postDataJSON()
        return postData && typeof postData === 'object' && !Array.isArray(postData) ? (postData as Record<string, unknown>) : null
    } catch {
        return null
    }
}

export const widgetModuleSource = `
import { ExtensionModule, AtClient } from '@universo-react/extension-sdk'
import { createMoveToPointIntent, createStopIntent } from '@universo-react/colyseus-client'
import { createAabbFromCenterAndSize } from '@universo-react/playcanvas-engine'

export default class MmoommPlayCanvasRuntimeWidget extends ExtensionModule {
    @AtClient()
    async mount(params) {
        const scene = params && typeof params === 'object' && params.scene ? params.scene : null
        return {
            scene,
            moveToPoint: createMoveToPointIntent({ x: 72, y: 0, z: -48 }, 1),
            stop: createStopIntent(2),
            stationBounds: createAabbFromCenterAndSize({ x: 72, y: 0, z: -48 }, { x: 48, y: 16, z: 16 })
        }
    }
}
`.trim()

export const serverModuleSource = `
import { ExtensionModule, AtServer } from '@universo-react/extension-sdk'

export default class MmoommAuthoritativeFlightRuntime extends ExtensionModule {
    @AtServer()
    async createRealtimeRoomOptions(params) {
        const scene = params && typeof params === 'object' && params.scene ? params.scene : null
        const ship = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.controlledObjectId) : null
        const station = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.targetObjectId) : null
        const initialPosition = ship?.position ?? { x: 0, y: 0, z: 0 }
        const targetPosition = station?.position ?? { x: 72, y: 0, z: -48 }
        const shipScale = ship?.scale ?? { x: 12, y: 4, z: 4 }
        const stationScale = station?.scale ?? { x: 48, y: 16, z: 16 }
        return {
            initialPosition,
            targetObjects: { [scene?.targetObjectId ?? 'station']: targetPosition },
            controlledHalfExtents: { x: Math.abs(shipScale.x) / 2, y: Math.abs(shipScale.y) / 2, z: Math.abs(shipScale.z) / 2 },
            guardBoxes: [
                {
                    center: targetPosition,
                    halfExtents: { x: Math.abs(stationScale.x) / 2, y: Math.abs(stationScale.y) / 2, z: Math.abs(stationScale.z) / 2 }
                }
            ],
            cruiseSpeed: scene?.cruiseSpeed ?? 36,
            acceleration: 48,
            deceleration: 48,
            arrivalRadius: 0.5,
            spawnSafetyMargin: 8,
            spawnMaxAttempts: 64,
            spawnRingSpacing: 24
        }
    }
}
`.trim()
