export type MmoommEntityMetadataEvidence = {
    entityName: string
    materialId: string
    expectedVisualMaterial: Record<string, unknown>
    actualVisualMaterial: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const collectMmoommEntityMetadataEvidence = (entities: readonly unknown[], assets: readonly unknown[]) => {
    const visualMaterialsByAssetId = new Map<string, Record<string, unknown>>()
    for (const candidate of assets) {
        if (!isRecord(candidate) || (typeof candidate.id !== 'string' && typeof candidate.id !== 'number')) continue
        const metadata = isRecord(candidate.metadata) ? candidate.metadata : null
        const mmoomm = metadata && isRecord(metadata.mmoomm) ? metadata.mmoomm : null
        const visualMaterial = mmoomm && isRecord(mmoomm.visualMaterial) ? mmoomm.visualMaterial : null
        if (visualMaterial) visualMaterialsByAssetId.set(String(candidate.id), visualMaterial)
    }

    const evidence: MmoommEntityMetadataEvidence[] = []
    for (const candidate of entities) {
        if (!isRecord(candidate) || typeof candidate.name !== 'string') continue
        const components = isRecord(candidate.components) ? candidate.components : null
        const render = components && isRecord(components.render) ? components.render : null
        const materialIds = Array.isArray(render?.materialAssets) ? render.materialAssets : []
        for (const materialId of materialIds) {
            if (typeof materialId !== 'string' && typeof materialId !== 'number') continue
            const expectedVisualMaterial = visualMaterialsByAssetId.get(String(materialId))
            if (!expectedVisualMaterial) continue
            const metadata = isRecord(candidate.metadata) ? candidate.metadata : null
            const mmoomm = metadata && isRecord(metadata.mmoomm) ? metadata.mmoomm : null
            evidence.push({
                entityName: candidate.name,
                materialId: String(materialId),
                expectedVisualMaterial,
                actualVisualMaterial: mmoomm?.visualMaterial
            })
        }
    }
    return evidence
}
