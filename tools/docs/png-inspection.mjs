import { inflateSync } from 'node:zlib'

const PNG_SIGNATURE = '89504e470d0a1a0a'

export function readPngDimensions(buffer) {
    if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) throw new Error('not a PNG file')
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

export function readPngImageData(buffer) {
    if (buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) throw new Error('not a PNG file')

    const { width, height } = readPngDimensions(buffer)
    const bitDepth = buffer.readUInt8(24)
    const colorType = buffer.readUInt8(25)
    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
    if (bitDepth !== 8 || bytesPerPixel === 0) {
        throw new Error(`unsupported PNG format bitDepth=${bitDepth} colorType=${colorType}`)
    }

    const chunks = []
    let offset = 8
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset)
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
        const dataStart = offset + 8
        const dataEnd = dataStart + length
        if (type === 'IDAT') chunks.push(buffer.subarray(dataStart, dataEnd))
        offset = dataEnd + 4
        if (type === 'IEND') break
    }

    const inflated = inflateSync(Buffer.concat(chunks))
    const rowBytes = width * bytesPerPixel
    const pixels = Buffer.alloc(rowBytes * height)
    let sourceOffset = 0

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[sourceOffset]
        sourceOffset += 1
        const rowOffset = y * rowBytes
        for (let x = 0; x < rowBytes; x += 1) {
            const raw = inflated[sourceOffset + x]
            const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0
            const up = y > 0 ? pixels[rowOffset - rowBytes + x] : 0
            const upLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset - rowBytes + x - bytesPerPixel] : 0
            let value = raw
            if (filter === 1) value = raw + left
            if (filter === 2) value = raw + up
            if (filter === 3) value = raw + Math.floor((left + up) / 2)
            if (filter === 4) {
                const predictor = left + up - upLeft
                const leftDistance = Math.abs(predictor - left)
                const upDistance = Math.abs(predictor - up)
                const diagonalDistance = Math.abs(predictor - upLeft)
                value =
                    raw +
                    (leftDistance <= upDistance && leftDistance <= diagonalDistance ? left : upDistance <= diagonalDistance ? up : upLeft)
            }
            pixels[rowOffset + x] = value & 0xff
        }
        sourceOffset += rowBytes
    }

    return pixels
}

export function measurePngDifferenceRatio(baseline, current, channelDelta = 8) {
    const baselineDimensions = readPngDimensions(baseline)
    const currentDimensions = readPngDimensions(current)
    if (baselineDimensions.width !== currentDimensions.width || baselineDimensions.height !== currentDimensions.height) return 1

    const baselinePixels = readPngImageData(baseline)
    const currentPixels = readPngImageData(current)
    if (baselinePixels.length !== currentPixels.length) return 1

    let changedChannels = 0
    for (let index = 0; index < baselinePixels.length; index += 1) {
        if (Math.abs(baselinePixels[index] - currentPixels[index]) > channelDelta) changedChannels += 1
    }
    return changedChannels / baselinePixels.length
}
