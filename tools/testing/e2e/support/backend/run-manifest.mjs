import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { loadE2eEnvironment, manifestPath } from '../env/load-e2e-env.mjs'

let manifestWriteQueue = Promise.resolve()

const enqueueManifestOperation = (operation) => {
    const next = manifestWriteQueue.then(operation, operation)
    manifestWriteQueue = next.catch(() => undefined)
    return next
}

const readRunManifestUnlocked = async () => {
    try {
        const raw = await fs.readFile(manifestPath, 'utf8')
        return JSON.parse(raw)
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return null
        }

        throw error
    }
}

const writeRunManifestUnlocked = async (manifest) => {
    const temporaryPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`
    await fs.writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8')
    await fs.rename(temporaryPath, manifestPath)
    return manifest
}

export async function readRunManifest() {
    loadE2eEnvironment()
    return readRunManifestUnlocked()
}

export async function writeRunManifest(manifest) {
    loadE2eEnvironment()
    return enqueueManifestOperation(() => writeRunManifestUnlocked(manifest))
}

export async function updateRunManifest(updater) {
    loadE2eEnvironment()
    return enqueueManifestOperation(async () => {
        const currentManifest = await readRunManifestUnlocked()
        if (!currentManifest) {
            throw new Error('E2E run manifest does not exist')
        }

        const nextManifest = await updater(currentManifest)
        return writeRunManifestUnlocked(nextManifest)
    })
}

export async function removeRunManifest() {
    loadE2eEnvironment()

    return enqueueManifestOperation(async () => {
        try {
            await fs.unlink(manifestPath)
        } catch (error) {
            if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
                throw error
            }
        }
    })
}

export async function recordCreatedMetahub(resource) {
    return updateRunManifest((manifest) => {
        const existingResources = Array.isArray(manifest.createdMetahubs) ? manifest.createdMetahubs : []
        const hasExisting = existingResources.some((item) => item.id === resource.id || item.codename === resource.codename)

        return {
            ...manifest,
            createdMetahubs: hasExisting ? existingResources : [...existingResources, resource]
        }
    })
}

const appendUniqueResource = (manifest, key, resource, identityKeys = ['id']) => {
    const existingResources = Array.isArray(manifest[key]) ? manifest[key] : []
    const hasExisting = existingResources.some((item) =>
        identityKeys.some((identityKey) => {
            if (!resource?.[identityKey] || !item?.[identityKey]) {
                return false
            }

            return item[identityKey] === resource[identityKey]
        })
    )

    return {
        ...manifest,
        [key]: hasExisting ? existingResources : [...existingResources, resource]
    }
}

export async function recordCreatedGlobalUser(resource) {
    return updateRunManifest((manifest) => appendUniqueResource(manifest, 'createdGlobalUsers', resource, ['userId', 'email']))
}

export async function recordCreatedRole(resource) {
    return updateRunManifest((manifest) => appendUniqueResource(manifest, 'createdRoles', resource, ['id', 'codename']))
}

export async function recordCreatedLocale(resource) {
    return updateRunManifest((manifest) => appendUniqueResource(manifest, 'createdLocales', resource, ['id', 'code']))
}

export async function recordCreatedApplication(resource) {
    return updateRunManifest((manifest) => appendUniqueResource(manifest, 'createdApplications', resource, ['id', 'slug']))
}

export async function recordCreatedPublication(resource) {
    return updateRunManifest((manifest) => appendUniqueResource(manifest, 'createdPublications', resource, ['id', 'schemaName']))
}

export async function recordCleanupStatus(status) {
    return updateRunManifest((manifest) => ({
        ...manifest,
        cleanup: {
            ...(manifest.cleanup ?? {}),
            ...status
        }
    }))
}
