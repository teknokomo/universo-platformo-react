import { hasRequiredRole, isValidUnikRole, getRoleLevel, ROLE_HIERARCHY, UnikRole } from '../../src/services/access-control/roles'

describe('Access Control Roles', () => {
    describe('hasRequiredRole', () => {
        it('should allow access when no role restrictions exist', () => {
            expect(hasRequiredRole('member', [])).toBe(true)
            expect(hasRequiredRole('owner', [])).toBe(true)
        })

        it('should allow access when user has exact required role', () => {
            expect(hasRequiredRole('admin', ['admin'])).toBe(true)
            expect(hasRequiredRole('editor', ['editor', 'admin'])).toBe(true)
        })

        it('should allow access when user has higher role than required', () => {
            // Owner should be able to do everything
            expect(hasRequiredRole('owner', ['admin'])).toBe(true)
            expect(hasRequiredRole('owner', ['editor'])).toBe(true)
            expect(hasRequiredRole('owner', ['member'])).toBe(true)

            // Admin should be able to do editor and member tasks
            expect(hasRequiredRole('admin', ['editor'])).toBe(true)
            expect(hasRequiredRole('admin', ['member'])).toBe(true)

            // Editor should be able to do member tasks
            expect(hasRequiredRole('editor', ['member'])).toBe(true)
        })

        it('should deny access when user has lower role than required', () => {
            expect(hasRequiredRole('member', ['editor'])).toBe(false)
            expect(hasRequiredRole('member', ['admin'])).toBe(false)
            expect(hasRequiredRole('member', ['owner'])).toBe(false)

            expect(hasRequiredRole('editor', ['admin'])).toBe(false)
            expect(hasRequiredRole('editor', ['owner'])).toBe(false)

            expect(hasRequiredRole('admin', ['owner'])).toBe(false)
        })

        it('should work with multiple allowed roles', () => {
            expect(hasRequiredRole('owner', ['admin', 'editor'])).toBe(true)
            expect(hasRequiredRole('admin', ['admin', 'editor'])).toBe(true)
            expect(hasRequiredRole('editor', ['admin', 'editor'])).toBe(true)
            expect(hasRequiredRole('member', ['admin', 'editor'])).toBe(false)
        })
    })

    describe('isValidUnikRole', () => {
        it('should validate correct role strings', () => {
            expect(isValidUnikRole('owner')).toBe(true)
            expect(isValidUnikRole('admin')).toBe(true)
            expect(isValidUnikRole('editor')).toBe(true)
            expect(isValidUnikRole('member')).toBe(true)
        })

        it('should reject invalid role strings', () => {
            expect(isValidUnikRole('invalid')).toBe(false)
            expect(isValidUnikRole('user')).toBe(false)
            expect(isValidUnikRole('')).toBe(false)
            expect(isValidUnikRole('Owner')).toBe(false) // case sensitive
        })
    })

    describe('getRoleLevel', () => {
        it('should return correct hierarchy levels', () => {
            expect(getRoleLevel('owner')).toBe(4)
            expect(getRoleLevel('admin')).toBe(3)
            expect(getRoleLevel('editor')).toBe(2)
            expect(getRoleLevel('member')).toBe(1)
        })

        it('should maintain hierarchy order', () => {
            expect(getRoleLevel('owner')).toBeGreaterThan(getRoleLevel('admin'))
            expect(getRoleLevel('admin')).toBeGreaterThan(getRoleLevel('editor'))
            expect(getRoleLevel('editor')).toBeGreaterThan(getRoleLevel('member'))
        })
    })

    describe('ROLE_HIERARCHY', () => {
        it('should have all required roles', () => {
            expect(ROLE_HIERARCHY.owner).toBeDefined()
            expect(ROLE_HIERARCHY.admin).toBeDefined()
            expect(ROLE_HIERARCHY.editor).toBeDefined()
            expect(ROLE_HIERARCHY.member).toBeDefined()
        })

        it('should have correct hierarchy values', () => {
            expect(ROLE_HIERARCHY.owner > ROLE_HIERARCHY.admin).toBe(true)
            expect(ROLE_HIERARCHY.admin > ROLE_HIERARCHY.editor).toBe(true)
            expect(ROLE_HIERARCHY.editor > ROLE_HIERARCHY.member).toBe(true)
        })
    })
})