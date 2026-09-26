import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readPngDimensions } from '../testing/e2e/support/pngDimensions.mjs'

const screenshot = readFileSync('docs/en/.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png')

test('reads dimensions from the complete PNG structure and verifies its chunk checksums', () => {
    const dimensions = readPngDimensions(screenshot)
    assert.ok(dimensions.width > 0)
    assert.ok(dimensions.height > 0)
})

test('rejects a PNG with a damaged signature, header, checksum, or ending', () => {
    const invalidSignature = Buffer.from(screenshot)
    invalidSignature[7] ^= 0xff
    assert.throws(() => readPngDimensions(invalidSignature), /signature/)

    const invalidHeader = Buffer.from(screenshot)
    invalidHeader.writeUInt32BE(12, 8)
    assert.throws(() => readPngDimensions(invalidHeader), /checksum|IHDR/)

    const invalidChecksum = Buffer.from(screenshot)
    invalidChecksum[20] ^= 0xff
    assert.throws(() => readPngDimensions(invalidChecksum), /checksum/)

    assert.throws(() => readPngDimensions(screenshot.subarray(0, 24)), /truncated/)
    assert.throws(() => readPngDimensions(screenshot.subarray(0, -12)), /truncated|missing/)
})
