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

import type { Request, Response, NextFunction } from 'express'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createProfileRoutes } from '../../routes/profileRoutes'

type AuthenticatedRequest = Request & { user?: { sub: string } }

function createMockExec() {
    return { query: jest.fn().mockResolvedValue([]), transaction: jest.fn(), isReleased: jest.fn(() => false) }
}

describe('profile routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()

        mockControllerMethods.getProfile.mockImplementation(async (_req: Request, res: Response) =>
            res.status(200).json({ id: 'profile-1' })
        )
        mockControllerMethods.createProfile.mockImplementation(async (_req: Request, res: Response) =>
            res.status(201).json({ id: 'profile-1' })
        )
        mockControllerMethods.updateProfile.mockImplementation(async (_req: Request, res: Response) =>
            res.status(200).json({ id: 'profile-1' })
        )
        mockControllerMethods.deleteProfile.mockImplementation(async (_req: Request, res: Response) => res.status(204).send())
        mockControllerMethods.getAllProfiles.mockImplementation(async (_req: Request, res: Response) => res.status(200).json([]))
        mockControllerMethods.checkNickname.mockImplementation(async (_req: Request, res: Response) =>
            res.status(200).json({ available: true })
        )
    })

    const buildApp = () => {
        const poolExec = createMockExec()
        const rlsExec = createMockExec()

        const router = createProfileRoutes(
            {
                getDbExecutor: () => poolExec as never,
                getRequestDbExecutor: () => rlsExec as never
            },
            (_req: Request, _res: Response, next: NextFunction) => {
                ;(_req as AuthenticatedRequest).user = { sub: 'user-1' }
                next()
            }
        )

        const app = express()
        app.use(express.json())
        app.use(router)

        return { app, poolExec, rlsExec }
    }

    it('проверяет доступность никнейма через публичный маршрут', async () => {
        const { app } = buildApp()

        const response = await request(app).get('/check-nickname/test')

        expect(response.status).toBe(200)
        expect(MockProfileController).toHaveBeenCalledTimes(1)
        expect(mockControllerMethods.checkNickname).toHaveBeenCalled()
    })

    it('использует контроллер для получения профиля пользователя', async () => {
        const { app } = buildApp()

        const response = await request(app).get('/user-1')

        expect(response.status).toBe(200)
        expect(MockProfileController).toHaveBeenCalledTimes(1)
        expect(mockControllerMethods.getProfile).toHaveBeenCalled()
    })
})
