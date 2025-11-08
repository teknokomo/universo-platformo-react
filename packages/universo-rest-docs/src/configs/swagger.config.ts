import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

export function loadOpenApiSpec(): object {
    const isDev = process.env.NODE_ENV !== 'production'
    const specPath = isDev ? path.join(__dirname, '../../src/openapi/index.yml') : path.join(__dirname, '../openapi-bundled.yml')

    if (!fs.existsSync(specPath)) {
        throw new Error(`OpenAPI spec not found at ${specPath}`)
    }

    const specContent = fs.readFileSync(specPath, 'utf8')
    return YAML.parse(specContent)
}

export const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Universo Platformo API Docs'
}
