const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    let checksum = value
    for (let bit = 0; bit < 8; bit += 1) {
        checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1
    }
    return checksum >>> 0
})

const crc32 = (bytes) => {
    let checksum = 0xffffffff
    for (const byte of bytes) checksum = CRC_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8)
    return (checksum ^ 0xffffffff) >>> 0
}

export function readPngDimensions(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length + 25 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error('not a valid PNG file: invalid signature or truncated header')
    }

    let offset = PNG_SIGNATURE.length
    let dimensions
    let hasImageData = false
    let hasEnd = false
    let isFirstChunk = true

    while (offset < buffer.length) {
        if (buffer.length - offset < 12) throw new Error('not a valid PNG file: truncated chunk header')
        const dataLength = buffer.readUInt32BE(offset)
        const dataStart = offset + 8
        const crcOffset = dataStart + dataLength
        const chunkEnd = crcOffset + 4
        if (chunkEnd > buffer.length) throw new Error('not a valid PNG file: truncated chunk data')

        const chunkType = buffer.toString('ascii', offset + 4, dataStart)
        const chunkBytes = buffer.subarray(offset + 4, crcOffset)
        if (crc32(chunkBytes) !== buffer.readUInt32BE(crcOffset)) {
            throw new Error(`not a valid PNG file: ${chunkType} checksum mismatch`)
        }

        if (isFirstChunk) {
            if (chunkType !== 'IHDR' || dataLength !== 13) throw new Error('not a valid PNG file: invalid IHDR chunk')
            const width = buffer.readUInt32BE(dataStart)
            const height = buffer.readUInt32BE(dataStart + 4)
            if (width === 0 || height === 0) throw new Error('not a valid PNG file: zero-sized image')
            dimensions = { width, height }
            isFirstChunk = false
        } else if (chunkType === 'IHDR') {
            throw new Error('not a valid PNG file: duplicate IHDR chunk')
        }

        if (chunkType === 'IDAT') hasImageData = true
        if (chunkType === 'IEND') {
            if (dataLength !== 0) throw new Error('not a valid PNG file: invalid IEND chunk')
            hasEnd = true
            offset = chunkEnd
            break
        }

        offset = chunkEnd
    }

    if (!dimensions || !hasImageData || !hasEnd || offset !== buffer.length) {
        throw new Error('not a valid PNG file: missing image data or terminal IEND chunk')
    }
    return dimensions
}
