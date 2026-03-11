import { isUniqueViolation, type DbExecutor } from '@universo/utils/database'
import {
    findProfileByUserId,
    createProfile as createProfileRow,
    updateProfileByUserId,
    isNicknameAvailable as checkNickname,
    profileExistsByUserId,
    findAllProfiles,
    deleteProfileByUserId,
    type ProfileRow
} from '../persistence/profileStore'
import { CreateProfileDto, UpdateProfileDto, UserSettingsData } from '../types'

/**
 * Generate a unique nickname based on email or user ID
 */
function generateNickname(userId: string, email?: string): string {
    if (email) {
        // Use email prefix, sanitized for nickname rules
        const prefix = email
            .split('@')[0]
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .substring(0, 20)
        const suffix = userId.substring(0, 8)
        return `${prefix}_${suffix}`
    }
    // Fallback to user ID based nickname
    return `user_${userId.substring(0, 16).replace(/-/g, '')}`
}

export class ProfileService {
    constructor(private exec: DbExecutor) {}

    private async createAutoProfile(userId: string, email?: string): Promise<ProfileRow> {
        const baseNickname = generateNickname(userId, email)
        const maxAttempts = 10

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const nickname = attempt === 0 ? baseNickname : `${baseNickname}_${(Date.now() + attempt) % 10000}`

            try {
                const profile = await createProfileRow(this.exec, {
                    user_id: userId,
                    nickname,
                    settings: {}
                })
                console.log(`[ProfileService] Auto-created profile for user ${userId} with nickname ${nickname}`)
                return profile
            } catch (error) {
                if (!isUniqueViolation(error)) {
                    throw error
                }

                const concurrentProfile = await findProfileByUserId(this.exec, userId)
                if (concurrentProfile) {
                    return concurrentProfile
                }
            }
        }

        throw new Error(`Failed to auto-create profile for user ${userId} after ${maxAttempts} attempts`)
    }

    /**
     * Get user profile by user ID
     */
    async getUserProfile(userId: string): Promise<ProfileRow | null> {
        return findProfileByUserId(this.exec, userId)
    }

    /**
     * Get or create user profile.
     * If profile doesn't exist, creates one with auto-generated nickname.
     */
    async getOrCreateProfile(userId: string, email?: string): Promise<ProfileRow> {
        let profile = await findProfileByUserId(this.exec, userId)

        if (!profile) {
            profile = await this.createAutoProfile(userId, email)
        }

        return profile
    }

    /**
     * Create a new profile for a user
     */
    async createProfile(data: CreateProfileDto): Promise<ProfileRow> {
        return createProfileRow(this.exec, data)
    }

    /**
     * Check if nickname is available
     */
    async checkNicknameAvailable(nickname: string, excludeUserId?: string): Promise<boolean> {
        try {
            return await checkNickname(this.exec, nickname, excludeUserId)
        } catch {
            // If query fails (e.g., table doesn't exist in local DB), assume nickname is available.
            return true
        }
    }

    /**
     * Update existing user profile
     */
    async updateProfile(userId: string, data: UpdateProfileDto): Promise<ProfileRow | null> {
        // Check nickname uniqueness if being updated
        if (data.nickname) {
            const isAvailable = await this.checkNicknameAvailable(data.nickname, userId)
            if (!isAvailable) {
                throw new Error('Nickname is already taken')
            }
        }

        return updateProfileByUserId(this.exec, userId, data as Record<string, unknown>)
    }

    /**
     * Check if profile exists for user
     */
    async profileExists(userId: string): Promise<boolean> {
        return profileExistsByUserId(this.exec, userId)
    }

    /**
     * Get all profiles (admin function)
     */
    async getAllProfiles(): Promise<ProfileRow[]> {
        return findAllProfiles(this.exec)
    }

    /**
     * Delete user profile
     */
    async deleteProfile(userId: string): Promise<boolean> {
        return deleteProfileByUserId(this.exec, userId)
    }

    /**
     * Get user settings
     */
    async getUserSettings(userId: string): Promise<UserSettingsData> {
        const profile = await findProfileByUserId(this.exec, userId)
        return profile?.settings || {}
    }

    /**
     * Update user settings (deep merge).
     * Auto-creates profile if it doesn't exist.
     */
    async updateUserSettings(userId: string, settingsUpdate: Partial<UserSettingsData>, email?: string): Promise<UserSettingsData> {
        let profile = await findProfileByUserId(this.exec, userId)

        if (!profile) {
            profile = await this.createAutoProfile(userId, email)
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

        await updateProfileByUserId(this.exec, userId, { settings: newSettings })

        return newSettings
    }

    /**
     * Mark onboarding as completed, bootstrapping the profile when needed.
     */
    async markOnboardingCompleted(userId: string, email?: string): Promise<ProfileRow> {
        let profile = await findProfileByUserId(this.exec, userId)

        if (!profile) {
            profile = await this.createAutoProfile(userId, email)
        }

        if (profile.onboarding_completed) {
            return profile
        }

        return (await updateProfileByUserId(this.exec, userId, { onboarding_completed: true })) ?? profile
    }
}
