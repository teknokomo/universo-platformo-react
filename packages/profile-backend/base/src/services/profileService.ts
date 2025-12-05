import { Repository } from 'typeorm'
import { Profile } from '../database/entities/Profile'
import { CreateProfileDto, UpdateProfileDto, UserSettingsData } from '../types'

/**
 * Generate a unique nickname based on email or user ID
 */
function generateNickname(userId: string, email?: string): string {
    if (email) {
        // Use email prefix, sanitized for nickname rules
        const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 20)
        const suffix = userId.substring(0, 8)
        return `${prefix}_${suffix}`
    }
    // Fallback to user ID based nickname
    return `user_${userId.substring(0, 16).replace(/-/g, '')}`
}

export class ProfileService {
    constructor(private profileRepository: Repository<Profile>) {}

    /**
     * Get user profile by user ID
     */
    async getUserProfile(userId: string): Promise<Profile | null> {
        return await this.profileRepository.findOne({
            where: { user_id: userId }
        })
    }

    /**
     * Get or create user profile.
     * If profile doesn't exist, creates one with auto-generated nickname.
     * @param userId - User ID from auth
     * @param email - Optional email for generating nickname
     */
    async getOrCreateProfile(userId: string, email?: string): Promise<Profile> {
        let profile = await this.profileRepository.findOne({
            where: { user_id: userId }
        })

        if (!profile) {
            // Generate unique nickname
            let nickname = generateNickname(userId, email)
            let attempts = 0
            const maxAttempts = 10

            // Ensure nickname uniqueness
            while (attempts < maxAttempts) {
                const isAvailable = await this.checkNicknameAvailable(nickname)
                if (isAvailable) break
                nickname = `${generateNickname(userId, email)}_${Date.now() % 10000}`
                attempts++
            }

            // Create new profile
            profile = this.profileRepository.create({
                user_id: userId,
                nickname,
                settings: {}
            })
            profile = await this.profileRepository.save(profile)
            console.log(`[ProfileService] Auto-created profile for user ${userId} with nickname ${nickname}`)
        }

        return profile
    }

    /**
     * Create a new profile for a user
     */
    async createProfile(data: CreateProfileDto): Promise<Profile> {
        const profile = this.profileRepository.create(data)
        return await this.profileRepository.save(profile)
    }

    /**
     * Check if nickname is available
     */
    async checkNicknameAvailable(nickname: string, excludeUserId?: string): Promise<boolean> {
        try {
            const query = this.profileRepository.createQueryBuilder('profile').where('profile.nickname = :nickname', { nickname })

            if (excludeUserId) {
                query.andWhere('profile.user_id != :userId', { userId: excludeUserId })
            }

            const existing = await query.getOne()
            return !existing
        } catch (error) {
            // If repository query fails (e.g., table doesn't exist in local DB), assume nickname is available.
            return true
        }
    }

    /**
     * Update existing user profile
     */
    async updateProfile(userId: string, data: UpdateProfileDto): Promise<Profile | null> {
        // Check nickname uniqueness if being updated
        if (data.nickname) {
            const isAvailable = await this.checkNicknameAvailable(data.nickname, userId)
            if (!isAvailable) {
                throw new Error('Nickname is already taken')
            }
        }

        const updateData = {
            ...data,
            updated_at: new Date()
        }

        const result = await this.profileRepository.update({ user_id: userId }, updateData)

        if (result.affected === 0) {
            return null
        }

        return await this.getUserProfile(userId)
    }

    /**
     * Check if profile exists for user
     */
    async profileExists(userId: string): Promise<boolean> {
        const count = await this.profileRepository.count({
            where: { user_id: userId }
        })
        return count > 0
    }

    /**
     * Get all profiles (admin function)
     */
    async getAllProfiles(): Promise<Profile[]> {
        return await this.profileRepository.find()
    }

    /**
     * Delete user profile
     */
    async deleteProfile(userId: string): Promise<boolean> {
        const result = await this.profileRepository.delete({ user_id: userId })
        return (result.affected ?? 0) > 0
    }

    /**
     * Get user settings
     */
    async getUserSettings(userId: string): Promise<UserSettingsData> {
        const profile = await this.profileRepository.findOne({
            where: { user_id: userId }
        })
        return profile?.settings || {}
    }

    /**
     * Update user settings (deep merge).
     * Auto-creates profile if it doesn't exist.
     */
    async updateUserSettings(userId: string, settingsUpdate: Partial<UserSettingsData>, email?: string): Promise<UserSettingsData> {
        // Get or create profile - ensures profile exists
        let profile = await this.profileRepository.findOne({
            where: { user_id: userId }
        })

        if (!profile) {
            // Auto-create profile
            profile = await this.getOrCreateProfile(userId, email)
        }

        // Deep merge existing settings with update
        const currentSettings = profile.settings || {}
        const newSettings: UserSettingsData = {
            ...currentSettings,
            admin: {
                ...currentSettings.admin,
                ...settingsUpdate.admin
            },
            display: {
                ...currentSettings.display,
                ...settingsUpdate.display
            }
        }

        // Remove undefined keys
        if (newSettings.admin && Object.keys(newSettings.admin).length === 0) {
            delete newSettings.admin
        }
        if (newSettings.display && Object.keys(newSettings.display).length === 0) {
            delete newSettings.display
        }

        await this.profileRepository.update(
            { user_id: userId },
            { settings: newSettings, updated_at: new Date() }
        )

        return newSettings
    }
}
