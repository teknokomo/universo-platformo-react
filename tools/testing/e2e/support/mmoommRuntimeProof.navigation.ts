import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { expectRuntimeNavigationIconSemantics } from './browser/runtimeUx'

export const MMOOMM_RUNTIME_EXPECT_TIMEOUT = 60_000
export const MMOOMM_RECONNECT_TIMEOUT = 45_000
export const MMOOMM_WELCOME_BUTTON_NAME = /^(Welcome|Добро пожаловать)$/i
export const MMOOMM_OVERVIEW_TITLE_BY_LOCALE = {
    en: 'Welcome to Universo MMOOMM',
    ru: 'Добро пожаловать во Вселенную MMOOMM'
} as const
export const MMOOMM_WELCOME_PAGE_BLOCK_TEXT_BY_LOCALE = {
    en: 'Welcome to Universo MMOOMM',
    ru: 'Добро пожаловать'
} as const
export const MMOOMM_REALTIME_CONNECTED_STATUS_TEXT = {
    en: { connected: 'Realtime connected', restored: 'Realtime restored' },
    ru: { connected: 'Подключено', restored: 'Соединение восстановлено' }
} as const
export const MMOOMM_VISUAL_LAB_STATUS_TEXT = {
    en: 'Static visual lab',
    ru: 'Статическая визуальная лаборатория'
} as const
export const MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME = /^(Visual Linkup Lab|Визуальная лаборатория)$/i
export const MMOOMM_APPLICATION_NAVIGATION_NAME = /^(Application navigation|Навигация приложения)$/i
export const MMOOMM_MOVE_TO_TARGET_BUTTON_NAME = /^(Move to target|Лететь к цели)$/i
export const MMOOMM_STOP_BUTTON_NAME = /^(Stop|Остановить)$/i
export const MMOOMM_RESET_CAMERA_BUTTON_NAME = /^(Reset camera|Сбросить камеру)$/i
export const MMOOMM_ZOOM_IN_BUTTON_NAME = /^(Zoom in|Приблизить)$/i
export const MMOOMM_ZOOM_OUT_BUTTON_NAME = /^(Zoom out|Отдалить)$/i
export const MMOOMM_ROTATE_LEFT_BUTTON_NAME = /^(Rotate left|Повернуть влево)$/i
export const MMOOMM_ROTATE_RIGHT_BUTTON_NAME = /^(Rotate right|Повернуть вправо)$/i
export const MMOOMM_CANVAS_LABEL = /^(Interactive 3D flight scene|Интерактивная 3D-сцена полёта)$/i
export const MMOOMM_RUNTIME_FORBIDDEN_VISIBLE_TEXT = [
    /\b(?:roomId|playerId|sessionId|projectId|sceneId|shipId|clientBundle|sourceCode|serverBundle|moduleRole|attachedToId)\b/i,
    /\b(?:matchmake|joinOrCreate|fixed_tick_scene|colyseus|websocket|schemaType)\b/i
]
export const getMmoommNavigationItem = (page: Page, name: string | RegExp): Locator =>
    page.getByRole('link', { name }).or(page.getByRole('button', { name }))

export const getMmoommNavigation = (page: Page): Locator => page.getByRole('navigation', { name: MMOOMM_APPLICATION_NAVIGATION_NAME })

export const expectMmoommOverviewTitle = async (page: Page, locale: 'en' | 'ru', label: string) => {
    const title = page.getByRole('heading', { name: MMOOMM_OVERVIEW_TITLE_BY_LOCALE[locale], exact: true })
    await expect(title, `${label} must show the ${locale} Dashboard overview title`).toHaveCount(1)
    await expect(title, `${label} Dashboard overview title must be visible`).toBeVisible()
}

export const expectMmoommGeneratedNavigation = async (page: Page, locale: 'en' | 'ru', label: string) => {
    const navigation = getMmoommNavigation(page)
    const labels =
        locale === 'ru'
            ? { welcome: 'Добро пожаловать', space: 'Космос', visualLab: 'Визуальная лаборатория' }
            : { welcome: 'Welcome', space: 'Space', visualLab: 'Visual Linkup Lab' }
    await expect(navigation, `${label} must expose exactly one application navigation`).toHaveCount(1)
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole('link'), `${label} must render only the authored Page and primary Objects`).toHaveCount(3)

    for (const name of [labels.welcome, labels.space, labels.visualLab]) {
        const link = navigation.getByRole('link', { name, exact: true })
        await expect(link, `${label} must render one ${name} link`).toHaveCount(1)
        await expect(link).toBeVisible()
    }
    await expectRuntimeNavigationIconSemantics(navigation, [
        { label: labels.welcome, family: 'home' },
        { label: labels.space, family: 'apps' },
        { label: labels.visualLab, family: 'analytics' }
    ])

    for (const name of ['Flight Ship', 'Flight Station']) {
        await expect(
            navigation.getByRole('link', { name: new RegExp(name, 'i') }),
            `${label} must not expose ordinary Object ${name}`
        ).toHaveCount(0)
    }
}

export const openMmoommSpaceSection = async (page: Page) => {
    const existingSpaceRuntimeStatus = page.getByTestId('playcanvas-realtime-status')
    if (await existingSpaceRuntimeStatus.isVisible().catch(() => false)) {
        return
    }
    const spaceButton = getMmoommNavigationItem(page, /^(Space|Космос)$/)
    const initialShellTimeout = Math.min(30_000, MMOOMM_RUNTIME_EXPECT_TIMEOUT)

    for (const [attempt, timeout] of [initialShellTimeout, MMOOMM_RUNTIME_EXPECT_TIMEOUT].entries()) {
        try {
            await expect(spaceButton, 'Generated navigation must contain exactly one Space Object link').toHaveCount(1)
            await expect(spaceButton).toBeVisible({ timeout })
            await spaceButton.click()
            return
        } catch (error) {
            if (attempt === 1) {
                throw error
            }

            const pathname = new URL(page.url()).pathname
            if (!/^\/a\/[^/]+$/.test(pathname)) {
                throw error
            }

            // A cold lazy-loaded app shell can remain on its loading fallback when the
            // browser is under the same CPU pressure as the local E2E stack. Restart
            // the bounded navigation once, while keeping the actual runtime/RBAC
            // assertions below unchanged.
            await page.reload({ waitUntil: 'domcontentloaded', timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
        }
    }
}

export const openMmoommVisualLinkupLabSection = async (page: Page) => {
    const labButton = getMmoommNavigationItem(page, MMOOMM_VISUAL_LINKUP_LAB_BUTTON_NAME)
    await expect(labButton, 'Generated navigation must contain exactly one Visual Linkup Lab Object link').toHaveCount(1)
    await expect(labButton).toBeVisible({ timeout: MMOOMM_RUNTIME_EXPECT_TIMEOUT })
    await labButton.click()
}
