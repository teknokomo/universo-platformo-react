// Mode Detection Utility for MMOOMM Templates
import type { IFlowData } from '../../common/types'

export interface MultiplayerModeInfo {
    isMultiplayer: boolean
    authSpace?: any
    gameSpace?: any
}

/**
 * Utility class for detecting game mode from UPDL flow data
 */
export class ModeDetector {
    /**
     * Detect multiplayer mode based on UPDL flow structure
     * Multiplayer mode: Space with collectLeadName=true + connected only to another Space
     */
    static detectMultiplayerMode(flowData: IFlowData): MultiplayerModeInfo {
        // Only check multi-scene flows for multiplayer pattern
        if (!flowData.multiScene || flowData.multiScene.totalScenes < 2) {
            return { isMultiplayer: false }
        }

        const firstScene = flowData.multiScene.scenes[0]
        const secondScene = flowData.multiScene.scenes[1]

        if (!firstScene || !secondScene) {
            return { isMultiplayer: false }
        }

        // Check if first scene has collectName enabled
        const hasCollectName = firstScene.spaceData?.leadCollection?.collectName === true

        // Check if first scene has minimal game content (auth screen scenario)
        const firstSceneHasMinimalGameContent =
            (!firstScene.spaceData?.entities || firstScene.spaceData.entities.length === 0) ||
            (firstScene.spaceData?.entities && firstScene.spaceData.entities.length <= 2) // Allow minimal entities like basic setup

        // Check if second scene has substantial game content
        const hasGameContent =
            secondScene.dataNodes.length > 0 ||
            secondScene.objectNodes.length > 0 ||
            (secondScene.spaceData?.entities && secondScene.spaceData.entities.length > 0)

        const isMultiplayer = hasCollectName && firstSceneHasMinimalGameContent && hasGameContent

        console.log('[ModeDetector] Multiplayer detection:', {
            hasCollectName,
            firstSceneHasMinimalGameContent,
            hasGameContent,
            isMultiplayer,
            firstSceneDataNodes: firstScene.dataNodes.length,
            firstSceneObjectNodes: firstScene.objectNodes.length,
            firstSceneEntities: firstScene.spaceData?.entities?.length || 0,
            secondSceneDataNodes: secondScene.dataNodes.length,
            secondSceneObjectNodes: secondScene.objectNodes.length,
            secondSceneEntities: secondScene.spaceData?.entities?.length || 0
        })

        return {
            isMultiplayer,
            authSpace: isMultiplayer ? firstScene : undefined,
            gameSpace: isMultiplayer ? secondScene : undefined
        }
    }

    /**
     * Determine game mode from build options and flow data
     */
    static determineGameMode(flowData: IFlowData, options: any): 'singleplayer' | 'multiplayer' {
        // Explicit mode from options takes precedence
        if (options.gameMode === 'multiplayer') {
            return 'multiplayer'
        }

        if (options.gameMode === 'singleplayer') {
            return 'singleplayer'
        }

        // Auto-detect based on flow structure
        const multiplayerInfo = this.detectMultiplayerMode(flowData)
        return multiplayerInfo.isMultiplayer ? 'multiplayer' : 'singleplayer'
    }

    /**
     * Check if flow data has meaningful content
     */
    static hasContent(flowData: IFlowData): boolean {
        if (flowData.updlSpace && !flowData.multiScene) {
            // Single scene - check for entities, components, etc.
            const space = flowData.updlSpace
            return !!(
                (space.entities && space.entities.length > 0) ||
                (space.components && space.components.length > 0) ||
                (space.events && space.events.length > 0) ||
                (space.actions && space.actions.length > 0) ||
                (space.datas && space.datas.length > 0) ||
                (space.universo && space.universo.length > 0)
            )
        }

        if (flowData.multiScene) {
            // Multi-scene - check if any scene has content
            return flowData.multiScene.scenes.some(scene =>
                scene.dataNodes.length > 0 ||
                scene.objectNodes.length > 0 ||
                (scene.spaceData?.entities && scene.spaceData.entities.length > 0)
            )
        }

        return false
    }
}