import { AbstractTemplateBuilder } from '../../../common/AbstractTemplateBuilder'
import { BuildOptions, TemplateConfig } from '../../../common/types'
import type { IFlowData } from '@universo/publish-srv'

// Basic handlers (placeholders for future high-level logic)
class SpaceHandler {
    process(space: any, _options: BuildOptions = {}): string {
        return ''
    }
}
class EntityHandler {
    process(entities: any[], _options: BuildOptions = {}): string {
        return ''
    }
}
class ComponentHandler {
    process(components: any[], _options: BuildOptions = {}): string {
        return ''
    }
}
class EventHandler {
    process(events: any[], _options: BuildOptions = {}): string {
        return ''
    }
}
class ActionHandler {
    process(actions: any[], _options: BuildOptions = {}): string {
        return ''
    }
}
class UniversoHandler {
    process(nodes: any[], _options: BuildOptions = {}): string {
        return ''
    }
}

export class PlayCanvasMMOOMMBuilder extends AbstractTemplateBuilder {
    private spaceHandler = new SpaceHandler()
    private entityHandler = new EntityHandler()
    private componentHandler = new ComponentHandler()
    private eventHandler = new EventHandler()
    private actionHandler = new ActionHandler()
    private universoHandler = new UniversoHandler()

    constructor() {
        super('mmoomm')
    }

    async build(_flowData: IFlowData, options: BuildOptions = {}): Promise<string> {
        const sceneScript = this.generateSceneScript()
        const sceneContent = `<canvas id='application-canvas'></canvas>\n<script src='https://code.playcanvas.com/playcanvas-2.9.0.js'></script>\n<script>${sceneScript}</script>`
        return this.wrapWithDocumentStructure(sceneContent, options)
    }

    protected generateHTML(_content: { spaceContent: string; objectContent: string; cameraContent: string; lightContent: string; dataContent: string; template: string; error?: boolean }, options: BuildOptions = {}): string {
        const sceneScript = this.generateSceneScript()
        const sceneContent = `<canvas id='application-canvas'></canvas>\n<script src='https://code.playcanvas.com/playcanvas-2.9.0.js'></script>\n<script>${sceneScript}</script>`
        return this.wrapWithDocumentStructure(sceneContent, options)
    }

    getTemplateInfo(): TemplateConfig {
        return {
            id: 'mmoomm',
            name: 'PlayCanvas MMOOMM Template',
            description: 'Prototype MMO scene using PlayCanvas primitives',
            version: '0.1.0',
            supportedNodes: ['Space', 'Entity', 'Component', 'Event', 'Action', 'Universo'],
            features: ['playcanvas-2.9.0'],
            defaults: {}
        }
    }

    getRequiredLibraries(): string[] {
        return []
    }

    private generateSceneScript(): string {
        return `const canvas=document.getElementById('application-canvas');\nconst app=new pc.Application(canvas,{});\napp.start();\napp.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);\napp.setCanvasResolution(pc.RESOLUTION_AUTO);\nwindow.addEventListener('resize',()=>app.resizeCanvas());\nconst ship=new pc.Entity('ship');\nship.addComponent('model',{type:'box'});\nship.setLocalScale(1,1,2);\nship.setLocalPosition(0,0,0);\napp.root.addChild(ship);\nfor(let i=0;i<3;i++){const ast=new pc.Entity('asteroid'+i);ast.addComponent('model',{type:'sphere'});ast.setLocalPosition(Math.random()*6-3,Math.random()*2-1,-4-i*2);app.root.addChild(ast);}\nconst station=new pc.Entity('station');\nstation.addComponent('model',{type:'cylinder'});\nstation.setLocalScale(2,1,2);\nstation.setLocalPosition(4,0,-10);\napp.root.addChild(station);\nconst gate=new pc.Entity('gate');\ngate.addComponent('model',{type:'torus'});\ngate.setLocalScale(2,2,0.5);\ngate.setLocalPosition(-4,0,-10);\napp.root.addChild(gate);\nconst camera=new pc.Entity('camera');\ncamera.addComponent('camera',{clearColor:new pc.Color(0.1,0.1,0.1)});\ncamera.setLocalPosition(0,2,8);\napp.root.addChild(camera);\nconst light=new pc.Entity('light');\nlight.addComponent('light');\nlight.setLocalPosition(5,5,15);\napp.root.addChild(light);`
    }
}

