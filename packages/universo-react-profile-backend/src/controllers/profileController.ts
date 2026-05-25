import { Request, Response } from 'express'
import { ProfileService } from '../services/profileService'
import { CreateProfileDto, CreateProfileInput, UpdateProfileDto, ApiResponse, UpdateSettingsDto } from '../types'

interface AuthenticatedUser {
    id?: string
    sub?: string
    email?: string
}

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser
}

const PUBLIC_PROFILE_UPDATE_FIELDS = ['nickname', 'first_name', 'last_name'] as const

type PublicProfileUpdateField = (typeof PUBLIC_PROFILE_UPDATE_FIELDS)[number]

const resolveAuthenticatedUserId = (req: Request): string | null => {
    const user = (req as AuthenticatedRequest).user
    const candidate = user?.id ?? user?.sub
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

const resolveAuthenticatedEmail = (req: Request): string | undefined => {
    const email = (req as AuthenticatedRequest).user?.email
    return typeof email === 'string' && email.trim().length > 0 ? email.trim() : undefined
}

const resolveRequestedUserId = (body: unknown): string | null => {
    if (!body || typeof body !== 'object') {
        return null
    }

    const candidate = (body as { user_id?: unknown }).user_id
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

function sanitizePublicProfileUpdate(body: unknown): { data?: UpdateProfileDto; error?: string } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Profile update payload must be an object' }
    }

    const rawBody = body as Record<string, unknown>
    const allowedFields = new Set<string>(PUBLIC_PROFILE_UPDATE_FIELDS)
    const unexpectedFields = Object.keys(rawBody).filter((field) => !allowedFields.has(field))

    if (unexpectedFields.length > 0) {
        return { error: `Unsupported profile fields: ${unexpectedFields.join(', ')}` }
    }

    const sanitized: UpdateProfileDto = {}
    for (const field of PUBLIC_PROFILE_UPDATE_FIELDS) {
        const value = rawBody[field]
        if (value === undefined) {
            continue
        }

        if (typeof value !== 'string') {
            return { error: `${field} must be a string` }
        }

        sanitized[field as PublicProfileUpdateField] = value
    }

    if (Object.keys(sanitized).length === 0) {
        return { error: 'At least one profile field is required' }
    }

    return { data: sanitized }
}

export class ProfileController {
    constructor(private profileService: ProfileService) {}

    async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                } as ApiResponse)
                return
            }

            const profile = await this.profileService.getUserProfile(userId)

            if (!profile) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: profile
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async checkNickname(req: Request, res: Response): Promise<void> {
        try {
            const { nickname } = req.params
            const userId = resolveAuthenticatedUserId(req)

            if (!nickname) {
                res.status(400).json({
                    success: false,
                    error: 'Nickname is required'
                } as ApiResponse)
                return
            }

            const isAvailable = await this.profileService.checkNicknameAvailable(nickname, userId ?? undefined)

            res.json({
                success: true,
                data: { available: isAvailable }
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async createProfile(req: Request, res: Response): Promise<void> {
        try {
            const authenticatedUserId = resolveAuthenticatedUserId(req)
            const profileData: CreateProfileDto = req.body
            const requestedUserId = resolveRequestedUserId(req.body)

            if (!authenticatedUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            if (requestedUserId && requestedUserId !== authenticatedUserId) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot create a profile for another user'
                } as ApiResponse)
                return
            }

            if (!profileData.nickname) {
                res.status(400).json({
                    success: false,
                    error: 'Nickname is required'
                } as ApiResponse)
                return
            }

            const createInput: CreateProfileInput = {
                user_id: authenticatedUserId,
                nickname: profileData.nickname,
                first_name: profileData.first_name,
                last_name: profileData.last_name
            }

            const exists = await this.profileService.profileExists(createInput.user_id)
            if (exists) {
                res.status(409).json({
                    success: false,
                    error: 'Profile already exists for this user'
                } as ApiResponse)
                return
            }

            const isAvailable = await this.profileService.checkNicknameAvailable(profileData.nickname)
            if (!isAvailable) {
                res.status(409).json({
                    success: false,
                    error: 'Nickname is already taken'
                } as ApiResponse)
                return
            }

            const profile = await this.profileService.createProfile(createInput)

            res.status(201).json({
                success: true,
                data: profile,
                message: 'Profile created successfully'
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params
            const authenticatedUserId = resolveAuthenticatedUserId(req)

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                } as ApiResponse)
                return
            }

            if (!authenticatedUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            if (authenticatedUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot update another user profile'
                } as ApiResponse)
                return
            }

            const { data: updateData, error: updateError } = sanitizePublicProfileUpdate(req.body)
            if (updateError || !updateData) {
                res.status(400).json({
                    success: false,
                    error: updateError ?? 'Invalid profile update payload'
                } as ApiResponse)
                return
            }

            const profile = await this.profileService.updateProfile(userId, updateData)

            if (!profile) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                data: profile,
                message: 'Profile updated successfully'
            } as ApiResponse)
        } catch (error) {
            if (error instanceof Error && error.message.includes('already taken')) {
                res.status(409).json({
                    success: false,
                    error: error.message
                } as ApiResponse)
                return
            }

            if (error instanceof Error && error.message === 'No supported profile fields provided for update') {
                res.status(400).json({
                    success: false,
                    error: error.message
                } as ApiResponse)
                return
            }

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async deleteProfile(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params
            const authenticatedUserId = resolveAuthenticatedUserId(req)

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                } as ApiResponse)
                return
            }

            if (!authenticatedUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            if (authenticatedUserId !== userId) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot delete another user profile'
                } as ApiResponse)
                return
            }

            const deleted = await this.profileService.deleteProfile(userId, authenticatedUserId)

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                } as ApiResponse)
                return
            }

            res.json({
                success: true,
                message: 'Profile deleted successfully'
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async getAllProfiles(req: Request, res: Response): Promise<void> {
        try {
            const profiles = await this.profileService.getAllProfiles()

            res.json({
                success: true,
                data: profiles
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async getSettings(req: Request, res: Response): Promise<void> {
        try {
            const userId = resolveAuthenticatedUserId(req)

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            const settings = await this.profileService.getUserSettings(userId)

            res.json({
                success: true,
                data: settings
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async getOrCreateCurrentProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = resolveAuthenticatedUserId(req)
            const email = resolveAuthenticatedEmail(req)

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            const profile = await this.profileService.getOrCreateProfile(userId, email)

            res.json({
                success: true,
                data: profile
            } as ApiResponse)
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }

    async updateSettings(req: Request, res: Response): Promise<void> {
        try {
            const userId = resolveAuthenticatedUserId(req)
            const email = resolveAuthenticatedEmail(req)
            const { settings }: UpdateSettingsDto = req.body

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                } as ApiResponse)
                return
            }

            if (!settings || typeof settings !== 'object') {
                res.status(400).json({
                    success: false,
                    error: 'Settings object is required'
                } as ApiResponse)
                return
            }

            const updatedSettings = await this.profileService.updateUserSettings(userId, settings, email)

            res.json({
                success: true,
                data: updatedSettings,
                message: 'Settings updated successfully'
            } as ApiResponse)
        } catch (error) {
            if (error instanceof Error && error.message === 'Profile not found') {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                } as ApiResponse)
                return
            }

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            } as ApiResponse)
        }
    }
}
