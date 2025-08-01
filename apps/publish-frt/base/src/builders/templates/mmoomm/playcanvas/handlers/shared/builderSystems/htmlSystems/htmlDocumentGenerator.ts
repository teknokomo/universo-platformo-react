// Universo Platformo | MMOOMM HTML Document Generator
// Extracts pure HTML structure from PlayCanvasMMOOMMBuilder

import { BuildOptions } from '../../../../../../../common/types'

/**
 * Interface for HTML document generation
 */
export interface IHTMLDocumentGenerator {
    generateDocument(
        sceneScript: string,
        embeddedJavaScript: string,
        options: BuildOptions
    ): string
    generateLibraryScripts(librarySources: string[]): string
    generateHUDStyles(): string
    generateHUDStructure(): string
}

/**
 * HTML Document Generator for MMOOMM template
 * Handles pure HTML structure without embedded JavaScript logic
 */
export class HTMLDocumentGenerator implements IHTMLDocumentGenerator {
    /**
     * Generate complete HTML document
     */
    generateDocument(
        sceneScript: string,
        embeddedJavaScript: string,
        options: BuildOptions
    ): string {
        const projectName = options.projectName || 'Universo MMOOMM Virtual World'
        const librarySources = this.getLibrarySourcesForTemplate(options)
        const libraryScripts = this.generateLibraryScripts(librarySources)

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <meta name="description" content="PlayCanvas MMOOMM - Universo Platformo">
${libraryScripts}
    <style>
        body {
            margin: 0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

${this.generateHUDStyles()}
    </style>
</head>
<body>
    <canvas id="application-canvas"></canvas>
    
${this.generateHUDStructure()}
    
    <script>
${embeddedJavaScript}

        ${sceneScript}
    </script>
</body>
</html>`
    }

    /**
     * Generate library script tags
     */
    generateLibraryScripts(librarySources: string[]): string {
        return librarySources.map((src) => `    <script src="${src}"></script>`).join('\n')
    }

    /**
     * Generate HUD CSS styles
     */
    generateHUDStyles(): string {
        return `        /* Universo Platformo | Space MMO UI System */
        #space-hud {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            color: white;
            font-size: 14px;
        }

        .hud-panel {
            position: absolute;
            background: rgba(0, 20, 40, 0.8);
            border: 1px solid rgba(0, 150, 255, 0.5);
            border-radius: 5px;
            padding: 10px;
            pointer-events: auto;
        }

        #ship-status {
            top: 10px;
            left: 10px;
            min-width: 200px;
        }

        #inventory-panel {
            top: 10px;
            right: 10px;
            min-width: 180px;
        }

        #trading-panel {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            min-width: 300px;
            display: none;
        }

        #mini-map {
            bottom: 10px;
            right: 10px;
            width: 150px;
            height: 150px;
        }

        .controls-hint {
            position: absolute;
            bottom: 10px;
            left: 10px;
            font-size: 12px;
            background: rgba(0, 0, 0, 0.7);
            padding: 8px;
            border-radius: 3px;
            color: white;
            pointer-events: auto;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            margin: 2px 0;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #ffff00);
            transition: width 0.3s ease;
        }

        .item-list {
            max-height: 100px;
            overflow-y: auto;
            margin-top: 5px;
        }

        .item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .currency {
            color: #ffff00;
            font-weight: bold;
        }

        button {
            background: rgba(0, 150, 255, 0.8);
            border: 1px solid rgba(0, 150, 255, 1);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            margin: 2px;
        }

        button:hover {
            background: rgba(0, 150, 255, 1);
        }`
    }

    /**
     * Generate HUD HTML structure
     */
    generateHUDStructure(): string {
        return `    <div id="space-hud">
        <!-- Ship Status Panel -->
        <div id="ship-status" class="hud-panel">
            <div><strong>Ship Status</strong></div>
            <div>Hull: <span id="ship-hull">100%</span></div>
            <div class="progress-bar">
                <div id="hull-bar" class="progress-fill" style="width: 100%"></div>
            </div>
            <div>Fuel: <span id="ship-fuel">100%</span></div>
            <div class="progress-bar">
                <div id="fuel-bar" class="progress-fill" style="width: 100%"></div>
            </div>
            <div>Currency: <span id="ship-currency" class="currency">0 Inmo</span></div>
            <div>World: <span id="current-world">Kubio</span></div>
        </div>

        <!-- Inventory Panel -->
        <div id="inventory-panel" class="hud-panel">
            <div><strong>Cargo Hold</strong></div>
            <div>Capacity: <span id="cargo-capacity">0/20 m³</span></div>
            <div class="progress-bar">
                <div id="cargo-bar" class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="item-list" id="cargo-items">
                <div class="item">
                    <span>Empty</span>
                    <span>-</span>
                </div>
            </div>
        </div>

        <!-- Trading Panel (hidden by default) -->
        <div id="trading-panel" class="hud-panel">
            <div><strong>Trading Station</strong></div>
            <div id="station-name">Station Espero</div>
            <div>Exchange Rate: 1 Asteroid Mass = 10 Inmo</div>
            <button onclick="tradeAll()">Trade All</button>
            <button onclick="tradeHalf()">Trade Half</button>
            <button onclick="closeTrade()">Close</button>
        </div>

        <!-- Mini Map -->
        <div id="mini-map" class="hud-panel">
            <canvas id="mini-map-canvas" width="130" height="130"></canvas>
        </div>

        <!-- Controls Hint -->
        <div class="controls-hint">
            <div><strong>Controls:</strong></div>
            <div>WASD - Move Ship</div>
            <div>QZ - Up/Down</div>
            <div>E/C - Roll</div>
            <div>Space - Laser Mining</div>
            <div>F - Interact</div>
            <div>Shift+WASD - Strafe</div>
        </div>
    </div>`
    }

    /**
     * Get library sources for template (copied from AbstractTemplateBuilder pattern)
     */
    private getLibrarySourcesForTemplate(options: BuildOptions): string[] {
        // This will be injected by the main builder
        // For now, return PlayCanvas default
        return ['https://cdn.jsdelivr.net/npm/playcanvas@2.9.0/build/playcanvas.min.js']
    }
}
