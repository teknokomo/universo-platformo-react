// PlayCanvas-specific types and interfaces

export interface PlayCanvasConfig {
    version: string
    engineUrl?: string
    wasmUrl?: string
}

export interface PlayCanvasScene {
    entities: PlayCanvasEntity[]
    assets: PlayCanvasAsset[]
    scripts: PlayCanvasScript[]
}

export interface PlayCanvasEntity {
    id: string
    name: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
    components: PlayCanvasComponent[]
}

export interface PlayCanvasComponent {
    type: string
    properties: Record<string, any>
}

export interface PlayCanvasAsset {
    id: string
    name: string
    type: string
    url?: string
    data?: any
}

export interface PlayCanvasScript {
    name: string
    content: string
    attributes?: Record<string, any>
}