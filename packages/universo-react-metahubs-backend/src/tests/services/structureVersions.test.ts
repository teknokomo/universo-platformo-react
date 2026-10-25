import {
    CURRENT_STRUCTURE_VERSION,
    CURRENT_STRUCTURE_VERSION_SEMVER,
    getStructureVersion,
    structureVersionToSemver,
    semverToStructureVersion,
    normalizeStoredStructureVersion
} from '../../domains/metahubs/services/structureVersions'

describe('structureVersions registry', () => {
    it('exposes v1 as current structure revision', () => {
        expect(CURRENT_STRUCTURE_VERSION).toBe(1)
    })

    it('exposes current semver label', () => {
        expect(CURRENT_STRUCTURE_VERSION_SEMVER).toBe('0.1.0')
    })

    it('exposes ECAE and PlayCanvas tables in current structure version', () => {
        const current = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        expect(current.tables).toContain('_mhb_values')
        expect(current.tables).toContain('_mhb_constants')
        expect(current.tables).toContain('_mhb_entity_type_definitions')
        expect(current.tables).toContain('_mhb_actions')
        expect(current.tables).toContain('_mhb_event_bindings')
        expect(current.tables).toContain('_mhb_playcanvas_projects')
        expect(current.tables).toContain('_mhb_playcanvas_generated_artifacts')
        expect(current.tables).toContain('_mhb_playcanvas_sourcefiles')
    })

    it('allows missing generated artifact output checksum until the artifact file is written', () => {
        const current = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        const generatedArtifacts = current.definitions.find((table) => table.name === '_mhb_playcanvas_generated_artifacts')
        const outputChecksum = generatedArtifacts?.columns.find((column) => column.name === 'output_checksum')

        expect(outputChecksum).toMatchObject({ nullable: true })
    })

    it('throws for unknown numeric version', () => {
        expect(() => getStructureVersion(999)).toThrow('Unknown structure version: 999')
    })

    it('throws for version 0', () => {
        expect(() => getStructureVersion(0)).toThrow('Unknown structure version: 0')
    })

    it('returns a valid init function for the current version', () => {
        const spec = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        expect(typeof spec.init).toBe('function')
        expect(spec.definitions.length).toBeGreaterThan(0)
    })
})

describe('structureVersionToSemver', () => {
    it('converts current numeric version to semver', () => {
        expect(structureVersionToSemver(CURRENT_STRUCTURE_VERSION)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('rejects missing versions instead of assuming the current revision', () => {
        expect(() => structureVersionToSemver(null)).toThrow('Unsupported metahub structure version: null')
        expect(() => structureVersionToSemver(undefined)).toThrow('Unsupported metahub structure version: undefined')
    })

    it('rejects unregistered numeric revisions instead of clamping them to current', () => {
        expect(() => structureVersionToSemver(0)).toThrow('Unsupported metahub structure version: 0')
        expect(() => structureVersionToSemver(-1)).toThrow('Unsupported metahub structure version: -1')
        expect(() => structureVersionToSemver(999)).toThrow('Unsupported metahub structure version: 999')
    })

    it('accepts only the registered semver label', () => {
        expect(structureVersionToSemver(CURRENT_STRUCTURE_VERSION_SEMVER)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('rejects empty, numeric-string, and unregistered semver labels', () => {
        expect(() => structureVersionToSemver('')).toThrow('Unsupported metahub structure version')
        expect(() => structureVersionToSemver('1')).toThrow('Unsupported metahub structure version: 1')
        expect(() => structureVersionToSemver('99.0.0')).toThrow('Unsupported metahub structure version: 99.0.0')
        expect(() => structureVersionToSemver('invalid')).toThrow('Unsupported metahub structure version: invalid')
        expect(() => structureVersionToSemver('__proto__')).toThrow('Unsupported metahub structure version: __proto__')
        expect(() => structureVersionToSemver('constructor')).toThrow('Unsupported metahub structure version: constructor')
    })
})

describe('semverToStructureVersion', () => {
    it('converts current semver to numeric version', () => {
        expect(semverToStructureVersion(CURRENT_STRUCTURE_VERSION_SEMVER)).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('rejects missing versions instead of assuming the current revision', () => {
        expect(() => semverToStructureVersion(null)).toThrow('Unsupported metahub structure version: null')
        expect(() => semverToStructureVersion(undefined)).toThrow('Unsupported metahub structure version: undefined')
    })

    it('rejects empty version labels', () => {
        expect(() => semverToStructureVersion('')).toThrow('Unsupported metahub structure version')
    })

    it('rejects unsupported numeric revisions', () => {
        expect(() => semverToStructureVersion(0)).toThrow('Unsupported metahub structure version: 0')
        expect(() => semverToStructureVersion(999)).toThrow('Unsupported metahub structure version: 999')
    })

    it('passes through valid numeric version', () => {
        expect(semverToStructureVersion(1)).toBe(1)
    })

    it('rejects unregistered semver labels', () => {
        expect(() => semverToStructureVersion('99.0.0')).toThrow('Unsupported metahub structure version: 99.0.0')
        expect(() => semverToStructureVersion('__proto__')).toThrow('Unsupported metahub structure version: __proto__')
        expect(() => semverToStructureVersion('constructor')).toThrow('Unsupported metahub structure version: constructor')
    })

    it('rejects numeric-string aliases and invalid labels', () => {
        expect(() => semverToStructureVersion('1')).toThrow('Unsupported metahub structure version: 1')
        expect(() => semverToStructureVersion('invalid')).toThrow('Unsupported metahub structure version: invalid')
    })
})

describe('normalizeStoredStructureVersion', () => {
    it('normalizes current semver to itself', () => {
        expect(normalizeStoredStructureVersion(CURRENT_STRUCTURE_VERSION_SEMVER)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('converts the registered numeric revision to semver', () => {
        expect(normalizeStoredStructureVersion(1)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('rejects unsupported or malformed stored versions instead of normalizing them', () => {
        expect(() => normalizeStoredStructureVersion(null)).toThrow('Unsupported metahub structure version: null')
        expect(() => normalizeStoredStructureVersion(undefined)).toThrow('Unsupported metahub structure version: undefined')
        expect(() => normalizeStoredStructureVersion('')).toThrow('Unsupported metahub structure version')
        expect(() => normalizeStoredStructureVersion('1')).toThrow('Unsupported metahub structure version: 1')
        expect(() => normalizeStoredStructureVersion('99.0.0')).toThrow('Unsupported metahub structure version: 99.0.0')
        expect(() => normalizeStoredStructureVersion(999)).toThrow('Unsupported metahub structure version: 999')
    })

    it('round-trips: semver → numeric → semver', () => {
        const numeric = semverToStructureVersion(CURRENT_STRUCTURE_VERSION_SEMVER)
        const semver = structureVersionToSemver(numeric)
        expect(semver).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('round-trips: numeric → semver → numeric', () => {
        const semver = structureVersionToSemver(CURRENT_STRUCTURE_VERSION)
        const numeric = semverToStructureVersion(semver)
        expect(numeric).toBe(CURRENT_STRUCTURE_VERSION)
    })
})
