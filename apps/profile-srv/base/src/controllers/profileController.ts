import { Request, Response } from 'express'
import { ProfileService } from '../services/profileService'
import { CreateProfileDto, UpdateProfileDto, ApiResponse } from '../types'

export class ProfileController {
    constructor(private profileService: ProfileService) {}

    /**
     * GET /profile/:userId - Get user profile
     */
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

    /**
     * GET /profile/check-nickname/:nickname - Check if nickname is available
     */
    async checkNickname(req: Request, res: Response): Promise<void> {
        try {
            const { nickname } = req.params
            const userId = (req as any).user?.id // From authentication middleware

            if (!nickname) {
                res.status(400).json({
                    success: false,
                    error: 'Nickname is required'
                } as ApiResponse)
                return
            }

            const isAvailable = await this.profileService.checkNicknameAvailable(nickname, userId)

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

    /**
     * POST /profile - Create new profile
     */
    async createProfile(req: Request, res: Response): Promise<void> {
        try {
            const profileData: CreateProfileDto = req.body

            if (!profileData.user_id) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
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

            // Check if profile already exists
            const exists = await this.profileService.profileExists(profileData.user_id)
            if (exists) {
                res.status(409).json({
                    success: false,
                    error: 'Profile already exists for this user'
                } as ApiResponse)
                return
            }

            // Check nickname availability
            const isAvailable = await this.profileService.checkNicknameAvailable(profileData.nickname)
            if (!isAvailable) {
                res.status(409).json({
                    success: false,
                    error: 'Nickname is already taken'
                } as ApiResponse)
                return
            }

            const profile = await this.profileService.createProfile(profileData)

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

    /**
     * PUT /profile/:userId - Update user profile
     */
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params
            const updateData: UpdateProfileDto = req.body

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
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
            // Handle nickname uniqueness error specifically
            if (error instanceof Error && error.message.includes('already taken')) {
                res.status(409).json({
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

    /**
     * DELETE /profile/:userId - Delete user profile
     */
    async deleteProfile(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                } as ApiResponse)
                return
            }

            const deleted = await this.profileService.deleteProfile(userId)

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

    /**
     * GET /profiles - Get all profiles (admin endpoint)
     */
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
}
