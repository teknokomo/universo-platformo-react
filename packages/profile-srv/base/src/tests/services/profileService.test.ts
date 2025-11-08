import { createMockRepository } from '../utils/typeormMocks'
import { ProfileService } from '../../services/profileService'

describe('ProfileService', () => {
    const createService = () => {
        const repository = createMockRepository<any>()
        const service = new ProfileService(repository as any)
        return { service, repository }
    }

    it('возвращает профиль пользователя по идентификатору', async () => {
        const { service, repository } = createService()
        const profile = { id: 'profile-1', user_id: 'user-1' }
        repository.findOne.mockResolvedValue(profile)

        const result = await service.getUserProfile('user-1')

        expect(repository.findOne).toHaveBeenCalledWith({
            where: { user_id: 'user-1' }
        })
        expect(result).toBe(profile)
    })

    it('проверяет уникальность никнейма с исключением пользователя', async () => {
        const { service, repository } = createService()
        repository.queryBuilder.getOne.mockResolvedValue(null)

        const available = await service.checkNicknameAvailable('nickname', 'user-2')

        expect(repository.createQueryBuilder).toHaveBeenCalledWith('profile')
        expect(repository.queryBuilder.where).toHaveBeenCalledWith('profile.nickname = :nickname', {
            nickname: 'nickname'
        })
        expect(repository.queryBuilder.andWhere).toHaveBeenCalledWith('profile.user_id != :userId', {
            userId: 'user-2'
        })
        expect(available).toBe(true)
    })

    it('обновляет профиль после проверки никнейма', async () => {
        const { service, repository } = createService()
        jest.spyOn(service, 'checkNicknameAvailable').mockResolvedValue(true)
        repository.update.mockResolvedValue({ affected: 1 })
        repository.findOne.mockResolvedValue({ id: 'profile-1', user_id: 'user-1', nickname: 'new' })

        const result = await service.updateProfile('user-1', { nickname: 'new' })

        expect(service.checkNicknameAvailable).toHaveBeenCalledWith('new', 'user-1')
        expect(repository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, expect.objectContaining({ nickname: 'new' }))
        expect(result).toEqual({ id: 'profile-1', user_id: 'user-1', nickname: 'new' })
    })

    it('возвращает null если профиль не найден при обновлении', async () => {
        const { service, repository } = createService()
        jest.spyOn(service, 'checkNicknameAvailable').mockResolvedValue(true)
        repository.update.mockResolvedValue({ affected: 0 })

        const result = await service.updateProfile('user-1', { nickname: 'missing' })

        expect(result).toBeNull()
    })

    it('удаляет профиль пользователя', async () => {
        const { service, repository } = createService()
        repository.delete.mockResolvedValue({ affected: 1 })

        const removed = await service.deleteProfile('user-1')

        expect(repository.delete).toHaveBeenCalledWith({ user_id: 'user-1' })
        expect(removed).toBe(true)
    })
})
