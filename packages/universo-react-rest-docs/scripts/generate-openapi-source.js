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
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/config',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only minimal PlayCanvas Editor compatibility REST config for a metahub project.',
        responseSchema: 'PlayCanvasEditorCompatibilityConfig'
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only list of scene summaries exposed through the minimal PlayCanvas Editor compatibility REST namespace.',
        responseSchema: 'PlayCanvasEditorCompatibilitySceneSummaryList'
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes/:sceneId',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only scene read endpoint for the minimal PlayCanvas Editor compatibility REST namespace.',
        responseSchema: 'PlayCanvasEditorCompatibilitySceneReadResponse'
    },
    {
        method: 'put',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/scenes/:sceneId',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only scene save endpoint for the minimal PlayCanvas Editor compatibility REST namespace.',
        requestSchema: 'PlayCanvasEditorCompatibilitySceneSaveRequest',
        responseSchema: 'PlayCanvasEditorCompatibilitySceneSaveResponse'
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only asset summary list for the minimal PlayCanvas Editor compatibility REST namespace.',
        responseSchema: 'PlayCanvasEditorCompatibilityAssetSummaryList'
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/settings/:kind',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only scoped settings document read for the minimal PlayCanvas Editor compatibility REST namespace.',
        responseSchema: 'PlayCanvasEditorCompatibilitySettingsDocumentResponse'
    },
    {
        method: 'put',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/settings/:kind',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Manager-only scoped settings document write for the minimal PlayCanvas Editor compatibility REST namespace.',
        requestSchema: 'PlayCanvasEditorCompatibilitySettingsWriteRequest',
        responseSchema: 'PlayCanvasEditorCompatibilitySettingsWriteResponse'
    },
    {
        method: 'get',
        path: '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/cloud-only/:surface',
        tag: 'PlayCanvas Projects',
        security: bearerSecurity,
        description: 'Explicit no-op descriptor for PlayCanvas Cloud-only surfaces outside the first Universo backend slice.',
        responseSchema: 'PlayCanvasEditorCompatibilityNoOpResponse'
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

const interpretationNetworkOperationOverrides = {
    'PATCH /applications/{applicationId}/layouts/zone-widgets/config/batch': {
        responses: {
            409: { $ref: '#/components/responses/ApplicationInterpretationNetworkStructureModeConflict' }
        }
    },
    'POST /applications/{applicationId}/layouts/zone-widgets/config/reset': {
        summary: 'Restore application layout widgets from the current metahub baseline',
        description:
            'Owner/admin-only atomic reset of inherited layout widgets to their latest materialized metahub sourceConfig. Every widgetId may occur only once in the batch. Application-authored or source-less widgets, stale expectedVersion values, incomplete Interpretation Network metadata, and unsafe single-system transitions fail the entire batch.',
        requestBody: {
            required: true,
            ...jsonSchemaRef('ApplicationLayoutWidgetResetBatchRequest')
        },
        responses: {
            200: successResponse('ApplicationLayoutWidgetBatchResponse'),
            400: { $ref: '#/components/responses/ApplicationLayoutWidgetResetBadRequest' },
            409: { $ref: '#/components/responses/ApplicationLayoutWidgetResetConflict' }
        },
        removeResponses: ['201']
    },
    'GET /applications/{applicationId}/runtime/interpretation-network': {
        responses: {
            200: successResponse('InterpretationNetworkRuntimeSurface')
        }
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/system-structure/ensure': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkEnsureSystemStructureRequest')
        },
        responses: {
            200: successResponse('InterpretationNetworkSystemStructure'),
            201: createdResponse('InterpretationNetworkSystemStructure'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        }
    },
    'GET /applications/{applicationId}/runtime/interpretation-network/templates': {
        responses: {
            200: successResponse('InterpretationNetworkTemplateList')
        }
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/templates': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkTemplateSaveRequest')
        },
        responses: {
            201: createdResponse('InterpretationNetworkTemplateSummary'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'GET /applications/{applicationId}/runtime/interpretation-network/templates/{templateId}': {
        responses: {
            200: successResponse('InterpretationNetworkTemplateDetail')
        }
    },
    'PATCH /applications/{applicationId}/runtime/interpretation-network/templates/{templateId}': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkTemplateUpdateRequest')
        },
        responses: {
            200: successResponse('InterpretationNetworkTemplateSummary'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        }
    },
    'DELETE /applications/{applicationId}/runtime/interpretation-network/templates/{templateId}': {
        requestBody: {
            required: false,
            ...jsonSchemaRef('InterpretationNetworkVersionedDeleteRequest')
        },
        responses: {
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/templates/{templateId}/instantiate': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkTemplateInstantiateRequest')
        },
        responses: {
            201: createdResponse('InterpretationNetworkTemplateInstantiateResponse'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/materials': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkMaterialCreateRequest')
        },
        responses: {
            201: createdResponse('InterpretationNetworkMaterialCreateResponse'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/structures': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkStructureCreateRequest')
        },
        responses: {
            201: createdResponse('InterpretationNetworkStructureCreateResponse'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'DELETE /applications/{applicationId}/runtime/interpretation-network/structures/{structureId}': {
        requestBody: {
            required: false,
            ...jsonSchemaRef('InterpretationNetworkVersionedDeleteRequest')
        },
        responses: {
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/matrix/cells': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkMatrixCellCreateRequest')
        },
        responses: {
            201: createdResponse('InterpretationNetworkMatrixCellCreateResponse'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['200']
    },
    'POST /applications/{applicationId}/runtime/interpretation-network/matrix/cells/move': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('InterpretationNetworkMatrixCellMoveRequest')
        },
        responses: {
            200: successResponse('InterpretationNetworkMatrixCellMoveResponse'),
            409: { $ref: '#/components/responses/InterpretationNetworkConflict' }
        },
        removeResponses: ['201']
    }
}

const playCanvasProjectFileSourcePathQueryParameter = {
    name: 'sourcePath',
    in: 'query',
    required: true,
    schema: {
        type: 'string',
        minLength: 1,
        maxLength: 512
    },
    description: 'Metahub-scoped PlayCanvas project file source path to read, write, or delete.'
}

const playCanvasAssetFileSourcePathQueryParameter = {
    name: 'sourcePath',
    in: 'query',
    required: true,
    schema: {
        type: 'string',
        minLength: 1,
        maxLength: 512
    },
    description: 'Metahub-scoped PlayCanvas asset file source path to read, write, or delete.'
}

const playCanvasExpectedCurrentChecksumQueryParameter = {
    name: 'expectedCurrentChecksum',
    in: 'query',
    required: true,
    schema: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{64}$'
    },
    description: 'Current file checksum required before deleting a PlayCanvas project file.'
}

const playCanvasAssetExpectedCurrentChecksumQueryParameter = {
    name: 'expectedCurrentChecksum',
    in: 'query',
    required: true,
    schema: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{64}$'
    },
    description: 'Current file checksum required before deleting a PlayCanvas asset file.'
}

const packageOperationOverrides = {
    ...interpretationNetworkOperationOverrides,
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
    },
    'POST /metahub/{metahubId}/playcanvas/editor-bridge/commands': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PlayCanvasEditorBridgeCommandRequest')
        },
        responses: {
            200: successResponse('PlayCanvasEditorBridgeResponse')
        },
        removeResponses: ['201']
    },
    'GET /metahub/{metahubId}/playcanvas/projects/{projectId}/files': {
        parameters: [playCanvasProjectFileSourcePathQueryParameter],
        responses: {}
    },
    'PUT /metahub/{metahubId}/playcanvas/projects/{projectId}/files': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PlayCanvasProjectFileWriteRequest')
        },
        responses: {}
    },
    'DELETE /metahub/{metahubId}/playcanvas/projects/{projectId}/files': {
        parameters: [playCanvasProjectFileSourcePathQueryParameter, playCanvasExpectedCurrentChecksumQueryParameter],
        responses: {}
    },
    'GET /metahub/{metahubId}/playcanvas/projects/{projectId}/assets/{assetId}/file': {
        parameters: [playCanvasAssetFileSourcePathQueryParameter],
        responses: {}
    },
    'PUT /metahub/{metahubId}/playcanvas/projects/{projectId}/assets/{assetId}/file': {
        requestBody: {
            required: true,
            ...jsonSchemaRef('PlayCanvasAssetFileWriteRequest')
        },
        responses: {}
    },
    'DELETE /metahub/{metahubId}/playcanvas/projects/{projectId}/assets/{assetId}/file': {
        parameters: [playCanvasAssetFileSourcePathQueryParameter, playCanvasAssetExpectedCurrentChecksumQueryParameter],
        responses: {}
    },
    'GET /metahub/{metahubId}/playcanvas/editor-compatible/projects/{projectId}/protocol': {
        responses: {
            200: successResponse('PlayCanvasEditorCompatibilityProtocolResponse')
        }
    }
}

const applyOperationOverride = (openApiOperation, method, openApiPath) => {
    const override = packageOperationOverrides[`${method.toUpperCase()} ${openApiPath}`]
    if (!override) {
        return openApiOperation
    }

    const responses = {
        ...openApiOperation.responses,
        ...override.responses
    }

    for (const statusCode of override.removeResponses || []) {
        delete responses[statusCode]
    }

    return {
        ...openApiOperation,
        ...('summary' in override ? { summary: override.summary } : {}),
        ...('description' in override ? { description: override.description } : {}),
        ...('requestBody' in override ? { requestBody: override.requestBody } : {}),
        ...('parameters' in override
            ? {
                  parameters: [...(openApiOperation.parameters ?? []), ...override.parameters]
              }
            : {}),
        responses
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
            parameters: [...buildParameters(manual.path), ...(manual.parameters ?? [])],
            responses: {
                ...buildResponses(manual.method, manual.security.length > 0),
                ...(manual.responseSchema ? { 200: successResponse(manual.responseSchema) } : {}),
                ...(manual.responses ?? {})
            },
            ...(manual.requestSchema
                ? {
                      requestBody: {
                          required: true,
                          ...jsonSchemaRef(manual.requestSchema)
                      }
                  }
                : {}),
            ...(manual.requestBody ? { requestBody: manual.requestBody } : {}),
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
                ApplicationLayoutWidgetResetBatchRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        updates: {
                            type: 'array',
                            minItems: 1,
                            maxItems: 100,
                            description:
                                'Widgets to reset atomically. Each widgetId may appear only once in the batch, regardless of layoutId.',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    layoutId: { type: 'string', format: 'uuid' },
                                    widgetId: { type: 'string', format: 'uuid' },
                                    expectedVersion: { type: 'integer', minimum: 1 }
                                },
                                required: ['layoutId', 'widgetId']
                            }
                        }
                    },
                    required: ['updates']
                },
                ApplicationLayoutWidgetBatchResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ApplicationLayoutWidget' }
                        }
                    },
                    required: ['items']
                },
                ApplicationLayoutWidget: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        layoutId: { type: 'string', format: 'uuid' },
                        zone: { type: 'string', enum: ['left', 'top', 'right', 'bottom', 'center'] },
                        widgetKey: { type: 'string' },
                        sortOrder: { type: 'integer' },
                        config: { type: 'object', additionalProperties: true },
                        sourceConfig: {
                            oneOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }]
                        },
                        isCustomized: { type: 'boolean' },
                        isActive: { type: 'boolean' },
                        version: { type: 'integer', minimum: 1 }
                    },
                    required: [
                        'id',
                        'layoutId',
                        'zone',
                        'widgetKey',
                        'sortOrder',
                        'config',
                        'sourceConfig',
                        'isCustomized',
                        'isActive',
                        'version'
                    ]
                },
                InterpretationNetworkLocalizedContentEntry: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        content: { type: 'string' },
                        version: { type: 'integer', minimum: 1 },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    },
                    required: ['content', 'version', 'isActive', 'createdAt', 'updatedAt']
                },
                InterpretationNetworkLocalizedString: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        _schema: { type: 'string', enum: ['1'] },
                        _primary: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
                        locales: {
                            type: 'object',
                            minProperties: 1,
                            propertyNames: { pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
                            additionalProperties: { $ref: '#/components/schemas/InterpretationNetworkLocalizedContentEntry' }
                        }
                    },
                    required: ['_schema', '_primary', 'locales']
                },
                InterpretationNetworkLocalizedStringInput: {
                    oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/InterpretationNetworkLocalizedString' }],
                    description: 'Localized text accepted either as a plain primary-locale string or canonical VLC data.'
                },
                InterpretationNetworkExpectedVersion: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Optimistic-lock version. A stale version produces an HTTP 409 conflict.'
                },
                InterpretationNetworkRuntimeSurface: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        applicationId: { type: 'string' },
                        workspaceId: { type: ['string', 'null'], format: 'uuid' },
                        featureState: { type: 'string', enum: ['ready', 'missing-widget', 'missing-metadata'] },
                        missing: { type: 'array', items: { type: 'string' } },
                        structureMode: { type: 'string', enum: ['multiple', 'singleSystem'] },
                        widgetKey: { type: 'string', enum: ['interpretationNetworkWorkspace'] }
                    },
                    required: ['applicationId', 'workspaceId', 'featureState', 'missing', 'structureMode', 'widgetKey']
                },
                InterpretationNetworkEnsureSystemStructureRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' }
                    }
                },
                InterpretationNetworkSystemStructure: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        structureId: { type: 'string', format: 'uuid' },
                        interpretationId: { type: 'string', format: 'uuid' },
                        rootCellId: { type: 'string', format: 'uuid' },
                        created: { type: 'boolean' },
                        canCreate: { type: 'boolean' }
                    },
                    required: ['structureId', 'interpretationId', 'rootCellId', 'created', 'canCreate']
                },
                InterpretationNetworkTemplateSummary: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { $ref: '#/components/schemas/InterpretationNetworkLocalizedString' },
                        description: {
                            oneOf: [{ $ref: '#/components/schemas/InterpretationNetworkLocalizedString' }, { type: 'null' }]
                        },
                        includesMaterials: { type: 'boolean' },
                        version: { type: 'integer', minimum: 1 }
                    },
                    required: ['id', 'name', 'description', 'includesMaterials', 'version']
                },
                InterpretationNetworkTemplateList: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/InterpretationNetworkTemplateSummary' }
                        }
                    },
                    required: ['items']
                },
                InterpretationNetworkTemplateDetail: {
                    allOf: [
                        { $ref: '#/components/schemas/InterpretationNetworkTemplateSummary' },
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                matrix: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        cellCount: { type: 'integer', minimum: 0 },
                                        rootCount: { type: 'integer', minimum: 0 },
                                        maxDepth: { type: 'integer', minimum: 0 }
                                    },
                                    required: ['cellCount', 'rootCount', 'maxDepth']
                                },
                                materialCount: { type: 'integer', minimum: 0 }
                            },
                            required: ['matrix', 'materialCount']
                        }
                    ]
                },
                InterpretationNetworkTemplateSaveRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sourceStructureId: { type: 'string', format: 'uuid' },
                        templateName: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        description: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        includeMaterials: { type: 'boolean' },
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' },
                        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' }
                    },
                    required: ['sourceStructureId', 'templateName', 'includeMaterials']
                },
                InterpretationNetworkTemplateUpdateRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        templateName: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        description: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' },
                        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' }
                    },
                    required: ['templateName']
                },
                InterpretationNetworkVersionedDeleteRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' }
                    }
                },
                InterpretationNetworkTemplateInstantiateRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        structureName: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        description: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' },
                        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' }
                    },
                    required: ['structureName']
                },
                InterpretationNetworkTemplateInstantiateResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        structureId: { type: 'string', format: 'uuid' },
                        interpretationId: { type: 'string', format: 'uuid' }
                    },
                    required: ['structureId', 'interpretationId']
                },
                InterpretationNetworkMaterialCreateRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        interpretationId: { type: 'string', format: 'uuid' },
                        matrixRowId: { type: 'string', format: 'uuid' },
                        cellId: { type: 'string', minLength: 1, maxLength: 255 },
                        data: { type: 'object', additionalProperties: true },
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' }
                    },
                    required: ['interpretationId', 'matrixRowId', 'cellId', 'data']
                },
                InterpretationNetworkMaterialCreateResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', minLength: 1 },
                        matrixRowId: { type: 'string', minLength: 1 }
                    },
                    required: ['id', 'matrixRowId']
                },
                InterpretationNetworkStructureCreateRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        name: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        description: { $ref: '#/components/schemas/InterpretationNetworkLocalizedStringInput' },
                        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' }
                    },
                    required: ['name']
                },
                InterpretationNetworkStructureCreateResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        structureId: { type: 'string', format: 'uuid' },
                        interpretationId: { type: 'string', format: 'uuid' },
                        rootCellId: { type: 'string', format: 'uuid' }
                    },
                    required: ['structureId', 'interpretationId', 'rootCellId']
                },
                InterpretationNetworkMatrixCellPlacement: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        parentCellId: { type: ['string', 'null'], format: 'uuid' },
                        rowKey: { type: 'string' },
                        colKey: { type: 'string' },
                        sortOrder: { type: 'integer', minimum: 0 }
                    }
                },
                InterpretationNetworkMatrixCellCreateRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        interpretationId: { type: 'string', format: 'uuid' },
                        data: { type: 'object', additionalProperties: true },
                        placement: { $ref: '#/components/schemas/InterpretationNetworkMatrixCellPlacement' }
                    },
                    required: ['interpretationId', 'data', 'placement']
                },
                InterpretationNetworkMatrixCellCreateResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        status: { type: 'string', enum: ['created'] },
                        item: { type: 'object', additionalProperties: true }
                    },
                    required: ['id', 'status', 'item']
                },
                InterpretationNetworkMatrixCellMoveUpdate: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        matrixRowId: { type: 'string', format: 'uuid' },
                        expectedVersion: { $ref: '#/components/schemas/InterpretationNetworkExpectedVersion' },
                        placement: { $ref: '#/components/schemas/InterpretationNetworkMatrixCellPlacement' },
                        data: {
                            type: 'object',
                            additionalProperties: true,
                            description: 'Optional user-authored field updates; server-owned placement fields are rejected here.'
                        }
                    },
                    required: ['matrixRowId', 'placement']
                },
                InterpretationNetworkMatrixCellMoveRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        interpretationId: { type: 'string', format: 'uuid' },
                        updates: {
                            type: 'array',
                            minItems: 1,
                            items: { $ref: '#/components/schemas/InterpretationNetworkMatrixCellMoveUpdate' }
                        }
                    },
                    required: ['interpretationId', 'updates']
                },
                InterpretationNetworkMatrixCellMoveResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        status: { type: 'string', enum: ['ok'] },
                        updated: { type: 'array', items: { type: 'string', format: 'uuid' } }
                    },
                    required: ['status', 'updated']
                },
                InterpretationNetworkError: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        error: { type: 'string' },
                        code: { type: 'string', pattern: '^INTERPRETATION_NETWORK_' },
                        details: { type: 'object', additionalProperties: true }
                    },
                    required: ['error', 'code']
                },
                ApplicationInterpretationNetworkStructureModeError: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        error: {
                            type: 'string',
                            enum: ['APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST']
                        },
                        code: {
                            type: 'string',
                            enum: ['APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST']
                        },
                        details: { type: 'object', additionalProperties: true }
                    },
                    anyOf: [{ required: ['error'] }, { required: ['code'] }]
                },
                ApplicationLayoutWidgetResetBadRequestError: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        error: { type: 'string', enum: ['APPLICATION_LAYOUT_WIDGET_RESET_BATCH_INVALID'] }
                    },
                    required: ['error']
                },
                ApplicationLayoutWidgetResetConflictError: {
                    oneOf: [
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                error: { type: 'string', enum: ['APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'] }
                            },
                            required: ['error']
                        },
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                error: {
                                    type: 'string',
                                    enum: ['APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST']
                                },
                                code: {
                                    type: 'string',
                                    enum: ['APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST']
                                }
                            },
                            required: ['error', 'code']
                        },
                        {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                error: {
                                    type: 'string',
                                    enum: ['APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING']
                                },
                                code: {
                                    type: 'string',
                                    enum: ['APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING']
                                }
                            },
                            required: ['error', 'code']
                        }
                    ]
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
                        display: { $ref: '#/components/schemas/PackageAttachmentDisplaySettings' },
                        playcanvasProject: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                defaultProjectId: {
                                    type: ['string', 'null'],
                                    format: 'uuid',
                                    description: 'Optional default PlayCanvas project selected for the package authoring host.'
                                }
                            },
                            description: 'PlayCanvas Editor package-specific display configuration.'
                        }
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
                PlayCanvasProjectSummary: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        codename: { type: 'string' },
                        displayName: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        description: { $ref: '#/components/schemas/VersionedLocalizedContent' },
                        defaultSceneId: { type: ['string', 'null'], format: 'uuid' },
                        status: { type: 'string' },
                        healthStatus: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    },
                    required: ['id', 'codename', 'displayName', 'defaultSceneId', 'status', 'healthStatus'],
                    description: 'Minimal PlayCanvas project metadata selected for an editor bridge session.'
                },
                PlayCanvasEditorBridgeSessionDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sessionId: { type: 'string', format: 'uuid' },
                        sessionToken: { type: 'string' },
                        nonce: { type: 'string', minLength: 32, maxLength: 256 },
                        expiresAt: { type: 'string', format: 'date-time' },
                        bridgeVersion: { type: 'string', enum: ['1'] },
                        writeMode: { type: 'string', enum: ['manager'] },
                        capabilities: {
                            type: 'array',
                            maxItems: 32,
                            items: { $ref: '#/components/schemas/PlayCanvasEditorBridgeCapability' }
                        }
                    },
                    required: ['sessionId', 'sessionToken', 'nonce', 'expiresAt', 'bridgeVersion', 'writeMode', 'capabilities'],
                    description: 'Short-lived manager-only bridge session issued to the PlayCanvas Editor host.'
                },
                PlayCanvasEditorSelectedProjectDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        project: { $ref: '#/components/schemas/PlayCanvasProjectSummary' },
                        defaultSceneId: { type: ['string', 'null'], format: 'uuid' }
                    },
                    required: ['project'],
                    description: 'Selected PlayCanvas project and default scene for the hosted editor.'
                },
                PlayCanvasEditorHostBridgeDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        bridge: { $ref: '#/components/schemas/PlayCanvasEditorBridgeSessionDescriptor' },
                        selectedProject: {
                            oneOf: [{ $ref: '#/components/schemas/PlayCanvasEditorSelectedProjectDescriptor' }, { type: 'null' }]
                        },
                        compatibilityStatus: {
                            type: 'string',
                            enum: ['ready', 'artifactUnavailable', 'projectUnavailable', 'blocked']
                        }
                    },
                    required: ['schemaVersion', 'bridge', 'compatibilityStatus'],
                    description: 'PlayCanvas Editor bridge descriptor embedded in the package authoring host response.'
                },
                PlayCanvasEditorCompatibilitySurfaceDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        status: { type: 'string', enum: ['stubbed', 'disabled', 'unsupported'] },
                        reason: { type: 'string' }
                    },
                    required: ['status', 'reason'],
                    description: 'Compatibility surface status for the current bridge-minimal PlayCanvas Editor slice.'
                },
                PlayCanvasEditorCompatibilityProtocolDescriptor: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        mode: { type: 'string', enum: ['universo-bridge-minimal'] },
                        upstream: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                repository: { type: 'string', enum: ['https://github.com/playcanvas/editor'] },
                                minimumTag: { type: 'string', enum: ['v2.24.2'] }
                            },
                            required: ['repository', 'minimumTag']
                        },
                        project: {
                            oneOf: [{ $ref: '#/components/schemas/PlayCanvasProjectSummary' }, { type: 'null' }]
                        },
                        defaultSceneId: { type: ['string', 'null'], format: 'uuid' },
                        identity: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                self: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        id: { type: 'string' },
                                        role: { type: 'string', enum: ['designer'] }
                                    },
                                    required: ['id', 'role']
                                },
                                owner: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        id: { type: 'string' },
                                        type: { type: 'string', enum: ['user', 'metahub'] }
                                    },
                                    required: ['id', 'type']
                                },
                                permissions: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        read: { type: 'boolean', enum: [true] },
                                        write: { type: 'boolean', enum: [true] },
                                        admin: { type: 'boolean', enum: [false] }
                                    },
                                    required: ['read', 'write', 'admin']
                                },
                                branch: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        active: { type: 'boolean', enum: [true] }
                                    },
                                    required: ['id', 'name', 'active']
                                },
                                teams: { type: 'array', maxItems: 0 },
                                organizations: { type: 'array', maxItems: 0 }
                            },
                            required: ['self', 'owner', 'permissions', 'branch', 'teams', 'organizations']
                        },
                        endpoints: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                rest: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                realtime: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                messenger: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' }
                            },
                            required: ['rest', 'realtime', 'messenger']
                        },
                        shareDb: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                requiredCollections: {
                                    type: 'array',
                                    items: { type: 'string', enum: ['scenes', 'assets', 'settings'] },
                                    minItems: 3,
                                    maxItems: 3
                                },
                                persisted: { type: 'boolean', enum: [false] },
                                persistence: { type: 'string', enum: ['not-implemented'] },
                                sceneStorage: { type: 'string', enum: ['metahub-playcanvas-project-storage'] }
                            },
                            required: ['requiredCollections', 'persisted', 'persistence', 'sceneStorage']
                        },
                        cloudOnly: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                store: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                jobs: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                branchesCheckpoints: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                sourcefiles: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                publishing: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                usersCollaboration: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' },
                                assetPipeline: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' }
                            },
                            required: [
                                'store',
                                'jobs',
                                'branchesCheckpoints',
                                'sourcefiles',
                                'publishing',
                                'usersCollaboration',
                                'assetPipeline'
                            ]
                        },
                        documents: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                codeEditorSourcefiles: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySurfaceDescriptor' }
                            },
                            required: ['codeEditorSourcefiles']
                        },
                        settingsDocuments: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                user: { type: 'string' },
                                projectUser: { type: 'string' },
                                projectPrivate: { type: 'string' }
                            },
                            required: ['user', 'projectUser', 'projectPrivate']
                        }
                    },
                    required: [
                        'schemaVersion',
                        'mode',
                        'upstream',
                        'project',
                        'defaultSceneId',
                        'identity',
                        'endpoints',
                        'shareDb',
                        'cloudOnly',
                        'documents',
                        'settingsDocuments'
                    ],
                    description: 'Read-only PlayCanvas Editor compatibility descriptor for the current bridge-minimal slice.'
                },
                PlayCanvasEditorCompatibilityProtocolResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        item: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilityProtocolDescriptor' }
                    },
                    required: ['item']
                },
                PlayCanvasEditorCompatibilityConfig: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string', enum: ['1'] },
                        mode: { type: 'string', enum: ['universo-compatibility-rest-minimal'] },
                        protocol: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilityProtocolDescriptor' },
                        projectId: { type: 'string', format: 'uuid' },
                        defaultSceneId: { type: ['string', 'null'], format: 'uuid' },
                        userId: { type: 'string' },
                        permissions: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                read: { type: 'boolean', enum: [true] },
                                write: { type: 'boolean', enum: [true] },
                                admin: { type: 'boolean', enum: [false] }
                            },
                            required: ['read', 'write', 'admin']
                        },
                        endpoints: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                scenes: { type: 'string' },
                                assets: { type: 'string' },
                                settings: { type: 'string' },
                                cloudOnly: { type: 'string' }
                            },
                            required: ['scenes', 'assets', 'settings', 'cloudOnly']
                        },
                        auth: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                scheme: { type: 'string', enum: ['signed-header'] },
                                headerName: { type: 'string', enum: ['X-PlayCanvas-Editor-Token'] },
                                accessToken: { type: 'string', minLength: 32 },
                                expiresAt: { type: 'string', format: 'date-time' }
                            },
                            required: ['scheme', 'headerName', 'accessToken', 'expiresAt'],
                            description:
                                'Short-lived signed compatibility REST token contract. Send accessToken in headerName on compatibility REST requests together with the normal authenticated platform session.'
                        },
                        csrf: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                tokenUrl: { type: 'string', enum: ['/api/v1/auth/csrf'] },
                                headerName: { type: 'string', enum: ['X-CSRF-Token'] }
                            },
                            required: ['tokenUrl', 'headerName'],
                            description:
                                'CSRF token contract for same-origin compatibility REST mutations. Fetch tokenUrl and send the token in headerName on PUT requests.'
                        }
                    },
                    required: [
                        'schemaVersion',
                        'mode',
                        'protocol',
                        'projectId',
                        'defaultSceneId',
                        'userId',
                        'permissions',
                        'endpoints',
                        'auth',
                        'csrf'
                    ],
                    description: 'Minimal same-origin REST config exposed to the PlayCanvas Editor compatibility adapter.'
                },
                PlayCanvasEditorCompatibilitySceneSummary: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        displayName: { $ref: '#/components/schemas/GenericObject' },
                        codename: { $ref: '#/components/schemas/GenericObject' },
                        checksum: { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{64}$' },
                        sortOrder: { type: 'integer' },
                        publish: { type: 'boolean' },
                        version: { type: 'integer', minimum: 1 }
                    },
                    required: ['id', 'displayName', 'codename']
                },
                PlayCanvasEditorCompatibilitySceneSummaryList: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySceneSummary' }
                        }
                    },
                    required: ['items']
                },
                PlayCanvasEditorCompatibilityScene: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        projectId: { type: 'string', format: 'uuid' },
                        displayName: { $ref: '#/components/schemas/GenericObject' },
                        codename: { $ref: '#/components/schemas/GenericObject' },
                        payloadSchemaVersion: { type: 'string' },
                        payloadFile: {
                            oneOf: [{ $ref: '#/components/schemas/GenericObject' }, { type: 'null' }]
                        },
                        checksum: { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{64}$' },
                        sortOrder: { type: 'integer' },
                        publish: { type: 'boolean' },
                        version: { type: 'integer', minimum: 1 }
                    },
                    required: ['id', 'projectId', 'displayName', 'codename', 'payloadSchemaVersion', 'payloadFile', 'checksum']
                },
                PlayCanvasEditorCompatibilitySceneReadResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        item: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                scene: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilityScene' },
                                payload: {
                                    oneOf: [{ $ref: '#/components/schemas/PlayCanvasEditorScenePayload' }, { type: 'null' }]
                                }
                            },
                            required: ['scene', 'payload']
                        }
                    },
                    required: ['item']
                },
                PlayCanvasEditorCompatibilitySceneSaveRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        requestId: { type: 'string', format: 'uuid' },
                        payload: { $ref: '#/components/schemas/PlayCanvasEditorScenePayload' },
                        expectedCurrentChecksum: { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{64}$' }
                    },
                    required: ['requestId', 'payload']
                },
                PlayCanvasEditorCompatibilitySceneSaveResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        requestId: { type: 'string', format: 'uuid' },
                        item: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                scene: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilityScene' },
                                payload: {
                                    oneOf: [{ $ref: '#/components/schemas/PlayCanvasEditorScenePayload' }, { type: 'null' }]
                                },
                                checksum: { type: ['string', 'null'], pattern: '^[a-fA-F0-9]{64}$' }
                            },
                            required: ['scene', 'payload', 'checksum']
                        }
                    },
                    required: ['ok', 'requestId', 'item']
                },
                PlayCanvasEditorCompatibilityAssetSummary: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        stableAssetId: { type: 'string' },
                        type: { type: 'string' },
                        name: { type: 'string' },
                        virtualPath: { type: 'string' },
                        mime: { type: ['string', 'null'] },
                        hash: { type: ['string', 'null'] },
                        size: { type: ['integer', 'null'], minimum: 0 }
                    },
                    required: ['id', 'stableAssetId', 'type', 'name', 'virtualPath', 'mime', 'hash', 'size']
                },
                PlayCanvasEditorCompatibilityAssetSummaryList: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        items: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilityAssetSummary' }
                        }
                    },
                    required: ['items']
                },
                PlayCanvasEditorCompatibilitySettingsDocument: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        kind: { type: 'string', enum: ['user', 'projectUser', 'projectPrivate'] },
                        documentId: { type: 'string' },
                        data: { $ref: '#/components/schemas/GenericObject' },
                        revision: { type: 'string' }
                    },
                    required: ['kind', 'documentId', 'data', 'revision']
                },
                PlayCanvasEditorCompatibilitySettingsDocumentResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        item: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySettingsDocument' }
                    },
                    required: ['item']
                },
                PlayCanvasEditorCompatibilitySettingsWriteRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        requestId: { type: 'string', format: 'uuid' },
                        data: { $ref: '#/components/schemas/GenericObject' },
                        expectedRevision: { type: 'string' }
                    },
                    required: ['requestId', 'data']
                },
                PlayCanvasEditorCompatibilitySettingsWriteResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        requestId: { type: 'string', format: 'uuid' },
                        item: { $ref: '#/components/schemas/PlayCanvasEditorCompatibilitySettingsDocument' }
                    },
                    required: ['ok', 'requestId', 'item']
                },
                PlayCanvasEditorCompatibilityNoOpResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        surface: {
                            type: 'string',
                            enum: [
                                'store',
                                'jobs',
                                'branchesCheckpoints',
                                'sourcefiles',
                                'publishing',
                                'usersCollaboration',
                                'assetPipeline'
                            ]
                        },
                        status: { type: 'string', enum: ['stubbed'] },
                        reason: { type: 'string', enum: ['cloudOnlySurfaceOutsideFirstSlice'] }
                    },
                    required: ['ok', 'surface', 'status', 'reason']
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
                        artifactUrl: { type: ['string', 'null'] },
                        playcanvasEditor: {
                            oneOf: [{ $ref: '#/components/schemas/PlayCanvasEditorHostBridgeDescriptor' }, { type: 'null' }]
                        }
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
                PlayCanvasEditorBridgeCapability: {
                    type: 'string',
                    enum: [
                        'protocol.describe',
                        'project.loadSelected',
                        'scene.list',
                        'scene.read',
                        'scene.save',
                        'scene.saveStatus',
                        'asset.listMinimalForScene',
                        'bridge.capabilities',
                        'bridge.close',
                        'bridge.dirtyState'
                    ]
                },
                PlayCanvasEditorBridgeErrorCode: {
                    type: 'string',
                    enum: [
                        'invalidCommand',
                        'unsupportedVersion',
                        'unauthorized',
                        'forbidden',
                        'csrfRequired',
                        'sessionExpired',
                        'replayRejected',
                        'projectUnavailable',
                        'sceneUnavailable',
                        'assetUnavailable',
                        'payloadTooLarge',
                        'saveConflict',
                        'storageUnavailable',
                        'artifactUnavailable',
                        'unsupportedCapability',
                        'internalError'
                    ]
                },
                PlayCanvasEditorScenePayload: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        schemaVersion: { type: 'string' },
                        settings: { type: 'object', additionalProperties: true },
                        entities: {
                            type: 'array',
                            maxItems: 5000,
                            items: {
                                type: 'object',
                                additionalProperties: true
                            }
                        },
                        assets: {
                            type: 'array',
                            maxItems: 2000,
                            items: {
                                type: 'object',
                                additionalProperties: true
                            }
                        },
                        metadata: { type: 'object', additionalProperties: true }
                    },
                    description: 'Bounded JSON scene payload exchanged between the hosted Editor and metahub storage.'
                },
                PlayCanvasEditorBridgeCommandBase: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        requestId: { type: 'string', format: 'uuid' },
                        sessionId: { type: 'string', format: 'uuid' },
                        nonce: { type: 'string', minLength: 32, maxLength: 256 }
                    },
                    required: ['requestId', 'sessionId', 'nonce']
                },
                PlayCanvasEditorBridgeCommand: {
                    oneOf: [
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['editor.ready'] },
                                        bridgeVersion: { type: 'string', enum: ['1'] },
                                        capabilities: {
                                            type: 'array',
                                            maxItems: 32,
                                            items: { $ref: '#/components/schemas/PlayCanvasEditorBridgeCapability' }
                                        }
                                    },
                                    required: ['type', 'bridgeVersion', 'capabilities']
                                }
                            ]
                        },
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: {
                                            type: 'string',
                                            enum: ['protocol.describe', 'project.loadSelected', 'bridge.capabilities']
                                        }
                                    },
                                    required: ['type']
                                }
                            ]
                        },
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['scene.list'] },
                                        projectId: { type: 'string', format: 'uuid' }
                                    },
                                    required: ['type', 'projectId']
                                }
                            ]
                        },
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: {
                                            type: 'string',
                                            enum: ['scene.read', 'scene.saveStatus', 'asset.listMinimalForScene']
                                        },
                                        projectId: { type: 'string', format: 'uuid' },
                                        sceneId: { type: 'string', format: 'uuid' }
                                    },
                                    required: ['type', 'projectId', 'sceneId']
                                }
                            ]
                        },
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['scene.save'] },
                                        projectId: { type: 'string', format: 'uuid' },
                                        sceneId: { type: 'string', format: 'uuid' },
                                        expectedCurrentChecksum: {
                                            type: ['string', 'null'],
                                            pattern: '^[a-fA-F0-9]{64}$'
                                        },
                                        payload: { $ref: '#/components/schemas/PlayCanvasEditorScenePayload' }
                                    },
                                    required: ['type', 'projectId', 'sceneId', 'expectedCurrentChecksum', 'payload']
                                }
                            ]
                        },
                        {
                            allOf: [
                                { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommandBase' },
                                {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['bridge.close', 'bridge.dirtyState'] },
                                        dirty: { type: 'boolean' }
                                    },
                                    required: ['type']
                                }
                            ]
                        }
                    ],
                    discriminator: {
                        propertyName: 'type'
                    },
                    description: 'Typed command envelope accepted by the PlayCanvas Editor bridge endpoint.'
                },
                PlayCanvasEditorBridgeCommandRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sessionToken: { type: 'string', minLength: 32 },
                        command: { $ref: '#/components/schemas/PlayCanvasEditorBridgeCommand' }
                    },
                    required: ['sessionToken', 'command']
                },
                PlayCanvasProjectFileWriteRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sourcePath: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 512,
                            description: 'Metahub-scoped PlayCanvas project file source path to write.'
                        },
                        contentBase64: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 13_981_016,
                            pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
                            description: 'Base64-encoded file content bounded by the backend file payload limit.'
                        },
                        expectedChecksum: {
                            type: ['string', 'null'],
                            pattern: '^[a-fA-F0-9]{64}$',
                            description: 'Optional checksum expected for the newly written file content.'
                        },
                        expectedCurrentChecksum: {
                            type: ['string', 'null'],
                            pattern: '^[a-fA-F0-9]{64}$',
                            description: 'Required current checksum guard; use null only for first-time writes.'
                        },
                        mime: {
                            type: ['string', 'null'],
                            enum: ['application/json', 'text/javascript', 'application/javascript', null],
                            description: 'Optional allowed MIME class for PlayCanvas JSON or JavaScript files.'
                        }
                    },
                    required: ['sourcePath', 'contentBase64', 'expectedCurrentChecksum'],
                    description: 'Strict PlayCanvas project file write payload accepted by the metahub file endpoint.'
                },
                PlayCanvasAssetFileWriteRequest: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        sourcePath: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 512,
                            description: 'Metahub-scoped PlayCanvas asset file source path to write.'
                        },
                        contentBase64: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 13_981_016,
                            pattern: '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$',
                            description: 'Base64-encoded asset file content bounded by the backend file payload limit.'
                        },
                        expectedChecksum: {
                            type: ['string', 'null'],
                            pattern: '^[a-fA-F0-9]{64}$',
                            description: 'Optional checksum expected for the newly written asset file content.'
                        },
                        expectedCurrentChecksum: {
                            type: ['string', 'null'],
                            pattern: '^[a-fA-F0-9]{64}$',
                            description: 'Required current checksum guard; use null only for first-time asset file writes.'
                        },
                        mime: {
                            type: ['string', 'null'],
                            enum: ['application/json', 'text/javascript', 'application/javascript', null],
                            description: 'Optional allowed MIME class for PlayCanvas JSON or JavaScript asset files.'
                        }
                    },
                    required: ['sourcePath', 'contentBase64', 'expectedCurrentChecksum'],
                    description: 'Strict PlayCanvas asset file write payload accepted by the metahub asset file endpoint.'
                },
                PlayCanvasEditorBridgeSuccessResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', enum: [true] },
                        requestId: { type: 'string', format: 'uuid' },
                        data: { type: 'object', additionalProperties: true }
                    },
                    required: ['ok', 'requestId', 'data']
                },
                PlayCanvasEditorBridgeErrorResponse: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        ok: { type: 'boolean', enum: [false] },
                        requestId: { type: 'string', format: 'uuid' },
                        code: { $ref: '#/components/schemas/PlayCanvasEditorBridgeErrorCode' },
                        status: { type: 'integer', minimum: 400, maximum: 599 },
                        safeDetails: {
                            type: 'object',
                            additionalProperties: { type: 'string' }
                        }
                    },
                    required: ['ok', 'code', 'status']
                },
                PlayCanvasEditorBridgeResponse: {
                    oneOf: [
                        { $ref: '#/components/schemas/PlayCanvasEditorBridgeSuccessResponse' },
                        { $ref: '#/components/schemas/PlayCanvasEditorBridgeErrorResponse' }
                    ],
                    description: 'Success or safe error response returned by a bridge command.'
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
                InterpretationNetworkConflict: {
                    description:
                        'The Interpretation Network mutation conflicts with current state, including stale expectedVersion values and single-system invariant violations.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/InterpretationNetworkError' }
                        }
                    }
                },
                ApplicationInterpretationNetworkStructureModeConflict: {
                    description:
                        'The requested Matrix widget batch would activate single-system mode while ordinary Structures remain in an active workspace.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApplicationInterpretationNetworkStructureModeError' }
                        }
                    }
                },
                ApplicationLayoutWidgetResetConflict: {
                    description:
                        'The reset conflicts with a stale widget version, a missing current metahub baseline, missing Interpretation Network metadata, or ordinary Structures that prevent single-system mode.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApplicationLayoutWidgetResetConflictError' }
                        }
                    }
                },
                ApplicationLayoutWidgetResetBadRequest: {
                    description: 'The reset batch payload is invalid.',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ApplicationLayoutWidgetResetBadRequestError' }
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
