import { describe, expect, it } from 'vitest'
import { getCodenameConfigFromValues } from '../branchListUtils'

describe('branchListUtils', () => {
    it('falls back to the default codename config when form values are not initialized yet', () => {
        expect(getCodenameConfigFromValues(undefined)).toMatchObject({
            style: 'pascal-case',
            alphabet: 'en-ru',
            allowMixed: false
        })
        expect(getCodenameConfigFromValues(null)).toMatchObject({
            style: 'pascal-case',
            alphabet: 'en-ru',
            allowMixed: false
        })
    })

    it('uses the form-provided codename config when present', () => {
        expect(
            getCodenameConfigFromValues({
                _codenameConfig: {
                    style: 'snake-case',
                    alphabet: 'en',
                    allowMixed: true,
                    autoConvertMixedAlphabets: false,
                    autoReformat: false,
                    requireReformat: false
                }
            })
        ).toMatchObject({
            style: 'snake-case',
            alphabet: 'en',
            allowMixed: true
        })
    })
})
