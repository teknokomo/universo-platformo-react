import { loginUser, refreshToken } from '../../../src/controllers/up-auth/auth'
import { supabase } from '../../../src/utils/supabase'
import { Request, Response } from 'express'

jest.mock('../../../src/utils/supabase', () => ({
    supabase: {
        auth: {
            signInWithPassword: jest.fn(),
            refreshSession: jest.fn()
        }
    }
}))

describe('up-auth controllers', () => {
    const mockedSupabase = supabase as jest.Mocked<typeof supabase>

    describe('loginUser', () => {
        it('logs in user and sets cookie', async () => {
            const req = { body: { email: 'a@b.c', password: 'pwd' } } as Partial<Request>
            const res = {
                cookie: jest.fn().mockReturnThis(),
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            } as unknown as Response
            mockedSupabase.auth.signInWithPassword.mockResolvedValue({
                data: { session: { access_token: 'token', refresh_token: 'refresh' }, user: { id: '1' } },
                error: null
            } as any)

            await loginUser(req as Request, res)

            expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.any(Object))
            expect(res.json).toHaveBeenCalledWith({ token: 'token', user: { id: '1' } })
        })
    })

    describe('refreshToken', () => {
        it('refreshes token using cookie', async () => {
            const req = { cookies: { refresh_token: 'old' } } as Partial<Request>
            const res = {
                cookie: jest.fn().mockReturnThis(),
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            } as unknown as Response
            mockedSupabase.auth.refreshSession.mockResolvedValue({
                data: { session: { access_token: 'newToken', refresh_token: 'newRefresh' } },
                error: null
            } as any)

            await refreshToken(req as Request, res)

            expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'newRefresh', expect.any(Object))
            expect(res.json).toHaveBeenCalledWith({ accessToken: 'newToken' })
        })
    })
})
