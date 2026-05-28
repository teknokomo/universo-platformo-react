import { describe, expect, it } from 'vitest'

import { normalizeModulePackageImports } from '../common/modules'

describe('module contracts', () => {
    it('normalizes package imports for compiled manifests', () => {
        expect(
            normalizeModulePackageImports([
                { packageName: ' @universo-react/playcanvas-engine ', version: ' 0.1.0 ', targets: ['client', 'client', 'server'] },
                { packageName: '@universo-react/playcanvas-engine', version: '0.1.0', targets: ['client'] },
                { packageName: '@universo-react/ignored', version: '', targets: ['client'] },
                { packageName: '@universo-react/ignored-2', version: '0.1.0', targets: ['worker'] }
            ])
        ).toEqual([
            {
                packageName: '@universo-react/playcanvas-engine',
                version: '0.1.0',
                targets: ['client', 'server']
            }
        ])
    })
})
