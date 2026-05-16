import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateSnapshotEnvelope } from '../snapshotArchive'

const FIXTURES_DIR = path.resolve(process.cwd(), '../../../tools/fixtures')

const SNAPSHOT_FIXTURES = ['metahubs-lms-app-snapshot.json', 'metahubs-quiz-app-snapshot.json', 'metahubs-self-hosted-app-snapshot.json']
const LMS_FIXTURE = 'metahubs-lms-app-snapshot.json'

type SnapshotEntity = {
    id: string
    codename?: unknown
}

type SnapshotRow = {
    data?: Record<string, unknown>
}

type SnapshotBundle = {
    snapshot?: {
        entities?: Record<string, SnapshotEntity>
        elements?: Record<string, SnapshotRow[]>
    }
}

const readLocalizedContent = (value: unknown, locale = 'en'): string | null => {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return null
    }

    const localized = value as {
        _primary?: string
        locales?: Record<string, { content?: unknown }>
    }
    const locales = localized.locales ?? {}
    const primary = localized._primary
    const content = locales[locale]?.content ?? (primary ? locales[primary]?.content : undefined) ?? Object.values(locales)[0]?.content

    return typeof content === 'string' ? content : null
}

const readFixture = (fixtureName: string): unknown => {
    const fixturePath = path.join(FIXTURES_DIR, fixtureName)
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown
}

const getRowsByObjectCodename = (fixture: SnapshotBundle, codename: string): SnapshotRow[] => {
    const entities = Object.values(fixture.snapshot?.entities ?? {})
    const entity = entities.find((candidate) => readLocalizedContent(candidate.codename) === codename)

    return entity ? fixture.snapshot?.elements?.[entity.id] ?? [] : []
}

const sumNumericField = (rows: SnapshotRow[], field: string): number =>
    rows.reduce((total, row) => total + (typeof row.data?.[field] === 'number' ? row.data[field] : 0), 0)

const countRowsWithFieldValue = (rows: SnapshotRow[], field: string, value: unknown): number =>
    rows.filter((row) => row.data?.[field] === value).length

const readReportCodename = (row: SnapshotRow): string | null => {
    const definition = row.data?.Definition

    if (!definition || typeof definition !== 'object') {
        return null
    }

    const codename = (definition as { codename?: unknown }).codename
    return typeof codename === 'string' ? codename : null
}

describe('committed metahub snapshot fixtures', () => {
    it.each(SNAPSHOT_FIXTURES)('keeps %s importable by the runtime validator', (fixtureName) => {
        const envelope = readFixture(fixtureName)

        const result = validateSnapshotEnvelope(envelope)

        expect(result.kind).toBe('metahub_snapshot_bundle')
        expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('keeps the committed LMS gamification and achievement rows deterministic', () => {
        const fixture = readFixture(LMS_FIXTURE) as SnapshotBundle
        const gamificationSettings = getRowsByObjectCodename(fixture, 'GamificationSettings')
        const pointAwardRules = getRowsByObjectCodename(fixture, 'PointAwardRules')
        const pointTransactions = getRowsByObjectCodename(fixture, 'PointTransactions')
        const badgeDefinitions = getRowsByObjectCodename(fixture, 'BadgeDefinitions')
        const badgeIssues = getRowsByObjectCodename(fixture, 'BadgeIssues')
        const leaderboardSnapshots = getRowsByObjectCodename(fixture, 'LeaderboardSnapshots')
        const reports = getRowsByObjectCodename(fixture, 'Reports')

        expect(gamificationSettings).toHaveLength(1)
        expect(pointAwardRules).toHaveLength(3)
        expect(pointTransactions).toHaveLength(3)
        expect(badgeDefinitions).toHaveLength(2)
        expect(badgeIssues).toHaveLength(2)
        expect(leaderboardSnapshots).toHaveLength(2)

        expect(gamificationSettings[0]?.data).toMatchObject({
            Enabled: true,
            LeaderboardPeriodDays: 30,
            Rules: {
                achievementsPage: {
                    showBadges: true,
                    showCertificates: true,
                    showRank: true
                },
                leaderboard: {
                    period: 'rolling_30_days',
                    tieBreaker: 'completed_at'
                }
            },
            Scope: 'application',
            WorkspaceKey: null
        })
        expect(pointAwardRules.map((row) => row.data?.RuleCode).sort()).toEqual([
            'assignment.accepted',
            'manual.adjustment',
            'module.completed'
        ])
        expect(sumNumericField(pointTransactions, 'PointsDelta')).toBe(50)
        expect(
            sumNumericField(
                pointTransactions.filter((row) => row.data?.Status === 'Approved'),
                'PointsDelta'
            )
        ).toBe(40)
        expect(countRowsWithFieldValue(badgeIssues, 'Status', 'Issued')).toBe(1)
        expect(sumNumericField(leaderboardSnapshots, 'TotalPoints')).toBe(50)
        expect(leaderboardSnapshots[0]?.data).toMatchObject({
            Rank: 1,
            Period: 'current',
            TotalPoints: 35,
            BadgeCount: 1
        })
        expect(reports.map(readReportCodename)).toEqual(
            expect.arrayContaining(['LearnerProgress', 'CourseProgress', 'Leaderboard', 'Achievements'])
        )
    })
})
