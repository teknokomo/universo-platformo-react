import { describe, expect, it } from 'vitest'
import type { GlobalShortLinkTarget } from '@universo-react/types'
import { getPublicGlobalShortLinkPath } from './publicGlobalShortLinkTarget'

const APPLICATION_ID = '0190a9b5-3cde-7abc-8def-0123456789ac'

describe('public global short-link target routing', () => {
    it('builds only same-origin paths for implemented entry and section targets', () => {
        expect(getPublicGlobalShortLinkPath({ kind: 'application-entry', applicationId: APPLICATION_ID })).toBe(`/a/${APPLICATION_ID}`)
        expect(getPublicGlobalShortLinkPath({ kind: 'application-section', applicationId: APPLICATION_ID, section: 'dashboard' })).toBe(
            `/a/${APPLICATION_ID}`
        )
        expect(getPublicGlobalShortLinkPath({ kind: 'application-section', applicationId: APPLICATION_ID, section: 'workspace' })).toBe(
            `/a/${APPLICATION_ID}/workspaces`
        )
        expect(
            getPublicGlobalShortLinkPath({
                kind: 'application-resource',
                applicationId: APPLICATION_ID,
                targetKind: 'page',
                entityTypeCodename: 'home'
            })
        ).toBe(`/a/${APPLICATION_ID}?targetKind=page&entityTypeCodename=home`)
    })

    it('keeps quiz access on the dedicated guest route and fails closed for malformed runtime payloads', () => {
        const quizTarget: GlobalShortLinkTarget = {
            kind: 'lms-access-link',
            applicationId: APPLICATION_ID,
            accessLinkId: '0190a9b5-3cde-7abc-8def-0123456789ad',
            accessLinkSlug: 'grade-5',
            workspaceId: null
        }
        expect(getPublicGlobalShortLinkPath(quizTarget)).toBeNull()
        expect(getPublicGlobalShortLinkPath({} as GlobalShortLinkTarget)).toBeNull()
    })
})
