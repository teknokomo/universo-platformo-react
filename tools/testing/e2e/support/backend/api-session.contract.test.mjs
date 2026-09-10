import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApplicationEffectiveLayoutPath } from './api-session.mjs'

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334445'

test('serializes global effective-layout requests without content selectors', () => {
    assert.equal(
        buildApplicationEffectiveLayoutPath(applicationId, {
            targetKind: null,
            locale: 'en',
            themeVariant: 'light'
        }),
        `/api/v1/applications/${applicationId}/runtime/effective-layout?locale=en&themeVariant=light`
    )
})

test('serializes one entity selector for a scoped effective-layout request', () => {
    assert.equal(
        buildApplicationEffectiveLayoutPath(applicationId, {
            targetKind: 'page',
            entityTypeCodename: 'landing-page',
            workspaceId,
            locale: 'ru'
        }),
        `/api/v1/applications/${applicationId}/runtime/effective-layout?targetKind=page&entityTypeCodename=landing-page&workspaceId=${workspaceId}&locale=ru`
    )
})

test('rejects content-only and ambiguous effective-layout inputs', () => {
    assert.throws(
        () =>
            buildApplicationEffectiveLayoutPath(applicationId, {
                targetKind: null,
                locale: 'en',
                recordKey: 'content-1'
            }),
        /Unsupported effective-layout query parameter: recordKey/
    )
    assert.throws(
        () =>
            buildApplicationEffectiveLayoutPath(applicationId, {
                targetKind: 'object',
                entityTypeId: 'type-1',
                entityTypeCodename: 'object-type',
                locale: 'en'
            }),
        /entityTypeId or entityTypeCodename, not both/
    )
})
