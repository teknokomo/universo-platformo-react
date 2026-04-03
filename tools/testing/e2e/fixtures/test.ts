import fs from 'fs/promises'
import { test as base, expect } from '@playwright/test'
import { loadE2eEnvironment, manifestPath } from '../support/env/load-e2e-env.mjs'

export type E2ERunManifest = {
    runId: string
    testUser: {
        email: string
        password: string
        userId: string
    }
    createdGlobalUsers?: Array<{
        userId: string
        email?: string
    }>
    createdRoles?: Array<{
        id: string
        codename?: string
    }>
    createdLocales?: Array<{
        id: string
        code?: string
    }>
    createdApplications?: Array<{
        id: string
        slug?: string
    }>
    createdPublications?: Array<{
        id: string
        metahubId?: string
        schemaName?: string
    }>
    createdMetahubs?: Array<{
        id: string
        name?: string
        codename?: string
    }>
}

const readManifest = async (): Promise<E2ERunManifest> => {
    loadE2eEnvironment()
    const raw = await fs.readFile(manifestPath, 'utf8')
    return JSON.parse(raw) as E2ERunManifest
}

export const test = base.extend<{ runManifest: E2ERunManifest }>({
    runManifest: async ({ browserName }, use) => {
        void browserName
        await use(await readManifest())
    }
})

export { expect }
