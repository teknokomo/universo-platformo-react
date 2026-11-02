import type { TFunction } from 'i18next'
import { isHttpStatus, isOptimisticLockConflict } from '@universo-react/utils'
import { getApplicationBotBindingErrorCode } from '../../api/applicationBotBindings'

type Translate = TFunction<'applications'>

export const getMessengerBindingMutationError = (error: unknown, t: Translate): string => {
    if (isOptimisticLockConflict(error)) {
        return t('messenger.errors.conflict', 'This connection changed elsewhere. Reload it and try again.')
    }
    const code = getApplicationBotBindingErrorCode(error)
    if (code === 'APPLICATION_BOT_BINDING_DUPLICATE' || isHttpStatus(error, 409)) {
        return t('messenger.errors.duplicate', 'This bot is already connected to the application.')
    }
    if (code === 'APPLICATION_BOT_BINDING_USERNAME_INVALID') {
        return t('messenger.errors.username', 'Enter a valid bot username for the selected platform.')
    }
    return t('messenger.errors.save', 'The connection could not be saved. Try again.')
}

const fallbackCopy = async (value: string): Promise<void> => {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('CLIPBOARD_UNAVAILABLE')
}

export const copyMessengerBindingText = async (value: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        return
    }
    await fallbackCopy(value)
}
