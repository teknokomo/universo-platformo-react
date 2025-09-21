jest.mock('typeorm', () => {
  const decorator = () => () => {}
  return {
    __esModule: true,
    Entity: decorator,
    PrimaryGeneratedColumn: decorator,
    Column: decorator,
    ManyToOne: decorator,
    JoinColumn: decorator,
    Unique: decorator
  }
}, { virtual: true })

import type { Request, Response, NextFunction, Router } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createUniksCollectionRouter, createUnikIndividualRouter } from '../../routes/uniksRoutes'
import { createMockRepository, createMockDataSource } from '../utils/typeormMocks'

const ensureAuth = (userId: string) => (req: Request, _res: Response, next: NextFunction) => {
  ;(req as any).user = { id: userId }
  next()
}

describe('uniks routes (TypeORM)', () => {
  const buildCollectionApp = (userId: string, repos: { unikRepo: any; membershipRepo: any }) => {
    const dataSource = createMockDataSource({ Unik: repos.unikRepo, UnikUser: repos.membershipRepo })
    const router = createUniksCollectionRouter(ensureAuth(userId), () => dataSource as any)
    const app = express()
    app.use(express.json())
    app.use(router)
    return { app, dataSource }
  }

  const buildIndividualApp = (userId: string, repos: { unikRepo: any; membershipRepo: any }) => {
    const dataSource = createMockDataSource({ Unik: repos.unikRepo, UnikUser: repos.membershipRepo })
    const router = createUnikIndividualRouter(ensureAuth(userId), () => dataSource as any)
    const app = express()
    app.use(express.json())
    app.use(router)
    return { app }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('возвращает список юников текущего пользователя', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.find.mockResolvedValue([
      { unik_id: 'unik-1', role: 'owner', unik: { id: 'unik-1', name: 'Main', created_at: '2025-01-01' } },
      { unik_id: 'unik-2', role: 'editor', unik: { id: 'unik-2', name: 'Side', created_at: '2025-01-02' } }
    ])

    const { app } = buildCollectionApp('user-1', { unikRepo, membershipRepo })
    const response = await request(app).get('/')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: 'unik-1', name: 'Main', created_at: '2025-01-01', role: 'owner' },
      { id: 'unik-2', name: 'Side', created_at: '2025-01-02', role: 'editor' }
    ])
    expect(membershipRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      relations: ['unik'],
      order: { role: 'ASC' }
    })
  })

  it('создаёт уник и связывает владельца', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    unikRepo.create.mockImplementation((payload) => ({ id: 'unik-3', created_at: new Date().toISOString(), ...payload }))
    unikRepo.save.mockResolvedValue({ id: 'unik-3', name: 'Workspace', created_at: '2025-01-05' })
    membershipRepo.create.mockImplementation((payload) => payload)
    membershipRepo.save.mockResolvedValue({})

    const { app } = buildCollectionApp('user-42', { unikRepo, membershipRepo })
    const response = await request(app).post('/').send({ name: 'Workspace' })

    expect(response.status).toBe(201)
    expect(unikRepo.create).toHaveBeenCalledWith({ name: 'Workspace' })
    expect(membershipRepo.create).toHaveBeenCalledWith({ user_id: 'user-42', unik_id: 'unik-3', role: 'owner' })
    expect(response.body).toEqual({ id: 'unik-3', name: 'Workspace', created_at: '2025-01-05' })
  })

  it('запрещает добавление участника без прав владельца', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'editor' })

    const { app } = buildCollectionApp('user-7', { unikRepo, membershipRepo })
    const response = await request(app)
      .post('/members')
      .send({ unik_id: 'unik-9', user_id: 'member-1', role: 'editor' })

    expect(response.status).toBe(403)
  })

  it('обновляет уник редактором (editor разрешён)', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'editor' })
    unikRepo.createQueryBuilder().execute.mockResolvedValue({ raw: [{ id: 'unik-1', name: 'Renamed' }] })

    const { app } = buildIndividualApp('user-55', { unikRepo, membershipRepo })
    const response = await request(app).put('/unik-1').send({ name: 'Renamed' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ id: 'unik-1', name: 'Renamed' })
  })

  it('удаляет уник владельцем', async () => {
    const unikRepo = createMockRepository<any>()
    const membershipRepo = createMockRepository<any>()
    membershipRepo.findOne.mockResolvedValue({ role: 'owner' })
    unikRepo.delete.mockResolvedValue({ affected: 1 })

    const { app } = buildIndividualApp('user-99', { unikRepo, membershipRepo })
    const response = await request(app).delete('/123')

    expect(response.status).toBe(204)
  })
})
