import assert from 'node:assert/strict'
import test from 'node:test'
import { collectMmoommEntityMetadataEvidence } from './mmoommShareDbEntityMetadata.ts'

test('compares saved entity metadata with the linked visual material asset', () => {
    const visualMaterial = { role: 'core', materialAssetId: 42 }
    const evidence = collectMmoommEntityMetadataEvidence(
        [
            {
                name: 'Linkup Lab 01 ship Core',
                components: { render: { materialAssets: [42] } },
                metadata: { mmoomm: { visualMaterial } }
            },
            {
                name: 'Linkup Lab 01 ship Glow',
                components: { render: { materialAssets: ['43'] } }
            }
        ],
        [
            { id: '42', metadata: { mmoomm: { visualMaterial } } },
            { id: '43', metadata: { mmoomm: { visualMaterial: { role: 'glow' } } } }
        ]
    )

    assert.deepEqual(evidence, [
        {
            entityName: 'Linkup Lab 01 ship Core',
            materialId: '42',
            expectedVisualMaterial: visualMaterial,
            actualVisualMaterial: visualMaterial
        },
        {
            entityName: 'Linkup Lab 01 ship Glow',
            materialId: '43',
            expectedVisualMaterial: { role: 'glow' },
            actualVisualMaterial: undefined
        }
    ])
    assert.deepEqual(evidence[0]?.actualVisualMaterial, evidence[0]?.expectedVisualMaterial)
    assert.equal(evidence[1]?.actualVisualMaterial, undefined)
})
