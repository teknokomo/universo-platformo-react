import { describe, expect, it } from 'vitest'
import {
    getDbErrorCode,
    getDbErrorConstraint,
    getDbErrorDetail,
    isDatabaseConnectTimeoutError,
    isUniqueViolation,
    isSlugUniqueViolation
} from '../errors'

describe('isDatabaseConnectTimeoutError', () => {
    it('returns true for pg-pool connect timeout message', () => {
        expect(isDatabaseConnectTimeoutError(new Error('timeout exceeded when trying to connect'))).toBe(true)
    })

    it('returns true for terminated connection message', () => {
        expect(isDatabaseConnectTimeoutError(new Error('connection terminated unexpectedly'))).toBe(true)
    })

    it('returns false for non-timeout errors', () => {
        expect(isDatabaseConnectTimeoutError(new Error('syntax error at or near "FROM"'))).toBe(false)
    })

    it('returns false for non-error values', () => {
        expect(isDatabaseConnectTimeoutError('timeout exceeded when trying to connect')).toBe(false)
    })
})

describe('db error extraction helpers', () => {
    it('extracts code/constraint/detail from top-level error fields', () => {
        const error = { code: '23505', constraint: 'applications_slug_key', detail: 'Key (slug)=(demo-copy) already exists.' }
        expect(getDbErrorCode(error)).toBe('23505')
        expect(getDbErrorConstraint(error)).toBe('applications_slug_key')
        expect(getDbErrorDetail(error)).toBe('Key (slug)=(demo-copy) already exists.')
    })

    it('extracts code/constraint/detail from nested driverError fields', () => {
        const error = {
            driverError: {
                code: '23505',
                constraint: 'idx_branches_metahub_codename_active',
                detail: 'Key (codename)=(main-copy) already exists.'
            }
        }

        expect(getDbErrorCode(error)).toBe('23505')
        expect(getDbErrorConstraint(error)).toBe('idx_branches_metahub_codename_active')
        expect(getDbErrorDetail(error)).toBe('Key (codename)=(main-copy) already exists.')
    })

    it('detects unique and slug-specific violations', () => {
        const slugConflict = { code: '23505', detail: 'Key (slug)=(demo-copy) already exists.' }
        const codenameConflict = { code: '23505', constraint: 'idx_branches_metahub_codename_active' }

        expect(isUniqueViolation(slugConflict)).toBe(true)
        expect(isSlugUniqueViolation(slugConflict)).toBe(true)
        expect(isUniqueViolation(codenameConflict)).toBe(true)
        expect(isSlugUniqueViolation(codenameConflict)).toBe(false)
    })
})
