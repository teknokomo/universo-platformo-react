import { PlayCanvasEditorBridgeSessionService } from '../../domains/playcanvas-projects/services/PlayCanvasEditorBridgeSessionService'

describe('PlayCanvasEditorBridgeSessionService', () => {
    it('creates readable scoped sessions and rejects tampered tokens', () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const created = service.create({
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId: '018f8a78-7b8f-7c1d-a111-222233334444',
            userId: 'user-1',
            capabilities: ['scene.save']
        })

        expect(service.read(created.token)).toEqual(expect.objectContaining({ sessionId: created.payload.sessionId }))
        expect(service.read(`${created.token}tampered`)).toBeNull()
    })

    it('claims mutating commands through a shared database uniqueness guard', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('INSERT INTO')) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334446' }]
            }
            return []
        })
        const input = {
            sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
            requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
            commandType: 'scene.save',
            fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            expiresAt: Date.now() + 60_000,
            userId: '018f8a78-7b8f-7c1d-a111-222233334447'
        }

        await expect(service.claimReplay({ query }, 'mhb_019e8afa000070008000000000000001_b1', input)).resolves.toBe(true)
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM "metahubs"."_app_settings"'),
            expect.arrayContaining([expect.any(Number)])
        )
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (key) DO NOTHING'),
            expect.arrayContaining([expect.stringMatching(/^pc\.eb\.replay\.[a-f0-9]{64}$/), expect.stringContaining(input.fingerprint)])
        )
        const insertCall = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))!
        expect(String(insertCall[0])).toContain('NULL, NULL')
        expect(insertCall[1]).not.toContain(input.userId)
    })

    it('does not write non-UUID authenticated user ids into replay audit columns', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('INSERT INTO')) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334446' }]
            }
            return []
        })

        await expect(
            service.claimReplay({ query }, 'mhb_019e8afa000070008000000000000001_b1', {
                sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
                requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
                commandType: 'scene.save',
                fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                expiresAt: Date.now() + 60_000,
                userId: 'user-1'
            })
        ).resolves.toBe(true)

        const insertCall = query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))!
        expect(String(insertCall[0])).toContain('VALUES ($1, $2, $3::jsonb, NULL, NULL)')
        expect(insertCall[1]).toHaveLength(3)
        expect(String(insertCall[1][2])).toContain('"userIdHash"')
        expect(String(insertCall[1][2])).not.toContain('user-1')
    })

    it('rejects duplicate mutating command claims when the database insert conflicts', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('INSERT INTO')) {
                return []
            }
            return []
        })

        await expect(
            service.claimReplay({ query }, 'mhb_019e8afa000070008000000000000001_b1', {
                sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
                requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
                commandType: 'scene.save',
                fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                expiresAt: Date.now() + 60_000,
                userId: '018f8a78-7b8f-7c1d-a111-222233334447'
            })
        ).resolves.toBe(false)
    })

    it('stores and reads successful replay responses by fingerprint', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const response = {
            ok: true,
            requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
            data: {
                checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            }
        }
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('INSERT INTO')) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334446' }]
            }
            if (sql.includes('SELECT')) {
                return [{ value: { status: 'completed', response } }]
            }
            return []
        })
        const input = {
            sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
            requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
            commandType: 'scene.save',
            fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }

        await expect(
            service.completeReplay({ query }, 'mhb_019e8afa000070008000000000000001_b1', {
                ...input,
                response,
                userId: '018f8a78-7b8f-7c1d-a111-222233334447'
            })
        ).resolves.toBe(true)
        await expect(service.readReplayResponse({ query }, 'mhb_019e8afa000070008000000000000001_b1', input)).resolves.toEqual({
            status: 'completed',
            response
        })
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (key) DO UPDATE'),
            expect.arrayContaining([JSON.stringify(response)])
        )
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('jsonb_set("metahubs"."_app_settings".value, \'{response}\''),
            expect.arrayContaining([expect.stringContaining('"status":"completed"')])
        )
    })

    it('distinguishes claimed replay rows from completed replay responses', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const query = jest.fn(async () => [{ value: { status: 'claimed' } }])

        await expect(
            service.readReplayResponse({ query }, 'mhb_019e8afa000070008000000000000001_b1', {
                sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
                requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
                commandType: 'scene.save',
                fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            })
        ).resolves.toEqual({ status: 'claimed' })
    })

    it('releases a failed mutating command claim with the same replay fingerprint', async () => {
        const service = new PlayCanvasEditorBridgeSessionService()
        const query = jest.fn(async () => [])
        const input = {
            sessionId: '018f8a78-7b8f-7c1d-a111-222233334444',
            requestId: '018f8a78-7b8f-7c1d-a111-222233334445',
            commandType: 'scene.save',
            fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }

        await expect(service.releaseReplay({ query }, 'mhb_019e8afa000070008000000000000001_b1', input)).resolves.toBeUndefined()
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM "metahubs"."_app_settings"'),
            expect.arrayContaining([
                expect.stringMatching(/^pc\.eb\.replay\.[a-f0-9]{64}$/),
                input.sessionId,
                input.requestId,
                input.commandType,
                input.fingerprint
            ])
        )
    })

    it('fails closed in production when no bridge HMAC secret is configured', () => {
        const originalNodeEnv = process.env.NODE_ENV
        const originalBridgeSecret = process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET
        const originalSessionSecret = process.env.SESSION_SECRET
        const originalSupabaseJwtSecret = process.env.SUPABASE_JWT_SECRET
        try {
            process.env.NODE_ENV = 'production'
            delete process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET
            delete process.env.SESSION_SECRET
            delete process.env.SUPABASE_JWT_SECRET

            expect(() =>
                new PlayCanvasEditorBridgeSessionService().create({
                    metahubId: 'metahub-1',
                    packageSlug: 'playcanvas-editor',
                    projectId: '018f8a78-7b8f-7c1d-a111-222233334444',
                    userId: 'user-1',
                    capabilities: ['scene.save']
                })
            ).toThrow(/PLAYCANVAS_EDITOR_BRIDGE_SECRET/)
        } finally {
            if (originalNodeEnv === undefined) delete process.env.NODE_ENV
            else process.env.NODE_ENV = originalNodeEnv
            if (originalBridgeSecret === undefined) delete process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET
            else process.env.PLAYCANVAS_EDITOR_BRIDGE_SECRET = originalBridgeSecret
            if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET
            else process.env.SESSION_SECRET = originalSessionSecret
            if (originalSupabaseJwtSecret === undefined) delete process.env.SUPABASE_JWT_SECRET
            else process.env.SUPABASE_JWT_SECRET = originalSupabaseJwtSecret
        }
    })
})
