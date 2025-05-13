// Universo Platformo | TypeScript declaration for ARJSExporter

// Enum for marker types
export enum MarkerType {
    PATTERN = 'pattern',
    BARCODE = 'barcode',
    CUSTOM = 'custom'
}

// Interface for scene data
export interface UPDLScene {
    id: string
    name: string
    description?: string
    updatedAt: string
    [key: string]: any
}

// Interface for export options
export interface ARJSExportOptions {
    title: string
    markerType: MarkerType
    markerValue: string
    [key: string]: any
}

// ARJSExporter class declaration
export class ARJSExporter {
    /**
     * Generate HTML for AR.js experience
     * @param scene - UPDL scene data
     * @param options - Export options
     * @returns Generated HTML string
     */
    generateHTML(scene: UPDLScene, options: ARJSExportOptions): string
}
