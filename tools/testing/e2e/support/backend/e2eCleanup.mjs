import fs from 'fs/promises'
import {
    createApiContext,
    deleteApplication,
    deleteLocale,
    deleteMetahub,
    deletePublication,
    deleteRole,
    deleteSupabaseAuthUser,
    disposeApiContext,
    listApplications,
    listMetahubs,
    login,
    revokeGlobalAccess
} from './api-session.mjs'
import { loadE2eEnvironment, storageStatePath } from '../env/load-e2e-env.mjs'
import { readRunManifest, recordCleanupStatus, removeRunManifest } from './run-manifest.mjs'

const removeFileIfExists = async (filePath) => {
    try {
        await fs.unlink(filePath)
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
            throw error
        }
    }
}

export async function cleanupE2eRun({ quiet = false } = {}) {
    loadE2eEnvironment()

    const manifest = await readRunManifest()
    if (!manifest) {
        await removeFileIfExists(storageStatePath)
        return {
            success: true,
            runId: null,
            failures: []
        }
    }

    const cleanupReport = {
        success: false,
        runId: manifest.runId ?? null,
        attemptedAt: new Date().toISOString(),
        deletedApplicationIds: [],
        deletedPublicationIds: [],
        deletedMetahubIds: [],
        deletedRoleIds: [],
        deletedLocaleIds: [],
        revokedGlobalAccessUserIds: [],
        deletedAuthUserIds: [],
        failures: []
    }

    const bootstrapEmail = process.env.BOOTSTRAP_SUPERUSER_EMAIL
    const bootstrapPassword = process.env.BOOTSTRAP_SUPERUSER_PASSWORD

    if (!bootstrapEmail || !bootstrapPassword) {
        cleanupReport.failures.push({
            phase: 'bootstrap',
            resourceType: 'environment',
            resourceId: manifest.runId ?? 'unknown-run',
            message: 'BOOTSTRAP_SUPERUSER_EMAIL and BOOTSTRAP_SUPERUSER_PASSWORD are required for e2e cleanup'
        })
        await recordCleanupStatus({
            status: 'failed',
            ...cleanupReport
        })
        throw new Error(cleanupReport.failures[0].message)
    }

    let api = null
    let fatalError = null

    try {
        api = await createApiContext()
        await login(api, { email: bootstrapEmail, password: bootstrapPassword })

        const explicitApplications = Array.isArray(manifest.createdApplications) ? manifest.createdApplications : []
        const applicationIds = new Set(explicitApplications.map((item) => item.id).filter(Boolean))

        const searchedApps = await listApplications(api, {
            limit: 200,
            offset: 0,
            search: manifest.runId
        })

        for (const item of searchedApps.items ?? []) {
            if (item?.id) {
                applicationIds.add(item.id)
            }
        }

        for (const applicationId of applicationIds) {
            try {
                await deleteApplication(api, applicationId)
                cleanupReport.deletedApplicationIds.push(applicationId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'application-delete',
                    resourceType: 'application',
                    resourceId: applicationId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        const explicitPublications = Array.isArray(manifest.createdPublications) ? manifest.createdPublications : []
        for (const publication of explicitPublications) {
            if (!publication?.id || !publication?.metahubId) {
                continue
            }

            try {
                await deletePublication(api, publication.metahubId, publication.id)
                cleanupReport.deletedPublicationIds.push(publication.id)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'publication-delete',
                    resourceType: 'publication',
                    resourceId: publication.id,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        const explicitMetahubs = Array.isArray(manifest.createdMetahubs) ? manifest.createdMetahubs : []
        const metahubIds = new Set(explicitMetahubs.map((item) => item.id).filter(Boolean))

        const searched = await listMetahubs(api, {
            limit: 200,
            offset: 0,
            search: manifest.runId
        })

        for (const item of searched.items ?? []) {
            if (item?.id) {
                metahubIds.add(item.id)
            }
        }

        for (const metahubId of metahubIds) {
            try {
                await deleteMetahub(api, metahubId)
                cleanupReport.deletedMetahubIds.push(metahubId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'metahub-delete',
                    resourceType: 'metahub',
                    resourceId: metahubId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        const explicitLocales = Array.isArray(manifest.createdLocales) ? manifest.createdLocales : []
        for (const locale of explicitLocales) {
            if (!locale?.id) {
                continue
            }

            try {
                await deleteLocale(api, locale.id)
                cleanupReport.deletedLocaleIds.push(locale.id)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'locale-delete',
                    resourceType: 'locale',
                    resourceId: locale.id,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        const explicitUsers = Array.isArray(manifest.createdGlobalUsers) ? manifest.createdGlobalUsers : []
        for (const user of explicitUsers) {
            if (!user?.userId) {
                continue
            }

            try {
                await revokeGlobalAccess(api, user.userId)
                cleanupReport.revokedGlobalAccessUserIds.push(user.userId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'global-access-revoke',
                    resourceType: 'global-user',
                    resourceId: user.userId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }

            try {
                await deleteSupabaseAuthUser(user.userId)
                cleanupReport.deletedAuthUserIds.push(user.userId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'auth-user-delete',
                    resourceType: 'auth-user',
                    resourceId: user.userId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        const explicitRoles = Array.isArray(manifest.createdRoles) ? manifest.createdRoles : []
        for (const role of explicitRoles) {
            if (!role?.id) {
                continue
            }

            try {
                await deleteRole(api, role.id)
                cleanupReport.deletedRoleIds.push(role.id)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'role-delete',
                    resourceType: 'role',
                    resourceId: role.id,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        if (manifest.testUser?.userId) {
            try {
                await revokeGlobalAccess(api, manifest.testUser.userId)
                cleanupReport.revokedGlobalAccessUserIds.push(manifest.testUser.userId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'global-access-revoke',
                    resourceType: 'global-user',
                    resourceId: manifest.testUser.userId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }

            try {
                await deleteSupabaseAuthUser(manifest.testUser.userId)
                cleanupReport.deletedAuthUserIds.push(manifest.testUser.userId)
            } catch (error) {
                cleanupReport.failures.push({
                    phase: 'auth-user-delete',
                    resourceType: 'auth-user',
                    resourceId: manifest.testUser.userId,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }
    } catch (error) {
        fatalError = error
        cleanupReport.failures.push({
            phase: 'cleanup-session',
            resourceType: 'run',
            resourceId: manifest.runId ?? 'unknown-run',
            message: error instanceof Error ? error.message : String(error)
        })
    } finally {
        if (api) {
            await disposeApiContext(api)
        }
        await removeFileIfExists(storageStatePath)
    }

    if (cleanupReport.failures.length > 0) {
        const unresolvedMetahubs = (Array.isArray(manifest.createdMetahubs) ? manifest.createdMetahubs : []).filter(
            (item) => item?.id && !cleanupReport.deletedMetahubIds.includes(item.id)
        )

        await recordCleanupStatus({
            status: 'failed',
            ...cleanupReport
        })

        await recordCleanupStatus({
            unresolvedMetahubs,
            unresolvedTestUserId:
                manifest.testUser?.userId && !cleanupReport.deletedAuthUserIds.includes(manifest.testUser.userId)
                    ? manifest.testUser.userId
                    : null
        })

        const summary = cleanupReport.failures.map((failure) => `${failure.phase}:${failure.resourceType}:${failure.resourceId}`).join(', ')

        if (!quiet) {
            console.warn(`[e2e-cleanup] Incomplete cleanup for ${manifest.runId}: ${summary}`)
        }

        const cleanupError = new Error(`E2E cleanup incomplete for ${manifest.runId}: ${summary}`)
        cleanupError.cause = fatalError ?? undefined
        cleanupError.report = cleanupReport
        throw cleanupError
    }

    await removeRunManifest()

    return {
        ...cleanupReport,
        success: true,
        failures: []
    }
}
