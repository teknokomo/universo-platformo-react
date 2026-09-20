import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    buildResolvableKeySet,
    describeVacuousScan,
    findDuplicateKeys,
    findHardcodedDiscardDefaults,
    flattenKeys,
    normalizePluralKeys
} from './lib/i18n-keys.mjs'

test('findDuplicateKeys reports repeated keys per object, including escaped spellings', () => {
    const source = ['{', '  "a": 1,', '  "b": { "c": 1, "c": 2 },', '  "\\u0061": 3', '}'].join('\n')
    const duplicates = findDuplicateKeys(source).map((entry) => entry.key)
    assert.deepEqual(duplicates.sort(), ['a', 'c'])
})

test('findDuplicateKeys accepts clean JSON and array payloads', () => {
    const source = '{"a":1,"b":[{"c":1},{"c":2}],"d":{"e":1}}'
    assert.deepEqual(findDuplicateKeys(source), [])
})

test('normalizePluralKeys collapses locale plural suffixes', () => {
    const normalized = normalizePluralKeys(new Set(['rows_one', 'rows_few', 'rows_many', 'plain']))
    assert.deepEqual([...normalized].sort(), ['plain', 'rows'])
})

test('buildResolvableKeySet accepts a base key when only plural variants exist', () => {
    const resolvable = buildResolvableKeySet(new Set(['rows_one', 'rows_other']))
    assert.equal(resolvable.has('rows'), true)
    assert.equal(resolvable.has('rows_one'), true)
    assert.equal(resolvable.has('missing'), false)
})

test('flattenKeys walks nested objects without following arrays', () => {
    const keys = flattenKeys({ a: { b: 'x' }, list: ['y'] })
    assert.deepEqual([...keys].sort(), ['a.b', 'list'])
})

test('describeVacuousScan refuses empty scans and accepts populated ones', () => {
    assert.match(describeVacuousScan({ name: 'pkg', sourceFileCount: 0, literalKeyCount: 0 }) ?? '', /no source files were scanned/u)
    assert.match(describeVacuousScan({ name: 'pkg', sourceFileCount: 12, literalKeyCount: 0 }) ?? '', /only 0 literal translation key/u)
    assert.match(
        describeVacuousScan({ name: 'pkg', sourceFileCount: 12, literalKeyCount: 3, minLiteralKeys: 5 }) ?? '',
        /expected at least 5/u
    )
    assert.equal(describeVacuousScan({ name: 'pkg', sourceFileCount: 12, literalKeyCount: 40 }), null)
})

test('findHardcodedDiscardDefaults flags literal discard prop defaults only', () => {
    const flagged = findHardcodedDiscardDefaults(
        "discardChangesTitle = 'Discard unsaved changes?', discardChangesCancelButtonText = 'Keep editing'"
    )
    assert.equal(flagged.length, 2)
    const clean = findHardcodedDiscardDefaults(
        "discardChangesTitle, discardChangesConfirmButtonText = t('unsavedChanges.confirm')"
    )
    assert.equal(clean.length, 0)
})
