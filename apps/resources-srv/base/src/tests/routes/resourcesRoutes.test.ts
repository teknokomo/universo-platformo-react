jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            JoinColumn: decorator,
            Index: decorator,
            RelationId: decorator
        }
    },
    { virtual: true }
)

import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createResourcesRouter } from '../../routes/resourcesRoutes'
import { ensureDomainAccess, ensureResourceAccess } from '../../routes/guards'

jest.mock('../../routes/guards', () => ({
    ensureClusterAccess: jest.fn(),
    ensureDomainAccess: jest.fn(),
    ensureResourceAccess: jest.fn()
}))

describe('resources routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { sub: 'user-1' }
        next()
    }

    const buildDataSource = () => {
        const resourceRepo = createMockRepository<any>()
        const domainRepo = createMockRepository<any>()
        const resourceDomainRepo = createMockRepository<any>()
        const clusterRepo = createMockRepository<any>()
        const clusterUserRepo = createMockRepository<any>()
        const domainClusterRepo = createMockRepository<any>()
        const resourceClusterRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Resource: resourceRepo,
            Domain: domainRepo,
            ResourceDomain: resourceDomainRepo,
            Cluster: clusterRepo,
            ClusterUser: clusterUserRepo,
            DomainCluster: domainClusterRepo,
            ResourceCluster: resourceClusterRepo
        })

        return {
            dataSource,
            resourceRepo,
            domainRepo,
            resourceDomainRepo,
            clusterRepo,
            clusterUserRepo,
            domainClusterRepo,
            resourceClusterRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('возвращает ресурсы доступные пользователю через домены кластеров', async () => {
        const { dataSource, clusterUserRepo, domainClusterRepo, resourceDomainRepo } = buildDataSource()

        clusterUserRepo.find.mockResolvedValue([{ cluster_id: 'cluster-1' }])
        domainClusterRepo.find.mockResolvedValue([{ domain: { id: 'domain-1' } }, { domain: { id: 'domain-2' } }])
        resourceDomainRepo.find.mockResolvedValue([
            { resource: { id: 'res-1', name: 'Docs', description: 'desc' } },
            { resource: { id: 'res-1', name: 'Docs', description: 'desc' } }
        ])

        const router = createResourcesRouter(ensureAuth, () => dataSource as any)
        const app = express()
        app.use(express.json())
        app.use(router)

        const response = await request(app).get('/')

        expect(response.status).toBe(200)
        expect(response.body).toEqual([{ id: 'res-1', name: 'Docs', description: 'desc' }])
        expect(clusterUserRepo.find).toHaveBeenCalledWith({
            where: { user_id: 'user-1' }
        })
        expect(domainClusterRepo.find).toHaveBeenCalled()
        expect(resourceDomainRepo.find).toHaveBeenCalled()
    })

    it('привязывает ресурс к домену после проверок доступа', async () => {
        const { dataSource, resourceRepo, domainRepo, resourceDomainRepo } = buildDataSource()

        resourceRepo.findOneBy.mockResolvedValue({ id: 'res-1', name: 'Docs' })
        domainRepo.findOneBy.mockResolvedValue({ id: 'dom-1', name: 'Main' })
        resourceDomainRepo.findOne.mockResolvedValue(null)
        resourceDomainRepo.create.mockReturnValue({ id: 'link-1' })
        resourceDomainRepo.save.mockResolvedValue({ id: 'link-1' })

        const router = createResourcesRouter(ensureAuth, () => dataSource as any)
        const app = express()
        app.use(express.json())
        app.use(router)

        const response = await request(app).put('/res-1/domain').send({ domainId: 'dom-1' })

        expect(response.status).toBe(201)
        expect(ensureResourceAccess).toHaveBeenCalledWith(dataSource, 'user-1', 'res-1')
        expect(ensureDomainAccess).toHaveBeenCalledWith(dataSource, 'user-1', 'dom-1')
        expect(resourceDomainRepo.create).toHaveBeenCalledWith({
            resource: { id: 'res-1', name: 'Docs' },
            domain: { id: 'dom-1', name: 'Main' }
        })
        expect(resourceDomainRepo.save).toHaveBeenCalledWith({ id: 'link-1' })
    })
})
