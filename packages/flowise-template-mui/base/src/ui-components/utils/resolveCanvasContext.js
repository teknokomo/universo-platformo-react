export function resolveCanvasContext(source = {}, options = {}) {
    const { requireCanvasId = true } = options

    const canvas = source.canvas ?? null

    const canvasId = source.canvasId ?? canvas?.id ?? null

    const spaceId = source.spaceId ?? canvas?.spaceId ?? canvas?.space_id ?? null

    const unikId = source.unikId ?? canvas?.unik_id ?? canvas?.unikId ?? null

    if (requireCanvasId && !canvasId) {
        throw new Error('[resolveCanvasContext] Missing canvasId in dialog props')
    }

    return { canvas, canvasId, spaceId, unikId }
}

export default resolveCanvasContext
