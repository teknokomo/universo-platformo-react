import express, { Request, Response } from 'express'
import swaggerUi from 'swagger-ui-express'
import { loadOpenApiSpec, swaggerUiOptions } from './configs/swagger.config'

const app = express()
const PORT = process.env.REST_DOCS_PORT ? parseInt(process.env.REST_DOCS_PORT, 10) : 6655

// Load OpenAPI specification
const openApiSpec = loadOpenApiSpec()

app.get('/', (req: Request, res: Response) => {
    res.redirect('/api-docs')
})

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions))

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[universo-rest-docs] Universo Platformo API documentation server listening on port ${PORT}`)
    // eslint-disable-next-line no-console
    console.log(`[universo-rest-docs] Environment: ${process.env.NODE_ENV || 'development'}`)
    // eslint-disable-next-line no-console
    console.log(`[universo-rest-docs] Swagger UI available at http://localhost:${PORT}/api-docs`)
})
