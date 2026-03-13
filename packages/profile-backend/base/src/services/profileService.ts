import { isUniqueViolation, type DbExecutor } from '@universo/utils/database'
import {
    findProfileByUserId,
    createProfile as createProfileRow,
    updateProfileByUserId,
    isNicknameAvailable as checkNickname,
    profileExistsByUserId,
    findAllProfiles,
    deleteProfileByUserId,
    type ProfileRow,
    type ProfileUpdateRowInput
} from '../persistence/profileStore'
import { CreateProfileInput, UpdateProfileDto, UserSettingsData } from '../types'

function generateNickname(userId: string, email?: string): string {
    if (email) {
        const prefix = email
            .split('@')[0]
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .substring(0, 20)
        const suffix = userId.substring(0, 8)
        return `${prefix}_${suffix}`
    }

    return `user_${userId.substring(0, 16).replace(/-/g, '')}`
}

function sanitizePublicProfileUpdate(data: UpdateProfileDto): ProfileUpdateRowInput {
    const sanitized: ProfileUpdateRowInput = {}

    if (typeof data.nickname === 'string') {
        sanitized.nickname = data.nickname
    }

    if (typeof data.first_name === 'string') {
        sanitized.first_name = data.first_name
    }

    if (typeof data.last_name === 'string') {
        sanitized.last_name = data.last_name
    }

    return sanitized
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

    async getUserProfile(userId: string): Promise<ProfileRow | null> {
        return findProfileByUserId(this.exec, userId)
    }

    async getOrCreateProfile(userId: string, email?: string): Promise<ProfileRow> {
        let profile = await findProfileByUserId(this.exec, userId)

        if (!profile) {
            profile = await this.createAutoProfile(userId, email)
        }

        return profile
    }

    async createProfile(data: CreateProfileInput): Promise<ProfileRow> {
        return createProfileRow(this.exec, data)
    }

    async checkNicknameAvailable(nickname: string, excludeUserId?: string): Promise<boolean> {
        try {
            return await checkNickname(this.exec, nickname, excludeUserId)
        } catch {
            return true
        }
    }

    async updateProfile(userId: string, data: UpdateProfileDto): Promise<ProfileRow | null> {
        const sanitizedData = sanitizePublicProfileUpdate(data)

        if (Object.keys(sanitizedData).length === 0) {
            throw new Error('No supported profile fields provided for update')
        }

        if (sanitizedData.nickname) {
            const isAvailable = await this.checkNicknameAvailable(sanitizedData.nickname, userId)
            if (!isAvailable) {
                throw new Error('Nickname is already taken')
            }
        }

        return updateProfileByUserId(this.exec, userId, sanitizedData)
    }

    async profileExists(userId: string): Promise<boolean> {
        return profileExistsByUserId(this.exec, userId)
    }

    async getAllProfiles(): Promise<ProfileRow[]> {
        return findAllProfiles(this.exec)
    }

    async deleteProfile(userId: string, deletedBy?: string | null): Promise<boolean> {
        return deleteProfileByUserId(this.exec, userId, deletedBy ?? undefined)
    }

    async getUserSettings(userId: string): Promise<UserSettingsData> {
        const profile = await findProfileByUserId(this.exec, userId)
        return profile?.settings || {}
    }

    async updateUserSettings(userId: string, settingsUpdate: Partial<UserSettingsData>, email?: string): Promise<UserSettingsData> {
        let profile = await findProfileByUserId(this.exec, userId)

        if (!profile) {
            profile = await this.createAutoProfile(userId, email)
        }

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

        if (newSettings.admin && Object.keys(newSettings.admin).length === 0) {
            delete newSettings.admin
        }
        if (newSettings.display && Object.keys(newSettings.display).length === 0) {
            delete newSettings.display
        }

        await updateProfileByUserId(this.exec, userId, { settings: newSettings })

        return newSettings
    }

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
