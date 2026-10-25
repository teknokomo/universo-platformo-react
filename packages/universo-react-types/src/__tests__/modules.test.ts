import { describe, expect, it } from 'vitest'

import { DEFAULT_MODULE_SDK_API_VERSION, isSupportedModuleSdkApiVersion, normalizeModulePackageImports } from '../common/modules'

describe('module contracts', () => {
    it('supports only the pre-1.0 alpha SDK API contract', () => {
        expect(DEFAULT_MODULE_SDK_API_VERSION).toBe('0.1.0')
        expect(isSupportedModuleSdkApiVersion('0.1.0')).toBe(true)
        expect(isSupportedModuleSdkApiVersion('1.0.0')).toBe(false)
    })

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
