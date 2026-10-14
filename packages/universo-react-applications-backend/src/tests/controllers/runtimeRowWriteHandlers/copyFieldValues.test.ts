import {
    assertRuntimeCopyReferenceFieldsAreScoped,
    buildRuntimeCopyFieldValues
} from '../../../controllers/runtimeRowWriteHandlers/copyFieldValues'
import type { RuntimeObjectCollectionAttr } from '../../../services/runtimeRowSupport/contracts'

describe('buildRuntimeCopyFieldValues', () => {
    it('resets only explicitly configured fields to their metadata default', () => {
        expect(
            buildRuntimeCopyFieldValues(
                [
                    { column_name: 'use_count', ui_config: { serverOwned: true, resetOnCopy: true, defaultValue: 0 } },
                    { column_name: 'slug' },
                    { column_name: 'nullable' }
                ],
                { use_count: 7, slug: 'class-quiz', nullable: null }
            )
        ).toEqual({ use_count: 0, slug: 'class-quiz', nullable: null })
    })

    it('uses null when a reset field has no default value', () => {
        expect(buildRuntimeCopyFieldValues([{ column_name: 'counter', ui_config: { resetOnCopy: true } }], { counter: 4 })).toEqual({
            counter: null
        })
    })

    it('never copies a guest session bearer token into the duplicated participant', () => {
        expect(
            buildRuntimeCopyFieldValues([{ column_name: 'guest_session_token', ui_config: { serverOwned: true, resetOnCopy: true } }], {
                guest_session_token: 'copied-bearer-token'
            })
        ).toEqual({ guest_session_token: null })
    })
})

describe('assertRuntimeCopyReferenceFieldsAreScoped', () => {
    const relationField: RuntimeObjectCollectionAttr = {
        id: 'course-ref',
        codename: 'CourseId',
        column_name: 'course_id',
        data_type: 'REF',
        target_object_id: '0190a9b5-3cde-7abc-8def-0123456789d1',
        target_object_kind: 'object',
        ui_config: { serverOwned: true },
        is_required: true
    }

    it('rejects carrying a server-owned object relationship into an unscoped copy', () => {
        expect(() => assertRuntimeCopyReferenceFieldsAreScoped({ attrs: [relationField], sourceRow: { course_id: 'course-1' } })).toThrow(
            expect.objectContaining({
                statusCode: 409,
                body: expect.objectContaining({ code: 'RUNTIME_RELATION_SCOPE_REQUIRED' })
            })
        )
    })

    it('allows the active scoped parent to be replaced and permits unrelated null references', () => {
        expect(() =>
            assertRuntimeCopyReferenceFieldsAreScoped({
                attrs: [relationField],
                sourceRow: { course_id: 'course-1' },
                scopedParentFieldColumnName: 'course_id'
            })
        ).not.toThrow()
        expect(() => assertRuntimeCopyReferenceFieldsAreScoped({ attrs: [relationField], sourceRow: { course_id: null } })).not.toThrow()
    })

    it('rejects another server-owned relationship when the copy scope covers only one parent field', () => {
        const otherRelation = { ...relationField, id: 'track-ref', codename: 'TrackId', column_name: 'track_id' }
        expect(() =>
            assertRuntimeCopyReferenceFieldsAreScoped({
                attrs: [relationField, otherRelation],
                sourceRow: { course_id: 'course-1', track_id: 'track-1' },
                scopedParentFieldColumnName: 'course_id'
            })
        ).toThrow(expect.objectContaining({ statusCode: 409 }))
    })

    it('honors an explicit resetOnCopy policy for a server-owned reference', () => {
        expect(() =>
            assertRuntimeCopyReferenceFieldsAreScoped({
                attrs: [{ ...relationField, ui_config: { serverOwned: true, resetOnCopy: true } }],
                sourceRow: { course_id: 'course-1' }
            })
        ).not.toThrow()
    })
})
