import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import {
  createUniksCollectionRouter,
  createUnikIndividualRouter
} from '../../routes/uniksRoutes'
import {
  createSupabaseClientMock,
  type SupabaseClientMockConfig,
  type SupabaseHandler
} from '@testing/backend/mocks'

describe('uniks routes', () => {
  const ensureAuth = (user?: { sub: string }) =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (user) {
        ;(req as any).user = user
      }
      next()
    }

  const createApp = (router: express.Router) => {
    const app = express()
    app.use(express.json())
    app.use(router)
    return app
  }

  const buildCollectionApp = (userId: string, config: SupabaseClientMockConfig) =>
    createApp(createUniksCollectionRouter(ensureAuth({ sub: userId }), createSupabaseClientMock(config) as any))

  const buildIndividualApp = (userId: string, config: SupabaseClientMockConfig) =>
    createApp(createUnikIndividualRouter(ensureAuth({ sub: userId }), createSupabaseClientMock(config) as any))

  it('возвращает список юников текущего пользователя', async () => {
    const selectHandler: SupabaseHandler = jest.fn().mockResolvedValue({
      data: [
        { role: 'owner', unik: { id: 'unik-1', name: 'Main workspace' } },
        { role: 'editor', unik: { id: 'unik-2', name: 'Second' } }
      ],
      error: null
    })

    const app = buildCollectionApp('user-1', {
      user_uniks: { select: selectHandler }
    })

    const response = await request(app).get('/')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: 'unik-1', name: 'Main workspace', role: 'owner' },
      { id: 'unik-2', name: 'Second', role: 'editor' }
    ])
    expect(selectHandler).toHaveBeenCalledWith({
      table: 'user_uniks',
      method: 'select',
      filters: [{ column: 'user_id', value: 'user-1' }],
      payload: undefined,
      returning: true
    })
  })

  it('создаёт уник и связывает владельца', async () => {
    const insertUnik: SupabaseHandler = jest.fn().mockResolvedValue({
      data: [{ id: 'unik-3', name: 'Workspace' }],
      error: null
    })
    const insertRelation: SupabaseHandler = jest.fn().mockResolvedValue({
      data: [{ id: 'relation-1' }],
      error: null
    })

    const app = buildCollectionApp('user-42', {
      uniks: { insert: insertUnik },
      user_uniks: {
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertRelation
      }
    })

    const response = await request(app).post('/').send({ name: 'Workspace' })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ id: 'unik-3', name: 'Workspace' })
    expect(insertUnik).toHaveBeenCalledWith({
      table: 'uniks',
      method: 'insert',
      filters: [],
      payload: { name: 'Workspace' },
      returning: true
    })
    expect(insertRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'user_uniks',
        method: 'insert',
        payload: {
          user_id: 'user-42',
          unik_id: 'unik-3',
          role: 'owner'
        }
      })
    )
  })

  it('запрещает добавление участника без прав владельца', async () => {
    const membershipCheck: SupabaseHandler = jest.fn().mockResolvedValue({
      data: { role: 'editor' },
      error: null
    })

    const app = buildCollectionApp('user-7', {
      user_uniks: {
        select: membershipCheck,
        insert: jest.fn()
      }
    })

    const response = await request(app)
      .post('/members')
      .send({ unik_id: 'unik-9', user_id: 'member-1', role: 'editor' })

    expect(response.status).toBe(403)
    expect(membershipCheck).toHaveBeenCalledWith({
      table: 'user_uniks',
      method: 'select',
      filters: [
        { column: 'unik_id', value: 'unik-9' },
        { column: 'user_id', value: 'user-7' }
      ],
      payload: undefined,
      returning: true
    })
  })

  it('удаляет уник владельцем', async () => {
    const membership: SupabaseHandler = jest.fn().mockResolvedValue({
      data: { role: 'owner' },
      error: null
    })
    const deleteHandler: SupabaseHandler = jest.fn().mockResolvedValue({ error: null })

    const app = buildIndividualApp('user-99', {
      user_uniks: {
        select: membership,
        insert: jest.fn()
      },
      uniks: {
        delete: deleteHandler
      }
    })

    const response = await request(app).delete('/123')

    expect(response.status).toBe(204)
    expect(deleteHandler).toHaveBeenCalledWith({
      table: 'uniks',
      method: 'delete',
      filters: [{ column: 'id', value: '123' }],
      payload: undefined,
      returning: false
    })
  })
})
