// Universo Platformo | A-Frame HTML Generator
// Generates HTML for A-Frame scenes

/**
 * HTML generation options
 */
export interface AFrameHTMLOptions {
    title?: string
    includeStats?: boolean
    autoRotate?: boolean
    arjsVersion?: string
    aframeVersion?: string
}

/**
 * Generator for A-Frame HTML content
 */
export class AFrameHTMLGenerator {
    // Default A-Frame and AR.js versions
    private DEFAULT_AFRAME_VERSION = '1.4.2'
    private DEFAULT_ARJS_VERSION = '3.4.5'

    /**
     * Generate complete HTML document for an A-Frame scene
     * @param scene A-Frame scene to render
     * @param options HTML generation options
     * @returns Complete HTML document as string
     */
    generateHTML(scene: any, options: AFrameHTMLOptions = {}): string {
        // Set defaults
        const title = options.title || 'AR.js Scene'
        const includeStats = options.includeStats || false
        const autoRotate = options.autoRotate || false
        const aframeVersion = options.aframeVersion || this.DEFAULT_AFRAME_VERSION
        const arjsVersion = options.arjsVersion || this.DEFAULT_ARJS_VERSION

        // Build HTML document
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
        }
        .a-enter-ar-button {
            background-color: #222;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            padding: 0.5em 1em;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
        }
    </style>
    <script src="https://aframe.io/releases/v${aframeVersion}/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/ar.js@${arjsVersion}/aframe/build/aframe-ar.js"></script>
    ${includeStats ? '<script src="https://cdn.jsdelivr.net/npm/aframe-stats-panel/dist/aframe-stats-panel.min.js"></script>' : ''}
    ${autoRotate ? '<script src="https://cdn.jsdelivr.net/npm/aframe-extras@v6.0.0/dist/aframe-extras.min.js"></script>' : ''}
</head>
<body>
    ${this.generateSceneHTML(scene)}
    <script>
        // Initialize AR session
        window.addEventListener('load', () => {
            console.log('AR.js scene initialized');
            ${autoRotate ? this.generateAutoRotateScript() : ''}
        });
    </script>
</body>
</html>`
    }

    /**
     * Generate HTML for an A-Frame scene
     * @param scene A-Frame scene object
     * @returns HTML string for the scene
     */
    private generateSceneHTML(scene: any): string {
        if (!scene) return ''

        // Generate opening tag with attributes
        let html = `<${scene.tagName}`

        // Add attributes
        if (scene.attributes && scene.attributes.length > 0) {
            scene.attributes.forEach((attr: any) => {
                html += ` ${attr.name}="${this.escapeHtml(attr.value.toString())}"`
            })
        }

        html += '>\n'

        // Add children
        if (scene.children && scene.children.length > 0) {
            scene.children.forEach((child: any) => {
                html += this.generateElementHTML(child)
            })
        }

        // Close tag
        html += `</${scene.tagName}>\n`

        return html
    }

    /**
     * Generate HTML for an A-Frame element
     * @param element A-Frame element
     * @param indent Indentation level
     * @returns HTML string for the element
     */
    private generateElementHTML(element: any, indent: number = 4): string {
        if (!element) return ''

        const indentStr = ' '.repeat(indent)

        // Generate opening tag with attributes
        let html = `${indentStr}<${element.tagName}`

        // Add attributes
        if (element.attributes && element.attributes.length > 0) {
            element.attributes.forEach((attr: any) => {
                html += ` ${attr.name}="${this.escapeHtml(attr.value.toString())}"`
            })
        }

        // Self-closing tag if no children
        if (!element.children || element.children.length === 0) {
            html += '></' + element.tagName + '>\n'
            return html
        }

        // Opening tag with children
        html += '>\n'

        // Add children
        if (element.children && element.children.length > 0) {
            element.children.forEach((child: any) => {
                html += this.generateElementHTML(child, indent + 2)
            })
        }

        // Close tag
        html += `${indentStr}</${element.tagName}>\n`

        return html
    }

    /**
     * Generate JavaScript for auto-rotation
     * @returns JavaScript code as string
     */
    private generateAutoRotateScript(): string {
        return `
        // Add rotation animation to all objects without animation
        const objects = document.querySelectorAll('a-box, a-sphere, a-cylinder, a-cone, a-torus, a-gltf-model');
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj.hasAttribute('animation')) {
                obj.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 10000; easing: linear');
            }
        }`
    }

    /**
     * Escape HTML special characters
     * @param text Text to escape
     * @returns Escaped text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
