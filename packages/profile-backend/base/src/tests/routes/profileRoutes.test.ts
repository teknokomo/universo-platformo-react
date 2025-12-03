// Mock controller before imports (Jest hoists this)
const mockControllerMethods = {
    getProfile: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
    getAllProfiles: jest.fn(),
    checkNickname: jest.fn()
}

const MockProfileController = jest.fn(() => mockControllerMethods)

jest.mock('../../controllers/profileController', () => ({
    ProfileController: MockProfileController
}))

jest.mock(
    'typeorm',
    () => {
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
    },
    { virtual: true }
)

import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createProfileRoutes } from '../../routes/profileRoutes'

describe('profile routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()

        mockControllerMethods.getProfile.mockImplementation(async (_req, res) => res.status(200).json({ id: 'profile-1' }))
        mockControllerMethods.createProfile.mockImplementation(async (_req, res) => res.status(201).json({ id: 'profile-1' }))
        mockControllerMethods.updateProfile.mockImplementation(async (_req, res) => res.status(200).json({ id: 'profile-1' }))
        mockControllerMethods.deleteProfile.mockImplementation(async (_req, res) => res.status(204).send())
        mockControllerMethods.getAllProfiles.mockImplementation(async (_req, res) => res.status(200).json([]))
        mockControllerMethods.checkNickname.mockImplementation(async (_req, res) => res.status(200).json({ available: true }))
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
        expect(MockProfileController).toHaveBeenCalledTimes(1)
    })

    it('использует существующее подключение без повторной инициализации', async () => {
        const { app, dataSource } = buildApp(true)

        const response = await request(app).get('/user-1')

        expect(response.status).toBe(200)
        expect(dataSource.initialize).not.toHaveBeenCalled()
        expect(MockProfileController).toHaveBeenCalledTimes(1)
        expect(mockControllerMethods.getProfile).toHaveBeenCalled()
    })
})
