import { ProfileService } from '../../services/profileService'

function createMockExec() {
    return { query: jest.fn(), transaction: jest.fn(), isReleased: jest.fn(() => false) }
}

describe('ProfileService', () => {
    const createService = () => {
        const exec = createMockExec()
        const service = new ProfileService(exec as never)
        return { service, exec }
    }

    it('возвращает профиль пользователя по идентификатору', async () => {
        const { service, exec } = createService()
        const profile = { id: 'profile-1', user_id: 'user-1' }
        exec.query.mockResolvedValue([profile])

        const result = await service.getUserProfile('user-1')

        expect(exec.query).toHaveBeenCalledWith(
            'SELECT * FROM profiles.obj_profiles WHERE user_id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1',
            ['user-1']
        )
        expect(result).toBe(profile)
    })

    it('проверяет уникальность никнейма с исключением пользователя', async () => {
        const { service, exec } = createService()
        exec.query.mockResolvedValue([])

        const available = await service.checkNicknameAvailable('nickname', 'user-2')

        expect(exec.query).toHaveBeenCalledWith(
            'SELECT 1 FROM profiles.obj_profiles WHERE nickname = $1 AND _upl_deleted = false AND _app_deleted = false AND user_id != $2 LIMIT 1',
            ['nickname', 'user-2']
        )
        expect(available).toBe(true)
    })

    it('обновляет профиль после проверки никнейма', async () => {
        const { service, exec } = createService()
        jest.spyOn(service, 'checkNicknameAvailable').mockResolvedValue(true)
        const updated = { id: 'profile-1', user_id: 'user-1', nickname: 'new' }
        exec.query.mockResolvedValue([updated])

        const result = await service.updateProfile('user-1', { nickname: 'new' })

        expect(service.checkNicknameAvailable).toHaveBeenCalledWith('new', 'user-1')
        expect(result).toEqual(updated)
    })

    it('игнорирует неподдерживаемые поля при обновлении профиля', async () => {
        const { service, exec } = createService()
        jest.spyOn(service, 'checkNicknameAvailable').mockResolvedValue(true)
        const updated = { id: 'profile-1', user_id: 'user-1', nickname: 'new' }
        exec.query.mockResolvedValue([updated])

        const result = await service.updateProfile('user-1', {
            nickname: 'new',
            user_id: 'user-2',
            _upl_deleted: true
        } as never)

        expect(result).toEqual(updated)
        expect(exec.query).toHaveBeenCalledWith(
            'UPDATE profiles.obj_profiles SET nickname = $1, _upl_updated_at = NOW() WHERE user_id = $2 AND _upl_deleted = false AND _app_deleted = false RETURNING id, user_id, nickname, first_name, last_name, settings, onboarding_completed, terms_accepted, terms_accepted_at, privacy_accepted, privacy_accepted_at, terms_version, privacy_version, _upl_created_at, _upl_updated_at',
            ['new', 'user-1']
        )
    })

    it('возвращает null если профиль не найден при обновлении', async () => {
        const { service, exec } = createService()
        jest.spyOn(service, 'checkNicknameAvailable').mockResolvedValue(true)
        exec.query.mockResolvedValue([])

        const result = await service.updateProfile('user-1', { nickname: 'missing' })

        expect(result).toBeNull()
    })

    it('возвращает существующий профиль в getOrCreateProfile без создания новой записи', async () => {
        const { service, exec } = createService()
        const existing = { id: 'profile-1', user_id: 'user-1', nickname: 'existing' }
        exec.query.mockResolvedValue([existing])

        const result = await service.getOrCreateProfile('user-1', 'existing@example.com')

        expect(result).toBe(existing)
        expect(exec.query).toHaveBeenCalledTimes(1)
    })

    it('повторяет insert с новым никнеймом после unique-конфликта', async () => {
        const { service, exec } = createService()
        const created = { id: 'profile-2', user_id: '12345678-1234-1234-1234-123456789abc', nickname: 'john_doe_1_12345678_1235' }
        const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000001234)
        const nicknameConflict = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })

        exec.query
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(nicknameConflict)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([created])

        const result = await service.getOrCreateProfile('12345678-1234-1234-1234-123456789abc', 'john.doe+1@example.com')

        expect(result).toEqual(created)
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO profiles.obj_profiles'), [
            '12345678-1234-1234-1234-123456789abc',
            'john_doe_1_12345678',
            null,
            null,
            '{}'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(4, expect.stringContaining('INSERT INTO profiles.obj_profiles'), [
            '12345678-1234-1234-1234-123456789abc',
            'john_doe_1_12345678_1235',
            null,
            null,
            '{}'
        ])

        dateNowSpy.mockRestore()
    })

    it('возвращает конкурентно созданный профиль после unique-конфликта по user_id', async () => {
        const { service, exec } = createService()
        const existing = { id: 'profile-3', user_id: 'user-3', nickname: 'race' }
        const userConflict = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })

        exec.query.mockResolvedValueOnce([]).mockRejectedValueOnce(userConflict).mockResolvedValueOnce([existing])

        const result = await service.getOrCreateProfile('user-3', 'race@example.com')

        expect(result).toEqual(existing)
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO profiles.obj_profiles'), [
            'user-3',
            'race_user-3',
            null,
            null,
            '{}'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(
            3,
            'SELECT * FROM profiles.obj_profiles WHERE user_id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1',
            ['user-3']
        )
    })

    it('глубоко объединяет настройки пользователя при обновлении', async () => {
        const { service, exec } = createService()
        exec.query
            .mockResolvedValueOnce([
                {
                    id: 'profile-1',
                    user_id: 'user-1',
                    nickname: 'neo',
                    settings: {
                        admin: { showAllItems: false },
                        display: { itemsPerPage: 20 }
                    }
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: 'profile-1',
                    user_id: 'user-1',
                    nickname: 'neo',
                    settings: {
                        admin: { showAllItems: false },
                        display: { itemsPerPage: 20, defaultViewMode: 'list' }
                    }
                }
            ])

        const result = await service.updateUserSettings('user-1', {
            display: { defaultViewMode: 'list' }
        })

        expect(result).toEqual({
            admin: { showAllItems: false },
            display: { itemsPerPage: 20, defaultViewMode: 'list' }
        })
        expect(exec.query).toHaveBeenNthCalledWith(
            2,
            'UPDATE profiles.obj_profiles SET settings = $1, _upl_updated_at = NOW() WHERE user_id = $2 AND _upl_deleted = false AND _app_deleted = false RETURNING id, user_id, nickname, first_name, last_name, settings, onboarding_completed, terms_accepted, terms_accepted_at, privacy_accepted, privacy_accepted_at, terms_version, privacy_version, _upl_created_at, _upl_updated_at',
            [JSON.stringify(result), 'user-1']
        )
    })

    it('завершает onboarding после автосоздания отсутствующего профиля', async () => {
        const { service, exec } = createService()
        const created = {
            id: 'profile-4',
            user_id: 'user-4',
            nickname: 'user_user4',
            settings: {},
            onboarding_completed: false
        }
        const completed = {
            ...created,
            onboarding_completed: true
        }

        exec.query.mockResolvedValueOnce([]).mockResolvedValueOnce([created]).mockResolvedValueOnce([completed])

        const result = await service.markOnboardingCompleted('user-4')

        expect(result).toEqual(completed)
        expect(exec.query).toHaveBeenNthCalledWith(
            1,
            'SELECT * FROM profiles.obj_profiles WHERE user_id = $1 AND _upl_deleted = false AND _app_deleted = false LIMIT 1',
            ['user-4']
        )
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO profiles.obj_profiles'), [
            'user-4',
            'user_user4',
            null,
            null,
            '{}'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(
            3,
            'UPDATE profiles.obj_profiles SET onboarding_completed = $1, _upl_updated_at = NOW() WHERE user_id = $2 AND _upl_deleted = false AND _app_deleted = false RETURNING id, user_id, nickname, first_name, last_name, settings, onboarding_completed, terms_accepted, terms_accepted_at, privacy_accepted, privacy_accepted_at, terms_version, privacy_version, _upl_created_at, _upl_updated_at',
            [true, 'user-4']
        )
    })

    it('удаляет профиль пользователя', async () => {
        const { service, exec } = createService()
        exec.query.mockResolvedValue([{ id: 'profile-1' }])

        const removed = await service.deleteProfile('user-1', 'user-1')

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE profiles.obj_profiles'), ['user-1', 'user-1'])
        expect(removed).toBe(true)
    })
})
