import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockListActiveTemplatesForCatalog = jest.fn()
const mockFindTemplateByIdNotDeleted = jest.fn()
const mockListTemplateVersions = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    listActiveTemplatesForCatalog: (...args: unknown[]) => mockListActiveTemplatesForCatalog(...args),
    findTemplateByIdNotDeleted: (...args: unknown[]) => mockFindTemplateByIdNotDeleted(...args),
    listTemplateVersions: (...args: unknown[]) => mockListTemplateVersions(...args)
}))

import { createTemplatesRoutes } from '../../domains/templates/routes/templatesRoutes'

describe('templatesRoutes', () => {
    const ensureAuth = (_req: Request, _res: Response, next: NextFunction) => next()
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const mockExec = { query: jest.fn() }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createTemplatesRoutes(ensureAuth, () => mockExec as never, mockRateLimiter)
        )
        app.use((error: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode || error.status || 500).json({ error: error.message })
        })
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockListActiveTemplatesForCatalog.mockResolvedValue([
            {
                id: 'template-1',
                codename: 'catalog',
                definitionType: 'entity_type_preset',
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Catalogs', version: 1, isActive: true } } },
                description: null,
                icon: 'IconDatabase',
                isSystem: true,
                isActive: true,
                sortOrder: 1,
                activeVersionId: 'template-1-v1',
                activeVersionData: {
                    id: 'template-1-v1',
                    versionNumber: 1,
                    versionLabel: '0.1.0',
                    changelog: null
                }
            }
        ])
        mockFindTemplateByIdNotDeleted.mockResolvedValue({
            id: 'template-1',
            codename: 'catalog',
            definitionType: 'entity_type_preset',
            name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Catalogs', version: 1, isActive: true } } },
            description: null,
            icon: 'IconDatabase',
            isSystem: true,
            isActive: true,
            sortOrder: 1,
            activeVersionId: 'template-1-v1'
        })
        mockListTemplateVersions.mockResolvedValue([
            {
                id: 'template-1-v1',
                templateId: 'template-1',
                versionNumber: 1,
                versionLabel: '0.1.0',
                minStructureVersion: '0.4.0',
                manifestJson: {
                    $schema: 'entity-type-preset/v1',
                    codename: 'catalog',
                    version: '0.1.0',
                    minStructureVersion: '0.4.0',
                    name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Catalogs', version: 1, isActive: true } } },
                    entityType: {
                        kindKey: 'catalog',
                        components: {
                            dataSchema: { enabled: true },
                            records: { enabled: true },
                            treeAssignment: { enabled: true },
                            optionValues: false,
                            constants: false,
                            hierarchy: { enabled: true, supportsFolders: true },
                            nestedCollections: false,
                            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
                            actions: { enabled: true },
                            events: { enabled: true },
                            scripting: { enabled: true },
                            layoutConfig: { enabled: true },
                            runtimeBehavior: { enabled: true },
                            physicalTable: { enabled: true, prefix: 'catx' }
                        },
                        ui: {
                            iconName: 'IconDatabase',
                            tabs: ['general', 'hubs', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'Catalogs'
                        }
                    }
                },
                manifestHash: 'hash-1',
                isActive: true,
                changelog: null,
                _uplCreatedAt: '2026-04-09T00:00:00.000Z'
            }
        ])
    })

    it('filters templates by definitionType', async () => {
        const app = buildApp()

        const response = await request(app).get('/templates?definitionType=entity_type_preset').expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].definitionType).toBe('entity_type_preset')
        expect(mockListActiveTemplatesForCatalog).toHaveBeenCalledWith(mockExec, { definitionType: 'entity_type_preset' })
    })

    it('rejects unknown definitionType filters', async () => {
        const app = buildApp()

        const response = await request(app).get('/templates?definitionType=unknown').expect(400)

        expect(response.body).toEqual({ error: 'Invalid definitionType' })
        expect(mockListActiveTemplatesForCatalog).not.toHaveBeenCalled()
    })

    it('returns active version manifest in template detail responses', async () => {
        const app = buildApp()

        const response = await request(app).get('/templates/template-1').expect(200)

        expect(response.body.definitionType).toBe('entity_type_preset')
        expect(response.body.activeVersionManifest).toMatchObject({
            $schema: 'entity-type-preset/v1',
            codename: 'catalog'
        })
    })
})
