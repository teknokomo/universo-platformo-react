import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

export function loadOpenApiSpec(): object {
    // Always use bundled file - it has all $ref resolved
    // Modular files are used only for authoring, bundle-openapi.js merges them
    const specPath = path.join(__dirname, '../openapi-bundled.yml')

    if (!fs.existsSync(specPath)) {
        throw new Error(`OpenAPI spec not found at ${specPath}. Run 'pnpm build:openapi' first.`)
    }

    const specContent = fs.readFileSync(specPath, 'utf8')
    return YAML.parse(specContent)
}

export const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Universo Platformo API Docs'
}
