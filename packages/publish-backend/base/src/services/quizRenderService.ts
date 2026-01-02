/**
 * Universo Platformo | Quiz Render Service
 * Server-side HTML generation for published quizzes
 * 
 * This service generates quiz HTML on the server to ensure:
 * 1. Proper domain origin for Yandex SmartCaptcha (not blob: or about:srcdoc)
 * 2. Consistent rendering across all clients
 * 3. Better caching opportunities
 */

import { ARJSQuizBuilder } from '@universo/template-quiz'
import { ILibraryConfig } from '@universo/types'
import logger from '../utils/logger'
import { getPublicationCaptchaConfig } from './captchaService'

export interface QuizRenderOptions {
    flowData: string
    projectName: string
    canvasId?: string
    libraryConfig?: ILibraryConfig | null
    renderConfig?: Record<string, any> | null
}

export interface QuizRenderResult {
    html: string
    success: boolean
    error?: string
}

type TimerPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Normalize timer configuration for quiz rendering
 */
function normalizeTimerConfig(config: any): { enabled: boolean; limitSeconds: number; position: TimerPosition } {
    const validPositions: TimerPosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right']
    const defaultPosition: TimerPosition = 'top-center'

    if (!config || typeof config !== 'object') {
        return { enabled: false, limitSeconds: 60, position: defaultPosition }
    }

    const position = validPositions.includes(config.position) ? config.position : defaultPosition

    return {
        enabled: config.enabled === true,
        limitSeconds: typeof config.limitSeconds === 'number' ? config.limitSeconds : 60,
        position
    }
}

/**
 * Render quiz HTML on the server
 * @param options Quiz render options including flow data and configuration
 * @returns Promise with rendered HTML or error
 */
export async function renderQuizHtml(options: QuizRenderOptions): Promise<QuizRenderResult> {
    const { flowData, projectName, canvasId, libraryConfig, renderConfig } = options

    logger.info('[quizRenderService] Starting quiz render', {
        projectName,
        canvasId,
        hasFlowData: !!flowData,
        flowDataLength: flowData?.length || 0,
        hasLibraryConfig: !!libraryConfig,
        hasRenderConfig: !!renderConfig
    })

    try {
        const builder = new ARJSQuizBuilder()
        const config = renderConfig || {}
        const displayType = config.arDisplayType || 'marker'
        const timerConfig = normalizeTimerConfig(config.timerConfig)

        // Load publication captcha config
        const publicationCaptchaConfig = getPublicationCaptchaConfig()
        logger.info('[quizRenderService] Captcha config for render:', {
            enabled: publicationCaptchaConfig.enabled,
            hasSiteKey: !!publicationCaptchaConfig.siteKey,
            testMode: publicationCaptchaConfig.testMode
        })

        const buildOptions = {
            projectName: projectName || 'AR.js Experience',
            libraryConfig: libraryConfig ?? undefined,
            canvasId,
            cameraUsage: config.cameraUsage || 'standard',
            backgroundColor: config.backgroundColor,
            timerConfig,
            interactionMode: config.interactionMode || 'buttons',
            publicationCaptchaConfig,
            ...(displayType === 'wallpaper'
                ? {
                      arDisplayType: 'wallpaper',
                      wallpaperType: config.wallpaperType || 'standard'
                  }
                : {
                      arDisplayType: 'marker',
                      markerType: config.markerType || 'preset',
                      markerValue: config.markerValue || 'hiro'
                  })
        }

        logger.info('[quizRenderService] Build options:', {
            projectName: buildOptions.projectName,
            arDisplayType: buildOptions.arDisplayType,
            cameraUsage: buildOptions.cameraUsage,
            interactionMode: buildOptions.interactionMode,
            captchaEnabled: publicationCaptchaConfig.enabled
        })

        const result = await builder.buildFromFlowData(flowData, buildOptions)

        if (!result.html) {
            logger.error('[quizRenderService] Empty HTML result from builder')
            return {
                html: '',
                success: false,
                error: 'Empty AR.js build result'
            }
        }

        logger.info('[quizRenderService] Quiz render successful', {
            htmlLength: result.html.length
        })

        return {
            html: result.html,
            success: true
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown render error'
        logger.error('[quizRenderService] Quiz render failed:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        })

        return {
            html: '',
            success: false,
            error: errorMessage
        }
    }
}
