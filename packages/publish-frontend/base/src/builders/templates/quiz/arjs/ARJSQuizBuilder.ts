// Universo Platformo | AR.js Quiz Builder
// Lightweight coordinator that delegates to template-quiz package

import { AbstractTemplateBuilder } from '../../../common/AbstractTemplateBuilder'
import { BuildOptions, TemplateConfig } from '../../../common/types'
import type { IFlowData } from '@universo/publish-backend'
import { ARJSQuizBuilder as QuizTemplateBuilder } from '@universo/template-quiz'

/**
 * Lightweight Quiz Builder Coordinator
 * Delegates to template-quiz package for modular architecture
 */
export class ARJSQuizBuilder extends AbstractTemplateBuilder {
    private templateBuilder: QuizTemplateBuilder

    constructor() {
        super('quiz')

        // Initialize template builder from separate package
        this.templateBuilder = new QuizTemplateBuilder()

        console.log('[ARJSQuizBuilder] Lightweight coordinator initialized')
    }

    /**
     * Get template information
     */
    getTemplateInfo(): TemplateConfig {
        return this.templateBuilder.getTemplateInfo()
    }

    /**
     * Build AR.js Quiz HTML from flow data
     * Delegates all processing to template-quiz package
     */
    async build(flowData: IFlowData, options?: BuildOptions): Promise<string> {
        try {
            console.log('[ARJSQuizBuilder] Delegating to modular template package')

            // Convert publish-frontend BuildOptions to template package format
            const templateOptions = this.convertBuildOptions(options)

            // Delegate to template package - handles mode detection and building
            const rawHtml = await this.templateBuilder.build(flowData as any, templateOptions)

            // If the template returned only a scene fragment (no <html> or library scripts), wrap it
            const needsWrap =
                !/(<!DOCTYPE html>|<html[\s>])/i.test(rawHtml || '') || !/(aframe|min\.js|aframe-ar\.js|arjs)/i.test(rawHtml || '')
            const finalHtml = needsWrap ? this.wrapWithDocumentStructure(rawHtml, templateOptions) : rawHtml

            console.log('[ARJSQuizBuilder] Build completed via template package', { wrapped: needsWrap })
            return finalHtml
        } catch (error) {
            console.error('[ARJSQuizBuilder] Build error:', error)

            // Generate error scene as fallback
            return this.generateErrorFallback(error, options)
        }
    }

    /**
     * Build from raw flow data (compatibility method)
     */
    async buildFromFlowData(flowDataString: string, options?: BuildOptions): Promise<any> {
        try {
            console.log('[ARJSQuizBuilder] buildFromFlowData called - delegating to template package')
            console.log('[ARJSQuizBuilder] flowDataString length:', flowDataString?.length || 0)
            console.log('[ARJSQuizBuilder] options:', options)

            // Delegate to template package
            const result = await this.templateBuilder.buildFromFlowData(flowDataString, options)

            // Ensure returned HTML is a full document with required libraries
            const templateOptions = this.convertBuildOptions(options)
            let html = result?.html || ''
            const needsWrap = !/(<!DOCTYPE html>|<html[\s>])/i.test(html) || !/(aframe|min\.js|aframe-ar\.js|arjs)/i.test(html)
            if (needsWrap) {
                html = this.wrapWithDocumentStructure(html, templateOptions)
            }

            console.log('[ARJSQuizBuilder] buildFromFlowData completed via template package', { wrapped: needsWrap })
            console.log('[ARJSQuizBuilder] result success:', result?.success)
            console.log('[ARJSQuizBuilder] result html length:', html?.length || 0)

            return { ...result, html }
        } catch (error) {
            console.error('[ARJSQuizBuilder] buildFromFlowData error:', error)
            return {
                success: false,
                error: (error as Error).message
            }
        }
    }

    /**
     * Check if this builder can handle the flow data
     */
    canHandle(_flowData: IFlowData): boolean {
        // Quiz template can handle any flow data with questions/answers
        return true
    }

    /**
     * Get required libraries for Quiz template
     * @param options Build options that may affect library requirements
     */
    getRequiredLibraries(options?: BuildOptions): string[] {
        console.log(`[ARJSQuizBuilder Wrapper] getRequiredLibraries called with options:`, options)

        // Convert publish-frontend options to template package format
        const templateOptions = this.convertBuildOptions(options || {})
        console.log(`[ARJSQuizBuilder Wrapper] Converted to template options:`, templateOptions)

        const libraries = this.templateBuilder.getRequiredLibraries(templateOptions)
        console.log(`[ARJSQuizBuilder Wrapper] Template returned libraries:`, libraries)

        return libraries
    }

    /**
     * Convert publish-frontend BuildOptions to template package format
     */
    private convertBuildOptions(options?: BuildOptions): any {
        if (!options) {
            return {}
        }

        // Map publish-frontend options to template package options
        return {
            markerType: options.markerType || 'preset',
            markerValue: options.markerValue || 'hiro',
            projectName: options.projectName,
            canvasId: options.canvasId,
            ...options
        }
    }

    /**
     * Generate error fallback when template package fails
     */
    private generateErrorFallback(error: any, options?: BuildOptions): string {
        console.error('[ARJSQuizBuilder] Generating error fallback')

        const errorContent = `
        <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
        <a-text value="Error: ${error.message}" position="0 2 0" align="center" color="#FFFFFF"></a-text>
        `

        return this.wrapWithHTML(errorContent, options)
    }

    /**
     * Wrap content with basic AR.js HTML structure
     */
    private wrapWithHTML(sceneContent: string, options?: BuildOptions): string {
        const aframeSrc = 'https://aframe.io/releases/1.7.1/aframe.min.js'
        const arjsSrc = 'https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js'
        const projectName = options?.projectName || 'Universo Platformo AR Quiz'

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <meta name="description" content="AR Quiz - Universo Platformo">
    <script src="${aframeSrc}"></script>
    <script src="${arjsSrc}"></script>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
    </style>
</head>
<body>
    <a-scene embedded
             class="ar-scene"
             arjs="sourceType: webcam; debugUIEnabled: false;"
             vr-mode-ui="enabled: false"
             device-orientation-permission-ui="enabled: false">
        
        <!-- AR.js Marker -->
        <a-marker preset="hiro">
            ${sceneContent}
        </a-marker>
        
        <!-- Camera entity for AR tracking -->
        <a-entity camera></a-entity>
        
        <!-- Assets -->
        <a-assets></a-assets>
    </a-scene>

    <script>
        window.canvasId = '${options?.canvasId || ''}';
        
        document.addEventListener('DOMContentLoaded', function() {
            const scene = document.querySelector('a-scene');
            if (scene && scene.hasLoaded) {
                console.log('[ARJSQuizBuilder] Scene already loaded');
            } else if (scene) {
                scene.addEventListener('loaded', function() {
                    console.log('[ARJSQuizBuilder] Scene loaded successfully');
                });
            }
        });
    </script>
</body>
</html>`
    }

    /**
     * Generate HTML structure (legacy method for compatibility)
     */
    protected generateHTML(
        content: {
            spaceContent: string
            objectContent: string
            cameraContent: string
            lightContent: string
            dataContent: string
            template: string
            error?: boolean
        },
        options?: BuildOptions
    ): string {
        // Legacy compatibility - wrap template content
        return this.wrapWithHTML(content.template, options)
    }
}
