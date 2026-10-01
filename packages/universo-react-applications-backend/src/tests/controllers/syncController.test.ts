import type { ApplicationLayoutChange } from '@universo-react/types'
import { findBlockedEntityBackedCopyResolution } from '../../controllers/syncController'

const requiredBindingsConflict: ApplicationLayoutChange = {
    type: 'LAYOUT_CONFLICT',
    scope: 'global',
    sourceLayoutId: 'layout-hero',
    applicationLayoutId: 'application-layout-hero',
    recommendedResolution: 'keep_local',
    copyAsApplicationUnavailable: true
}

describe('findBlockedEntityBackedCopyResolution', () => {
    it('detects a blocked copy selected through the bulk policy', () => {
        expect(findBlockedEntityBackedCopyResolution([requiredBindingsConflict], { default: 'copy_source_as_application' })).toBe(
            requiredBindingsConflict
        )
    })

    it('honors a safe per-layout override over a blocked bulk copy', () => {
        expect(
            findBlockedEntityBackedCopyResolution([requiredBindingsConflict], {
                default: 'copy_source_as_application',
                bySourceLayoutId: { 'layout-hero': 'keep_local' }
            })
        ).toBeUndefined()
    })

    it('detects blocked copies selected for a source-default collision', () => {
        const defaultCollision: ApplicationLayoutChange = {
            ...requiredBindingsConflict,
            type: 'LAYOUT_DEFAULT_COLLISION'
        }

        expect(findBlockedEntityBackedCopyResolution([defaultCollision], { default: 'copy_source_as_application' })).toBe(defaultCollision)
    })

    it('allows copy when no entity-backed content restriction is present', () => {
        expect(
            findBlockedEntityBackedCopyResolution([{ ...requiredBindingsConflict, copyAsApplicationUnavailable: false }], {
                default: 'copy_source_as_application'
            })
        ).toBeUndefined()
    })
})
