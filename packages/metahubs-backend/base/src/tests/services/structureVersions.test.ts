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

    it('exposes enumeration values table in current structure version', () => {
        const current = getStructureVersion(CURRENT_STRUCTURE_VERSION)
        expect(current.tables).toContain('_mhb_values')
        expect(current.tables).toContain('_mhb_constants')
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

    it('returns current semver for null', () => {
        expect(structureVersionToSemver(null)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('returns current semver for undefined', () => {
        expect(structureVersionToSemver(undefined)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('returns current semver for 0', () => {
        expect(structureVersionToSemver(0)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('returns current semver for negative number', () => {
        expect(structureVersionToSemver(-1)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('returns current semver for unknown positive integer', () => {
        expect(structureVersionToSemver(999)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('passes through valid semver string', () => {
        expect(structureVersionToSemver('0.1.0')).toBe('0.1.0')
    })

    it('returns current semver for empty string', () => {
        expect(structureVersionToSemver('')).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('converts numeric string to semver', () => {
        expect(structureVersionToSemver('1')).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('returns current semver for non-numeric string', () => {
        expect(structureVersionToSemver('invalid')).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })
})

describe('semverToStructureVersion', () => {
    it('converts current semver to numeric version', () => {
        expect(semverToStructureVersion(CURRENT_STRUCTURE_VERSION_SEMVER)).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('returns current version for null', () => {
        expect(semverToStructureVersion(null)).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('returns current version for undefined', () => {
        expect(semverToStructureVersion(undefined)).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('returns current version for empty string', () => {
        expect(semverToStructureVersion('')).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('returns current version for 0', () => {
        expect(semverToStructureVersion(0)).toBe(CURRENT_STRUCTURE_VERSION)
    })

    it('passes through valid numeric version', () => {
        expect(semverToStructureVersion(1)).toBe(1)
    })

    it('clamps future semver to CURRENT + 1', () => {
        expect(semverToStructureVersion('99.0.0')).toBe(CURRENT_STRUCTURE_VERSION + 1)
    })

    it('clamps future numeric version to CURRENT + 1', () => {
        expect(semverToStructureVersion(999)).toBe(CURRENT_STRUCTURE_VERSION + 1)
    })

    it('converts numeric string to version', () => {
        expect(semverToStructureVersion('1')).toBe(1)
    })

    it('returns current version for non-parseable string', () => {
        expect(semverToStructureVersion('invalid')).toBe(CURRENT_STRUCTURE_VERSION)
    })
})

describe('normalizeStoredStructureVersion', () => {
    it('normalizes current semver to itself', () => {
        expect(normalizeStoredStructureVersion(CURRENT_STRUCTURE_VERSION_SEMVER)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('normalizes numeric version to semver', () => {
        expect(normalizeStoredStructureVersion(1)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('normalizes null to current semver', () => {
        expect(normalizeStoredStructureVersion(null)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('normalizes undefined to current semver', () => {
        expect(normalizeStoredStructureVersion(undefined)).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('normalizes empty string to current semver', () => {
        expect(normalizeStoredStructureVersion('')).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
    })

    it('normalizes future semver to current', () => {
        expect(normalizeStoredStructureVersion('99.0.0')).toBe(CURRENT_STRUCTURE_VERSION_SEMVER)
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
