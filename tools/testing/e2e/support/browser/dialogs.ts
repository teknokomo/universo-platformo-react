import { expect, type Page } from '@playwright/test'

const DISCARD_DIALOG_NAME = /Discard unsaved changes\?|Отменить несохранённые изменения\?/
const DISCARD_CONFIRM_BUTTON_NAME = /^(Discard|Отменить изменения)$/

export async function confirmDiscardIfPrompted(page: Page, timeout = 2_000): Promise<boolean> {
    const discardDialog = page.getByRole('dialog', { name: DISCARD_DIALOG_NAME })

    const appeared = await discardDialog
        .waitFor({ state: 'attached', timeout })
        .then(() => true)
        .catch(() => false)

    if (!appeared) {
        return false
    }

    await discardDialog.getByRole('button', { name: DISCARD_CONFIRM_BUTTON_NAME }).click()
    await expect(discardDialog).toBeHidden()
    return true
}
