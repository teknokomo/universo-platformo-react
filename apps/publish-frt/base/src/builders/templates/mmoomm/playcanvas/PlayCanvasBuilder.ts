// Universo Platformo | PlayCanvas Builder
// PlayCanvasBuilder generates simple PlayCanvas HTML from UPDL data

import { BaseBuilder } from '../../../common/BaseBuilder'
import { UPDLProcessor } from '@universo-platformo/utils'
import { IUPDLSpace } from '@universo-platformo/types'
import { BuildResult, BuildOptions, BuilderConfig, BuildErrorClass } from '../../../common/types'

/**
 * PlayCanvasBuilder generates simple PlayCanvas HTML from UPDL data
 */
export class PlayCanvasBuilder extends BaseBuilder {
    constructor(
        platform: string = 'playcanvas',
        config: BuilderConfig = {
            platform: 'playcanvas',
            name: 'PlayCanvasBuilder',
            version: '1.0.0',
            supportedMarkerTypes: []
        }
    ) {
        super(platform, config)
    }

    /**
     * Build PlayCanvas HTML from raw flow data string
     */
    async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
        try {
            const result = UPDLProcessor.processFlowData(flowDataString)
            if (!result.updlSpace) {
                throw new BuildErrorClass('UPDL space not found in flow data', 'NO_UPDL_SPACE')
            }
            return this.build(result.updlSpace, options)
        } catch (error) {
            console.error('[PlayCanvasBuilder] buildFromFlowData error:', error)
            return { success: false, error: (error as Error).message }
        }
    }

    /**
     * Build PlayCanvas HTML from UPDL space
     */
    async build(updlSpace: IUPDLSpace, options: BuildOptions = {}): Promise<BuildResult> {
        try {
            const validation = this.validateUPDLSpace(updlSpace)
            if (!validation.isValid) {
                throw new BuildErrorClass('Invalid UPDL space', 'VALIDATION_ERROR', validation.errors)
            }

            const sceneScript = this.generateSceneScript(updlSpace)
            const html = this.wrapWithDocumentStructure(sceneScript, options)

            return {
                success: true,
                html,
                metadata: {
                    buildTime: Date.now(),
                    markerType: options.markerType || '',
                    markerValue: options.markerValue || '',
                    libraryVersions: {
                        playcanvas: (options.libraryConfig as any)?.playcanvas?.version || '2.9.0'
                    }
                }
            }
        } catch (error) {
            console.error('[PlayCanvasBuilder] build error:', error)
            return { success: false, error: (error as Error).message }
        }
    }

    /**
     * Generate PlayCanvas scene creation script
     */
    private generateSceneScript(space: IUPDLSpace): string {
        const objectsCode = (space.objects || [])
            .map((obj) => {
                const id = obj.id.replace(/-/g, '_')
                const pos = obj.position
                return `const obj_${id} = new pc.Entity();\nobj_${id}.addComponent('model',{type:'box'});\nobj_${id}.setLocalPosition(${pos.x},${pos.y},${pos.z});\napp.root.addChild(obj_${id});`
            })
            .join('\n')

        return `const canvas=document.getElementById('application-canvas');\nconst app=new pc.Application(canvas,{});\napp.start();\napp.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);\napp.setCanvasResolution(pc.RESOLUTION_AUTO);\nwindow.addEventListener('resize',()=>app.resizeCanvas());\n${objectsCode}\nconst camera=new pc.Entity();\ncamera.addComponent('camera',{clearColor:new pc.Color(0.1,0.1,0.1)});\napp.root.addChild(camera);\ncamera.setLocalPosition(0,0,3);\nconst light=new pc.Entity();\nlight.addComponent('light');\napp.root.addChild(light);\nlight.setLocalPosition(0,5,0);`
    }

    /**
     * Wrap scene script with HTML boilerplate and PlayCanvas library
     */
    private wrapWithDocumentStructure(sceneScript: string, options: BuildOptions): string {
        const projectName = options.projectName || 'Universo Platformo PlayCanvas'
        const playcanvasSrc = 'https://code.playcanvas.com/playcanvas.min.js'
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <script src="${playcanvasSrc}"></script>
    <style>
        body,html{margin:0;padding:0;width:100%;height:100%}
        #application-canvas{width:100%;height:100%}
    </style>
</head>
<body>
    <canvas id="application-canvas"></canvas>
    <script>${sceneScript}</script>
</body>
</html>`
    }
}
