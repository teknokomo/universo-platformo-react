import { createGlobalAccessService } from '../../services/globalAccessService'

const createMockExecutor = (responses: unknown[][]) => {
  let callIndex = 0

  return {
    query: jest.fn().mockImplementation(async () => responses[callIndex++] ?? []),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
  }
}

describe('createGlobalAccessService', () => {
  it('marks the superuser role in aggregated access info', async () => {
    const exec = createMockExecutor([
      [{ role_codename: 'superuser', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#111111' }],
      [{ is_super: true }],
      [{ can_access: true }]
    ])
    const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

    const result = await service.getGlobalAccessInfo('user-1')

    expect(result.isSuperuser).toBe(true)
    expect(result.canAccessAdmin).toBe(true)
    expect(result.globalRoles).toEqual([
      expect.objectContaining({
        codename: 'superuser',
        metadata: expect.objectContaining({
          color: '#111111',
          isSuperuser: true
        })
      })
    ])
  })

  it('updates an existing role assignment instead of inserting a duplicate', async () => {
    const exec = createMockExecutor([
      [{ id: 'role-1', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#222222', is_superuser: false }],
      [{ id: 'assignment-1' }],
      [],
      [{ id: 'user-1', email: 'neo@example.com' }],
      [{ user_id: 'user-1', nickname: 'neo' }]
    ])
    const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

    const result = await service.grantRole('user-1', 'editor', 'admin-1', 'keep current assignment')

    const executedSql = exec.query.mock.calls.map(([sql]) => String(sql))

    expect(result).toEqual(
      expect.objectContaining({
        id: 'assignment-1',
        userId: 'user-1',
        email: 'neo@example.com',
        nickname: 'neo',
        roleCodename: 'editor',
        grantedBy: 'admin-1',
        comment: 'keep current assignment'
      })
    )
    expect(executedSql.some((sql) => sql.includes('UPDATE admin.user_roles'))).toBe(true)
    expect(executedSql.some((sql) => sql.includes('INSERT INTO admin.user_roles'))).toBe(false)
  })
})
