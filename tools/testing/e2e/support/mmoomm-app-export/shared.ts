import type { Locator, Page, Response } from '@playwright/test'
import type { PlayCanvasRuntimeManifest } from '@universo-react/types'
import { expect } from '../../fixtures/test'
import { createLoggedInApiContext, listEntityInstances, listPlayCanvasProjects, sendWithCsrf } from '../backend/api-session.mjs'
import { fetchPlayCanvasEditorCompatibilityConfig } from '../playcanvasEditorAuthoring'

export type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

export type ApiSessionLike = Pick<ApiContext, 'baseURL' | 'cookies'>

export type CreatedEntityResponse = { id?: string; data?: { id?: string } }

export type MetahubSummary = { id?: string; name?: unknown; codename?: unknown }

type ProjectInstanceSummary = { id?: string; name?: unknown; codename?: unknown; config?: Record<string, unknown> | null }

type PlayCanvasProjectSummary = { id?: string; displayName?: unknown; codename?: unknown }

export type PublishedRuntimeManifestSummary = {
    projectId?: string
    sceneId?: string | null
    checksum?: string
    runtimeManifest?: PlayCanvasRuntimeManifest
}

export type TargetedPublishedRuntimeManifestSummary = PlayCanvasRuntimeManifest & { projectName: string }

export type PlayCanvasWidgetRuntimeOptions = {
    layoutId: string
    runtimeManifest: TargetedPublishedRuntimeManifestSummary
    title: { en: string; ru: string }
    clientModuleName?: string
    realtimeServerModuleName?: string
}

export type BrowserCreatedApplicationResponse = {
    id?: string
    connector?: { id?: string }
    application?: { id?: string }
    data?: { id?: string; connector?: { id?: string }; application?: { id?: string } }
}

export async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

export async function apiSend(api: ApiContext, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', urlPath: string, body?: unknown) {
    return sendWithCsrf(api, method, urlPath, body)
}

export const parseJsonResponse = async <T>(response: Response, label: string): Promise<T> => {
    const bodyText = await response.text()
    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }
    return JSON.parse(bodyText) as T
}

export const fillLocalizedInlineField = async (
    page: Page,
    root: Locator,
    label: string,
    value: { en: string; ru: string }
): Promise<void> => {
    const enRow = root.getByTestId('localized-inline-row-en').first()
    if ((await enRow.count()) > 0) {
        await enRow.getByLabel(label).fill(value.en)
        const ruRow = root.getByTestId('localized-inline-row-ru').first()
        if ((await ruRow.count()) === 0) {
            await enRow.getByTestId('localized-inline-badge-en').click()
            await page.getByRole('menuitem', { name: 'Add language' }).click()
            await page.getByRole('menuitem', { name: 'Русский' }).click()
        }
        await root.getByTestId('localized-inline-row-ru').first().getByLabel(label).fill(value.ru)
        return
    }

    await root.getByLabel(label).first().fill(value.en)
    await root.getByRole('button', { name: /^EN$/ }).click()
    await page.getByRole('menuitem', { name: 'Add language' }).click()
    await page.getByRole('menuitem', { name: 'Русский' }).click()
    const ruRow = root.getByTestId('localized-inline-row-ru').first()
    if ((await ruRow.count()) === 0) {
        throw new Error(`Localized field ${label} did not expose a Russian row after adding the locale`)
    }
    await ruRow.getByLabel(label).fill(value.ru)
}

export const readLocalizedContent = (value: unknown, locale: 'en' | 'ru' = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = record._primary ?? locale
    const content = record.locales?.[locale]?.content ?? record.locales?.[primary]?.content
    return typeof content === 'string' ? content.trim() : ''
}

export const readCodenameText = (value: unknown): string => readLocalizedContent(value, 'en')

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const projectInstanceCodenameForName = (projectName: string): string => projectName.replace(/\s+/g, '')

export const publishedManifestSelectValuePrefix = (manifest: PublishedRuntimeManifestSummary): string =>
    manifest.projectId ? `${manifest.projectId}:${manifest.sceneId ?? ''}:` : ''

export const requireProjectInstanceByName = async (
    api: ApiSessionLike,
    metahubId: string,
    projectName: string
): Promise<ProjectInstanceSummary> => {
    const projectInstances = (await listEntityInstances(api, metahubId, { kind: 'project', limit: 100, offset: 0 })) as {
        items?: ProjectInstanceSummary[]
    }
    const expectedCodename = projectInstanceCodenameForName(projectName)
    const target = projectInstances.items?.find(
        (item) => readLocalizedContent(item.name, 'en') === projectName || readCodenameText(item.codename) === expectedCodename
    )
    if (!target?.id) {
        throw new Error(`MMOOMM project instance ${projectName} was not found in the Projects section`)
    }
    return target
}

export const requirePlayCanvasProjectByName = async (
    api: ApiSessionLike,
    metahubId: string,
    projectName: string
): Promise<PlayCanvasProjectSummary> => {
    const projectsPayload = (await listPlayCanvasProjects(api, metahubId)) as { items?: PlayCanvasProjectSummary[] }
    const target = projectsPayload.items?.find((item) => readLocalizedContent(item.displayName, 'en') === projectName)
    if (!target?.id) {
        throw new Error(`MMOOMM generator did not receive a PlayCanvas project id for ${projectName}`)
    }
    return target
}

export const requirePublishedManifestForProject = (
    manifests: PublishedRuntimeManifestSummary[] | undefined,
    projectId: string,
    label: string
): PlayCanvasRuntimeManifest => {
    const manifest = manifests?.find((item) => item.projectId === projectId && /^[a-f0-9]{64}$/i.test(String(item.checksum ?? '')))
    if (!manifest?.runtimeManifest) {
        throw new Error(`MMOOMM generator did not receive a published runtime manifest for ${label}`)
    }
    return manifest.runtimeManifest
}

export const expectFullscreenEditorProject = async (page: Page, metahubId: string, projectId: string, label: string): Promise<void> => {
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId)
    expect(compatibilityConfig.projectId, `${label} compatibility config must target the requested PlayCanvas project`).toBe(projectId)
}

export const setLayoutSwitchThroughBrowser = async (container: Page | Locator, label: string, checked: boolean) => {
    const control = container.getByRole('switch', { name: label, exact: true })
    await expect(control).toBeVisible()
    const current = await control.isChecked()
    if (current !== checked) {
        await control.click()
        await expect(control).toBeChecked({ checked })
    }
}
