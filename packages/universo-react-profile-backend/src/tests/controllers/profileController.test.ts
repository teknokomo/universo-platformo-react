import { ProfileController } from '../../controllers/profileController'

function createMockResponse() {
    const res = {
        status: jest.fn(),
        json: jest.fn()
    }

    res.status.mockReturnValue(res)
    res.json.mockReturnValue(res)

    return res
}

describe('ProfileController security', () => {
    it('rejects createProfile when the body user_id targets another user', async () => {
        const profileService = {
            profileExists: jest.fn(),
            checkNicknameAvailable: jest.fn(),
            createProfile: jest.fn()
        }
        const controller = new ProfileController(profileService as never)
        const req = {
            body: {
                user_id: 'user-2',
                nickname: 'neo'
            },
            user: {
                id: 'user-1'
            }
        }
        const res = createMockResponse()

        await controller.createProfile(req as never, res as never)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Cannot create a profile for another user'
        })
        expect(profileService.profileExists).not.toHaveBeenCalled()
        expect(profileService.createProfile).not.toHaveBeenCalled()
    })

    it('rejects updateProfile when the authenticated user targets another profile', async () => {
        const profileService = {
            updateProfile: jest.fn()
        }
        const controller = new ProfileController(profileService as never)
        const req = {
            params: {
                userId: 'user-2'
            },
            body: {
                nickname: 'neo'
            },
            user: {
                id: 'user-1'
            }
        }
        const res = createMockResponse()

        await controller.updateProfile(req as never, res as never)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Cannot update another user profile'
        })
        expect(profileService.updateProfile).not.toHaveBeenCalled()
    })

    it('rejects updateProfile when the payload contains unsupported fields', async () => {
        const profileService = {
            updateProfile: jest.fn()
        }
        const controller = new ProfileController(profileService as never)
        const req = {
            params: {
                userId: 'user-1'
            },
            body: {
                nickname: 'neo',
                user_id: 'user-2'
            },
            user: {
                id: 'user-1'
            }
        }
        const res = createMockResponse()

        await controller.updateProfile(req as never, res as never)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Unsupported profile fields: user_id'
        })
        expect(profileService.updateProfile).not.toHaveBeenCalled()
    })

    it('rejects deleteProfile when the authenticated user targets another profile', async () => {
        const profileService = {
            deleteProfile: jest.fn()
        }
        const controller = new ProfileController(profileService as never)
        const req = {
            params: {
                userId: 'user-2'
            },
            user: {
                id: 'user-1'
            }
        }
        const res = createMockResponse()

        await controller.deleteProfile(req as never, res as never)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'Cannot delete another user profile'
        })
        expect(profileService.deleteProfile).not.toHaveBeenCalled()
    })

    it('creates the authenticated user profile even when user_id is omitted from the body', async () => {
        const createdProfile = {
            id: 'profile-1',
            user_id: 'user-1',
            nickname: 'neo'
        }
        const profileService = {
            profileExists: jest.fn().mockResolvedValue(false),
            checkNicknameAvailable: jest.fn().mockResolvedValue(true),
            createProfile: jest.fn().mockResolvedValue(createdProfile)
        }
        const controller = new ProfileController(profileService as never)
        const req = {
            body: {
                nickname: 'neo',
                first_name: 'Neo'
            },
            user: {
                id: 'user-1'
            }
        }
        const res = createMockResponse()

        await controller.createProfile(req as never, res as never)

        expect(profileService.profileExists).toHaveBeenCalledWith('user-1')
        expect(profileService.checkNicknameAvailable).toHaveBeenCalledWith('neo')
        expect(profileService.createProfile).toHaveBeenCalledWith({
            user_id: 'user-1',
            nickname: 'neo',
            first_name: 'Neo',
            last_name: undefined
        })
        expect(res.status).toHaveBeenCalledWith(201)
    })
})
