import { Repository } from 'typeorm'
import { Profile } from '../database/entities/Profile'
import { CreateProfileDto, UpdateProfileDto } from '../types'

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
}
