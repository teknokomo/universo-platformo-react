import type { Router } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createAccountRoutes } from '../../routes/accountRoutes'
import { createCurrencyRoutes } from '../../routes/currencyRoutes'

const setupAppWithRoutes = (path: string, routeFactory: () => Router) => {
  const app = express()
  app.use(express.json())
  app.use(path, routeFactory())
  return app
}

describe('finance routes', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('создаёт и обновляет аккаунт', async () => {
    jest.spyOn(require('crypto'), 'randomUUID').mockReturnValueOnce('acc-1')

    const app = setupAppWithRoutes('/:unikId/accounts', createAccountRoutes)

    const createResponse = await request(app)
      .post('/unik-1/accounts')
      .send({ name: 'Primary', balance: 100, currency: 'USD' })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body).toMatchObject({
      id: 'acc-1',
      unikId: 'unik-1',
      name: 'Primary',
      balance: 100,
      currency: 'USD'
    })

    const updateResponse = await request(app)
      .put('/unik-1/accounts/acc-1')
      .send({ balance: 250 })

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body.balance).toBe(250)

    const listResponse = await request(app).get('/unik-1/accounts')
    expect(listResponse.body).toHaveLength(1)
  })

  it('создаёт и удаляет валюту', async () => {
    jest.spyOn(require('crypto'), 'randomUUID').mockReturnValueOnce('cur-1')

    const app = setupAppWithRoutes('/:unikId/currencies', createCurrencyRoutes)

    const createResponse = await request(app)
      .post('/unik-2/currencies')
      .send({ code: 'USD', name: 'US Dollar', rate: 1 })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body).toMatchObject({
      id: 'cur-1',
      unikId: 'unik-2',
      code: 'USD',
      name: 'US Dollar',
      rate: 1
    })

    const deleteResponse = await request(app).delete('/unik-2/currencies/cur-1')
    expect(deleteResponse.status).toBe(204)

    const listResponse = await request(app).get('/unik-2/currencies')
    expect(listResponse.body).toEqual([])
  })
})
