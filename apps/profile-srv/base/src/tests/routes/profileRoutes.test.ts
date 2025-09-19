jest.mock('typeorm', () => {
  const decorator = () => () => {}
  return {
    __esModule: true,
    Entity: decorator,
    PrimaryGeneratedColumn: decorator,
    Column: decorator,
    CreateDateColumn: decorator,
    UpdateDateColumn: decorator,
    Index: decorator
  }
}, { virtual: true })

import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '@testing/backend/typeormMocks'
import { createProfileRoutes } from '../../routes/profileRoutes'

const controllerMethods = {
  getProfile: jest.fn(),
  createProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
  getAllProfiles: jest.fn(),
  checkNickname: jest.fn()
}

let ProfileControllerMock: jest.Mock

jest.mock('../../controllers/profileController', () => {
  ProfileControllerMock = jest.fn(() => controllerMethods)
  return {
    ProfileController: ProfileControllerMock
  }
})

describe('profile routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    controllerMethods.getProfile.mockImplementation(async (_req, res) => res.status(200).json({ id: 'profile-1' }))
    controllerMethods.createProfile.mockImplementation(async (_req, res) => res.status(201).json({ id: 'profile-1' }))
    controllerMethods.updateProfile.mockImplementation(async (_req, res) => res.status(200).json({ id: 'profile-1' }))
    controllerMethods.deleteProfile.mockImplementation(async (_req, res) => res.status(204).send())
    controllerMethods.getAllProfiles.mockImplementation(async (_req, res) => res.status(200).json([]))
    controllerMethods.checkNickname.mockImplementation(async (_req, res) => res.status(200).json({ available: true }))
  })

  const buildApp = (isInitialized = false) => {
    const profileRepo = createMockRepository<any>()
    const dataSource = createMockDataSource({ Profile: profileRepo }, { isInitialized }) as any
    dataSource.initialize = jest.fn(async () => {
      dataSource.isInitialized = true
      return dataSource
    })

    const router = createProfileRoutes(dataSource, (_req: Request, _res: Response, next: NextFunction) => {
      ;(_req as any).user = { sub: 'user-1' }
      next()
    })

    const app = express()
    app.use(express.json())
    app.use(router)

    return { app, dataSource }
  }

  it('инициализирует источник данных перед использованием контроллера', async () => {
    const { app, dataSource } = buildApp(false)

    const response = await request(app).get('/check-nickname/test')

    expect(response.status).toBe(200)
    expect(dataSource.initialize).toHaveBeenCalled()
    expect(ProfileControllerMock).toHaveBeenCalledTimes(1)
  })

  it('использует существующее подключение без повторной инициализации', async () => {
    const { app, dataSource } = buildApp(true)

    const response = await request(app).get('/user-1')

    expect(response.status).toBe(200)
    expect(dataSource.initialize).not.toHaveBeenCalled()
    expect(ProfileControllerMock).toHaveBeenCalledTimes(1)
    expect(controllerMethods.getProfile).toHaveBeenCalled()
  })
})
