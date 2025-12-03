// Universo Platformo | PlayCanvas MMOOMM Builder
// Lightweight coordinator that delegates to template-mmoomm package

import { AbstractTemplateBuilder } from '../../../common/AbstractTemplateBuilder'
import { BuildOptions, TemplateConfig } from '../../../common/types'
import type { IFlowData } from '@universo/publish-backend'
import { PlayCanvasMMOOMMBuilder as MMOOMMTemplateBuilder } from '@universo/template-mmoomm'

/**
 * Lightweight MMOOMM Builder Coordinator
 * Delegates to template-mmoomm package for modular architecture
 * Target: <300 lines (currently ~80 lines)
 */
export class PlayCanvasMMOOMMBuilder extends AbstractTemplateBuilder {
    private templateBuilder: MMOOMMTemplateBuilder

    constructor() {
        super('mmoomm')

        // Initialize template builder from separate package
        this.templateBuilder = new MMOOMMTemplateBuilder()

        console.log('[PlayCanvasMMOOMMBuilder] Lightweight coordinator initialized')
    }

    /**
     * Get template information
     */
    getTemplateInfo(): TemplateConfig {
        return this.templateBuilder.getTemplateInfo()
    }

    /**
     * Build PlayCanvas MMOOMM HTML from flow data
     * Delegates all processing to template-mmoomm package
     */
    async build(flowData: IFlowData, options?: BuildOptions): Promise<string> {
        try {
            console.log('[PlayCanvasMMOOMMBuilder] Delegating to modular template package')

            // Convert publish-frontend BuildOptions to template package format
            const templateOptions = this.convertBuildOptions(options)

            // Delegate to template package - handles mode detection and building
            const result = await this.templateBuilder.build(flowData, templateOptions)

            console.log('[PlayCanvasMMOOMMBuilder] Build completed via template package')
            return result
        } catch (error) {
            console.error('[PlayCanvasMMOOMMBuilder] Build error:', error)

            // Generate error scene as fallback
            return this.generateErrorFallback(error, options)
        }
    }

    /**
     * Check if this builder can handle the flow data
     */
    canHandle(flowData: IFlowData): boolean {
        return this.templateBuilder.canHandle(flowData)
    }

    /**
     * Get required libraries for MMOOMM template
     * @param _options Build options (unused for PlayCanvas, always returns same libraries)
     */
    getRequiredLibraries(_options?: BuildOptions): string[] {
        return this.templateBuilder.getRequiredLibraries()
    }

    /**
     * Convert publish-frontend BuildOptions to template package format
     */
    private convertBuildOptions(_options?: BuildOptions): any {
        if (!_options) {
            return {}
        }

        // Map publish-frontend options to template package options
        return {
            gameMode: _options.gameMode || 'singleplayer',
            multiplayer: _options.multiplayer,
            ..._options
        }
    }

    /**
     * Generate error fallback when template package fails
     */
    private generateErrorFallback(error: any, options?: BuildOptions): string {
        console.error('[PlayCanvasMMOOMMBuilder] Generating error fallback')

        const errorScript = `
        console.error('MMOOMM Template Error: ${error.message}');
        
        // Basic error scene
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', { clearColor: new pc.Color(0.2, 0.1, 0.1) });
        camera.setPosition(0, 0, 5);
        app.root.addChild(camera);
        
        console.log('Error fallback scene loaded. Please check the flow configuration.');
        `

        return this.wrapWithHTML(errorScript, options)
    }

    /**
     * Wrap script with basic HTML structure
     */
    private wrapWithHTML(script: string, _options?: BuildOptions): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Universo MMOOMM - Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
    </style>
    <script src="https://code.playcanvas.com/playcanvas-stable.min.js"></script>
</head>
<body>
    <canvas id="application-canvas"></canvas>
    <script>
        const canvas = document.getElementById('application-canvas');
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(canvas)
        });
        
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        window.addEventListener('resize', () => app.resizeCanvas());

        ${script}

        app.start();
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
