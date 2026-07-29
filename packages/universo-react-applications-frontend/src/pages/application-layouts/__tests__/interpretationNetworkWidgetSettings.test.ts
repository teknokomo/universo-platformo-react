import { describe, expect, it } from 'vitest'

import {
    areInterpretationNetworkMatrixSettingsEqual,
    mergeInterpretationNetworkMatrixSettings,
    normalizeInterpretationNetworkMatrixSettingsForSave,
    parseInterpretationNetworkMatrixSettings
} from '../interpretationNetworkWidgetSettings'

describe('interpretationNetworkWidgetSettings', () => {
    it('parses malformed settings through product defaults', () => {
        expect(
            parseInterpretationNetworkMatrixSettings({
                structureMode: 'unsupported',
                matrixMode: 'unsupported',
                allowedMatrixViews: ['unsupported'],
                defaultMatrixView: 'unsupported',
                positionNumbering: { enabled: 'yes', includeRoot: null, startIndex: -1 }
            })
        ).toEqual(
            expect.objectContaining({
                structureMode: 'multiple',
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table'],
                defaultMatrixView: 'table',
                positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
                splitPane: { enabled: true },
                templatePanel: { showInStructureList: true, showInMatrix: true }
            })
        )
    })

    it('normalizes view compatibility before saving', () => {
        const parsed = parseInterpretationNetworkMatrixSettings({
            matrixMode: 'independentRows',
            allowedMatrixViews: ['verticalTree'],
            defaultMatrixView: 'verticalTree'
        })

        expect(normalizeInterpretationNetworkMatrixSettingsForSave(parsed)).toEqual(
            expect.objectContaining({
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes'
            })
        )
    })

    it('merges typed settings without discarding unrelated widget configuration', () => {
        const settings = parseInterpretationNetworkMatrixSettings({
            structureMode: 'singleSystem',
            templatePanel: { showInStructureList: false, showInMatrix: true }
        })

        expect(mergeInterpretationNetworkMatrixSettings({ conceptCodename: 'Structure', customFlag: true }, settings)).toEqual(
            expect.objectContaining({
                conceptCodename: 'Structure',
                customFlag: true,
                structureMode: 'singleSystem',
                templatePanel: { showInStructureList: false, showInMatrix: true }
            })
        )
    })

    it('compares every persisted Matrix setting', () => {
        const baseline = parseInterpretationNetworkMatrixSettings({})

        expect(areInterpretationNetworkMatrixSettingsEqual(baseline, { ...baseline })).toBe(true)
        expect(
            areInterpretationNetworkMatrixSettingsEqual(baseline, {
                ...baseline,
                templatePanel: { ...baseline.templatePanel, showInMatrix: false }
            })
        ).toBe(false)
    })
})
