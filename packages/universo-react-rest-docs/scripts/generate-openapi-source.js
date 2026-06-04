#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const repoRoot = path.resolve(__dirname, '../../..')
const outputPath = path.join(repoRoot, 'packages/universo-react-rest-docs/src/openapi/index.yml')

const publicSecurity = []
const bearerSecurity = [{ BearerAuth: [] }]

const tagDescriptions = {
    System: 'Health and runtime readiness endpoints.',
    Auth: 'Authentication, registration, session bootstrap, and CSRF support endpoints.',
    'Public Locales': 'Public locale feeds available before authenticated bootstrap.',
    Profile: 'Profile and personal settings endpoints.',
    Onboarding: 'Authenticated onboarding and start-flow endpoints.',
    'Admin Global Users': 'Global user administration endpoints.',
    'Admin Instances': 'Platform instance administration endpoints.',
    'Admin Roles': 'Global role and permission management endpoints.',
    'Admin Locales': 'Administrative locale management endpoints.',
    'Admin Settings': 'Administrative platform settings endpoints.',
    Applications: 'Application catalog and application membership/runtime metadata endpoints.',
    Connectors: 'Application connector and connector-publication link endpoints.',
    'Application Runtime Sync': 'Application schema sync, diff, and release-bundle endpoints.',
    Metahubs: 'Metahub CRUD and member-management endpoints.',
    'Public Metahubs': 'Publicly readable metahub endpoints.',
    Branches: 'Metahub branch management endpoints.',
    Publications: 'Publication lifecycle, versions, and publication-application link endpoints.',
    'Metahub Migrations': 'Metahub migration status, planning, and apply endpoints.',
    'Application Migrations': 'Application migration history and controlled apply endpoints inside the metahub domain.',
    'Entity Types': 'Entity-type definition CRUD endpoints for direct standard kinds and custom entity kinds.',
    Entities: 'Canonical entity-owned instance routes for custom and standard metadata kinds, including managed child-resource tabs.',
    'Entity Actions': 'Entity action definition and execution endpoints.',
    'Event Bindings': 'Entity event-binding endpoints for design-time automation wiring.',
    Attributes: 'Attribute CRUD, move, display, reorder, and child management endpoints.',
    Constants: 'Constant CRUD, reorder, move, and copy endpoints.',
    Records: 'Record CRUD, reorder, move, and copy endpoints.',
    Layouts: 'Layout CRUD and zone-widget endpoints.',
    Modules: 'Metahub module CRUD and source-management endpoints.',
    Packages: 'Metahub package registry and attachment endpoints.',
    'Shared Entity Overrides': 'Metahub-level shared entity override endpoints.',
    Settings: 'Metahub settings and metahub setting-key endpoints.',
    Templates: 'Template catalog endpoints.'
}

const routeSources = [
    {
        file: 'packages/universo-react-core-backend/src/routes/ping/index.ts',
        mountPrefix: '/ping',
        tag: 'System',
        security: publicSecurity
    },
    {
        file: 'packages/universo-react-auth-backend/src/routes/auth.ts',
        mountPrefix: '/auth',
        tag: 'Auth',
        security: publicSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/publicLocalesRoutes.ts',
        mountPrefix: '/locales',
        tag: 'Public Locales',
        security: publicSecurity
    },
    {
        file: 'packages/universo-react-profile-backend/src/routes/profileRoutes.ts',
        mountPrefix: '/profile',
        tag: 'Profile',
        security: bearerSecurity,
        publicPathMatchers: [/^\/check-nickname\//]
    },
    {
        file: 'packages/universo-react-start-backend/src/routes/onboardingRoutes.ts',
        mountPrefix: '/onboarding',
        tag: 'Onboarding',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/globalUsersRoutes.ts',
        mountPrefix: '/admin/global-users',
        tag: 'Admin Global Users',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/instancesRoutes.ts',
        mountPrefix: '/admin/instances',
        tag: 'Admin Instances',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/rolesRoutes.ts',
        mountPrefix: '/admin/roles',
        tag: 'Admin Roles',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/localesRoutes.ts',
        mountPrefix: '/admin/locales',
        tag: 'Admin Locales',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-admin-backend/src/routes/adminSettingsRoutes.ts',
        mountPrefix: '/admin/settings',
        tag: 'Admin Settings',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts',
        mountPrefix: '/applications',
        tag: 'Applications',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-applications-backend/src/routes/connectorsRoutes.ts',
        mountPrefix: '',
        tag: 'Connectors',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-applications-backend/src/routes/applicationSyncRoutes.ts',
        mountPrefix: '',
        tag: 'Application Runtime Sync',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/metahubs/routes/publicMetahubsRoutes.ts',
        mountPrefix: '/public/metahub',
        tag: 'Public Metahubs',
        security: publicSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/metahubs/routes/metahubsRoutes.ts',
        mountPrefix: '',
        tag: 'Metahubs',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/branches/routes/branchesRoutes.ts',
        mountPrefix: '',
        tag: 'Branches',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/publications/routes/publicationsRoutes.ts',
        mountPrefix: '',
        tag: 'Publications',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/metahubs/routes/metahubMigrationsRoutes.ts',
        mountPrefix: '',
        tag: 'Metahub Migrations',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/applications/routes/applicationMigrationsRoutes.ts',
        mountPrefix: '',
        tag: 'Application Migrations',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/routes/entityInstancesRoutes.ts',
        mountPrefix: '',
        tag: 'Entities',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/routes/entityTypesRoutes.ts',
        mountPrefix: '',
        tag: 'Entity Types',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/routes/actionsRoutes.ts',
        mountPrefix: '',
        tag: 'Entity Actions',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/routes/eventBindingsRoutes.ts',
        mountPrefix: '',
        tag: 'Event Bindings',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/metadata/component/routes.ts',
        mountPrefix: '',
        tag: 'Attributes',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/metadata/fixedValue/routes.ts',
        mountPrefix: '',
        tag: 'Constants',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/entities/metadata/record/routes.ts',
        mountPrefix: '',
        tag: 'Records',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/layouts/routes/layoutsRoutes.ts',
        mountPrefix: '',
        tag: 'Layouts',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/modules/routes/modulesRoutes.ts',
        mountPrefix: '',
        tag: 'Modules',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/packages/routes/packagesRoutes.ts',
        mountPrefix: '',
        tag: 'Packages',
        security: bearerSecurity,
        publicPathMatchers: [/^\/metahub\/:metahubId\/packages\/:packageSlug\/editor-artifact-token\//]
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/routes/playCanvasProjectsRoutes.ts',
        mountPrefix: '',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/shared/routes/sharedEntityOverridesRoutes.ts',
        mountPrefix: '',
        tag: 'Shared Entity Overrides',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/settings/routes/settingsRoutes.ts',
        mountPrefix: '',
        tag: 'Settings',
        security: bearerSecurity
    },
    {
        file: 'packages/universo-react-metahubs-backend/src/domains/templates/routes/templatesRoutes.ts',
        mountPrefix: '',
        tag: 'Templates',
        security: bearerSecurity
    }
]

const manualOperations = [
    {
        method: 'get',
        path: '/health/db',
        tag: 'System',
        security: publicSecurity,
        description: 'Database health endpoint mounted directly by the core backend runtime.'
    }
]

const joinPaths = (prefix, routePath) => {
    const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '')
    const normalizedRoute = routePath === '/' ? '' : routePath.replace(/^\//, '')
    const combined = [normalizedPrefix, normalizedRoute].filter(Boolean).join('/')
    return `/${combined}`.replace(/\/+/g, '/') || '/'
}

const convertPathParams = (routePath) => routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}')

const sanitizeOperationId = (value) =>
    value
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')

const extractPathParams = (routePath) => {
    const params = []
    const regex = /:([A-Za-z0-9_]+)/g
    let match = regex.exec(routePath)

    while (match) {
        params.push(match[1])
        match = regex.exec(routePath)
    }

    return params
}

const buildParameters = (routePath) =>
    extractPathParams(routePath).map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `${name} path parameter.`
    }))

const buildResponses = (method, isSecure) => {
    const responses = {}

    if (method === 'post') {
        responses['200'] = { $ref: '#/components/responses/GenericSuccess' }
        responses['201'] = { $ref: '#/components/responses/CreatedSuccess' }
    } else if (method === 'delete') {
        responses['200'] = { $ref: '#/components/responses/GenericSuccess' }
        responses['204'] = { $ref: '#/components/responses/NoContent' }
    } else {
        responses['200'] = { $ref: '#/components/responses/GenericSuccess' }
    }

    responses['400'] = { $ref: '#/components/responses/BadRequest' }
    if (isSecure) {
        responses['401'] = { $ref: '#/components/responses/Unauthorized' }
        responses['403'] = { $ref: '#/components/responses/Forbidden' }
    }
    responses['404'] = { $ref: '#/components/responses/NotFound' }
    responses['409'] = { $ref: '#/components/responses/Conflict' }
    responses['429'] = { $ref: '#/components/responses/TooManyRequests' }
    responses['500'] = { $ref: '#/components/responses/InternalError' }

    return responses
}

const buildRequestBody = () => ({
    required: false,
    content: {
        'application/json': {
            schema: { $ref: '#/components/schemas/GenericObject' }
        }
    }
})

const jsonSchemaRef = (schemaName) => ({
    content: {
        'application/json': {
            schema: { $ref: `#/components/schemas/${schemaName}` }
        }
    }
})

const successResponse = (schemaName, description = 'Successful response.') => ({
    description,
    ...jsonSchemaRef(schemaName)
})

const createdResponse = (schemaName) => successResponse(schemaName, 'Successful create or action response.')

const packageOperationOverrides = {
    'GET /metahub/{metahubId}/packages': {
        responses: {
            200: successResponse('MetahubPackageAttachmentListResponse')
        }
    },
    'POST /metahub/{metahubId}/packages': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PackageAttachRequest')
        },
        responses: {
            201: createdResponse('MetahubPackageAttachment')
        }
    },
    'GET /metahub/{metahubId}/packages/catalog': {
        responses: {
            200: successResponse('MetahubPackageCatalogResponse')
        }
    },
    'GET /metahub/{metahubId}/packages/{packageSlug}/authoring-host': {
        responses: {
            200: successResponse('PackageAuthoringHostDescriptor')
        }
    },
    'GET /metahub/{metahubId}/packages/{packageSlug}/editor-artifact-token/{artifactToken}/*': {
        responses: {
            200: { $ref: '#/components/responses/GenericSuccess' }
        }
    },
    'PATCH /metahub/{metahubId}/package/{attachmentId}': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PackageChangeVersionRequest')
        },
        responses: {
            200: successResponse('MetahubPackageAttachment')
        }
    },
    'PATCH /metahub/{metahubId}/package/{attachmentId}/config': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PackageUpdateConfigRequest')
        },
        responses: {
            200: successResponse('MetahubPackageAttachment')
        }
    }
}

const applyOperationOverride = (openApiOperation, method, openApiPath) => {
    const override = packageOperationOverrides[`${method.toUpperCase()} ${openApiPath}`]
    if (!override) {
        return openApiOperation
    }

    return {
        ...openApiOperation,
        ...('requestBody' in override ? { requestBody: override.requestBody } : {}),
        responses: {
            ...openApiOperation.responses,
            ...override.responses
        }
    }
}

const parseRoutePaths = (fileContent) => {
    const operations = []
    const routeRegex = /router\.(get|post|put|patch|delete)\(\s*(\[[\s\S]*?\]|'[^']+'|"[^"]+")/g
    let match = routeRegex.exec(fileContent)

    while (match) {
        const method = match[1].toLowerCase()
        const rawTarget = match[2]
        const quotedMatches = rawTarget.match(/'([^']+)'|"([^"]+)"/g) || []
        for (const quoted of quotedMatches) {
            operations.push({ method, routePath: quoted.slice(1, -1) })
        }
        match = routeRegex.exec(fileContent)
    }

    return operations
}

const shouldBePublic = (routePath, publicPathMatchers = []) => publicPathMatchers.some((matcher) => matcher.test(routePath))

const buildSpec = () => {
    const operationsByPath = new Map()

    for (const source of routeSources) {
        const absolutePath = path.join(repoRoot, source.file)
        const fileContent = fs.readFileSync(absolutePath, 'utf8')
        const operations = parseRoutePaths(fileContent)

        for (const operation of operations) {
            const concretePath = joinPaths(source.mountPrefix, operation.routePath)
            const openApiPath = convertPathParams(concretePath)
            const isPublic = shouldBePublic(operation.routePath, source.publicPathMatchers)
            const security = isPublic ? publicSecurity : source.security
            const isSecure = security.length > 0

            if (!operationsByPath.has(openApiPath)) {
                operationsByPath.set(openApiPath, {})
            }

            operationsByPath.get(openApiPath)[operation.method] = applyOperationOverride(
                {
                    tags: [source.tag],
                    summary: `${operation.method.toUpperCase()} ${openApiPath}`,
                    description: `Auto-generated from ${source.file}. This operation is mounted on the live backend route surface and should be treated as current repository truth.`,
                    operationId: sanitizeOperationId(`${source.tag}_${operation.method}_${openApiPath}`),
                    parameters: buildParameters(concretePath),
                    responses: buildResponses(operation.method, isSecure),
                    ...(operation.method === 'post' || operation.method === 'put' || operation.method === 'patch'
                        ? { requestBody: buildRequestBody() }
                        : {}),
                    ...(isSecure ? { security } : {})
                },
                operation.method,
                openApiPath
            )
        }
    }

    for (const manual of manualOperations) {
        const openApiPath = convertPathParams(manual.path)
        if (!operationsByPath.has(openApiPath)) {
            operationsByPath.set(openApiPath, {})
        }

        operationsByPath.get(openApiPath)[manual.method] = {
            tags: [manual.tag],
            summary: `${manual.method.toUpperCase()} ${openApiPath}`,
            description: manual.description,
            operationId: sanitizeOperationId(`${manual.tag}_${manual.method}_${openApiPath}`),
            parameters: buildParameters(manual.path),
            responses: buildResponses(manual.method, manual.security.length > 0),
            ...(manual.security.length > 0 ? { security: manual.security } : {})
        }
    }

    return {
        openapi: '3.1.0',
        info: {
            title: 'Universo Platformo REST API',
            version: '3.1.0',
            description:
                'Current-state OpenAPI catalog for the mounted Universo Platformo REST surface. This specification is generated from the live backend route files so the documented path and method inventory stays aligned with the repository after refactors.',
            contact: {
                name: 'Universo Platformo API Support',
                url: 'https://universo.pro/support',
                email: 'api@universo.pro'
            },
            license: {
                name: 'Omsk Open License',
                url: 'https://universo.pro/ol'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Local development server'
            },
            {
                url: 'https://your-instance.example.com/api/v1',
                description: 'Deployed instance placeholder'
            }
        ],
        tags: Object.keys(tagDescriptions).map((name) => ({ name, description: tagDescriptions[name] })),
        paths: Object.fromEntries(Array.from(operationsByPath.entries()).sort(([a], [b]) => a.localeCompare(b))),
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Supabase-compatible bearer JWT used by authenticated /api/v1 endpoints.'
                }
            },
            schemas: {
                GenericObject: {
                    type: 'object',
                    additionalProperties: true,
                    description:
                        'Generic JSON object used where the route inventory is current but payload-specific schemas remain handler-defined.'
                },
                VersionedLocalizedContent: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                    properties: {
                        en: { type: 'string' },
                        ru: { type: 'string' }
                    },
                    description: 'Localized package label or description map keyed by locale code.'
                },
                PackageDisplayMode: {
                    type: 'string',
                    enum: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
                    description: 'Metahub authoring display mode for an attached package.'
                },
                PackageAttachmentEmptyConfig: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        kind: { type: 'string', enum: ['none'] }
                    },
                    required: ['schemaVersion', 'kind'],
                    description: 'Package configuration for packages without a user-visible authoring surface.'
                },
                PackageAttachmentDisplaySettings: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        mode: { $ref: '#/components/schemas/PackageDisplayMode' },
                        developmentUrl: {
                            type: ['string', 'null'],
                            format: 'uri',
                            description:
                                'Optional trusted development URL used only when the package is configured for development hosting.'
                        },
                        showArtifactOnlyNotice: {
                            type: 'boolean',
                            description: 'Whether the host should show that only the isolated editor artifact is available.'
                        }
                    },
                    required: ['mode', 'showArtifactOnlyNotice'],
                    description: 'Display settings for a package authoring surface.'
                },
                PackageAttachmentDisplayConfig: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        kind: { type: 'string', enum: ['display'] },
                        display: { $ref: '#/components/schemas/PackageAttachmentDisplaySettings' }
                    },
                    required: ['schemaVersion', 'kind', 'display'],
                    description: 'Package configuration for packages with a user-visible authoring surface.'
                },
                PackageAttachmentConfig: {
                    oneOf: [
                        { $ref: '#/components/schemas/PackageAttachmentEmptyConfig' },
                        { $ref: '#/components/schemas/PackageAttachmentDisplayConfig' }
                    ],
                    description: 'Mutable metahub-scoped package configuration.'
                },
                PackageAuthoringSurfaceDescriptor: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        kind: { type: 'string', enum: ['none', 'playcanvasEditor'] },
                        packageSlug: { type: 'string' },
                        supportedDisplayModes: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PackageDisplayMode' }
                        },
                        defaultConfig: { $ref: '#/components/schemas/PackageAttachmentConfig' }
                    },
                    required: ['schemaVersion', 'kind', 'supportedDisplayModes', 'defaultConfig'],
                    description: 'Authoring surface metadata exposed by a package catalog item.'
                },
                PackageSourceDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        kind: { type: 'string', enum: ['workspace'] },
                        packageName: { type: 'string' },
                        importName: { type: 'string' },
                        upstreamPackageName: { type: 'string' },
                        upstreamVersion: { type: 'string' },
                        runtimeTargets: {
                            type: 'array',
                            items: { type: 'string', enum: ['server', 'client'] }
                        }
                    },
                    required: ['kind', 'packageName', 'importName', 'upstreamPackageName', 'upstreamVersion', 'runtimeTargets'],
                    description: 'Package source metadata used by package registry and attachment responses.'
                },
                MetahubPackageAttachment: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string' },
                        metahubId: { type: 'string' },
                        packageId: { type: 'string' },
                        packageName: { type: 'string' },
                        version: { type: 'string' },
                        displayName: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        description: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        source: { $ref: '#/components/schemas/PackageSourceDescriptor' },
                        authoringSurface: { $ref: '#/components/schemas/PackageAuthoringSurfaceDescriptor' },
                        config: { $ref: '#/components/schemas/PackageAttachmentConfig' },
                        attachedAt: { type: 'string', format: 'date-time' },
                        isActive: { type: 'boolean' }
                    },
                    required: [
                        'id',
                        'metahubId',
                        'packageId',
                        'packageName',
                        'version',
                        'displayName',
                        'source',
                        'authoringSurface',
                        'config',
                        'attachedAt',
                        'isActive'
                    ],
                    description: 'Package attached to a metahub with metahub-scoped authoring settings.'
                },
                MetahubPackageCatalogItem: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string' },
                        packageName: { type: 'string' },
                        version: { type: 'string' },
                        displayName: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        description: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        source: { $ref: '#/components/schemas/PackageSourceDescriptor' },
                        authoringSurface: { $ref: '#/components/schemas/PackageAuthoringSurfaceDescriptor' },
                        isActive: { type: 'boolean' },
                        attached: { type: 'boolean' },
                        attachedPackageId: { type: ['string', 'null'] },
                        attachedVersion: { type: ['string', 'null'] },
                        attachmentId: { type: ['string', 'null'] }
                    },
                    required: ['id', 'packageName', 'version', 'displayName', 'source', 'authoringSurface', 'isActive', 'attached'],
                    description: 'Package available for attachment from the metahub package catalog.'
                },
                MetahubPackageAttachmentListResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/MetahubPackageAttachment' }
                        },
                        total: { type: 'integer', minimum: 0 }
                    },
                    required: ['items', 'total']
                },
                MetahubPackageCatalogResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/MetahubPackageCatalogItem' }
                        },
                        total: { type: 'integer', minimum: 0 }
                    },
                    required: ['items', 'total']
                },
                PackageAttachRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        packageName: { type: 'string' },
                        version: { type: 'string' }
                    },
                    required: ['packageName']
                },
                PackageChangeVersionRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        version: { type: 'string' },
                        resetConfig: { type: 'boolean' }
                    },
                    required: ['version']
                },
                PackageUpdateConfigRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        config: { $ref: '#/components/schemas/PackageAttachmentConfig' }
                    },
                    required: ['config']
                },
                PackageAuthoringHostDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        packageSlug: { type: 'string' },
                        packageName: { type: 'string' },
                        version: { type: 'string' },
                        displayName: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        description: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        attachmentConfig: { $ref: '#/components/schemas/PackageAttachmentConfig' },
                        authoringSurface: { $ref: '#/components/schemas/PackageAuthoringSurfaceDescriptor' },
                        allowedDisplayModes: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PackageDisplayMode' }
                        },
                        artifactStatus: {
                            type: 'string',
                            enum: ['available', 'missing', 'disabled', 'blocked', 'misconfigured']
                        },
                        artifactUrl: { type: ['string', 'null'] }
                    },
                    required: [
                        'packageSlug',
                        'packageName',
                        'version',
                        'displayName',
                        'attachmentConfig',
                        'authoringSurface',
                        'allowedDisplayModes',
                        'artifactStatus'
                    ],
                    description: 'Descriptor consumed by the metahub package authoring host route.'
                },
                ApiError: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                        details: {
                            oneOf: [
                                { type: 'object', additionalProperties: true },
                                { type: 'array', items: {} },
                                { type: 'string' },
                                { type: 'null' }
                            ]
                        }
                    },
                    description: 'Generic error envelope used across backend route packages.'
                }
            },
            responses: {
                GenericSuccess: {
                    description: 'Successful response.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/GenericObject' }
                        }
                    }
                },
                CreatedSuccess: {
                    description: 'Successful create or action response.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/GenericObject' }
                        }
                    }
                },
                NoContent: {
                    description: 'Successful response with no body.'
                },
                BadRequest: {
                    description: 'Request validation failed.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                Unauthorized: {
                    description: 'Authentication is required or the token is invalid.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                Forbidden: {
                    description: 'The caller is authenticated but lacks required access.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                NotFound: {
                    description: 'Requested resource was not found.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                Conflict: {
                    description: 'The operation conflicts with current server state.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                TooManyRequests: {
                    description: 'Rate limit exceeded.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                },
                InternalError: {
                    description: 'Unexpected server error.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApiError' }
                        }
                    }
                }
            }
        }
    }
}

const writeSpec = () => {
    const spec = buildSpec()
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, YAML.stringify(spec), 'utf8')
    console.log(`[generate-openapi-source] Generated ${outputPath}`)
}

module.exports = {
    routeSources,
    buildSpec,
    writeSpec,
    outputPath,
    repoRoot
}

if (require.main === module) {
    writeSpec()
}
