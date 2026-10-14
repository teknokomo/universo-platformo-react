import type { Locator, Page, Request } from '@playwright/test'

export type GuestQuizAnswerRequestTracker = {
    getCount: () => number
    stop: () => void
}

/** Uses radio-group keys to select a guest quiz option without submitting it. */
export async function navigateGuestQuizOptionWithKeyboard(page: Page, targetOption: Locator): Promise<GuestQuizAnswerRequestTracker> {
    let answerRequestCount = 0
    let stopped = false
    const trackAnswerRequest = (request: Request) => {
        const url = new URL(request.url())
        if (request.method() === 'PUT' && url.pathname.includes('/runtime/attempts/') && url.pathname.endsWith('/answers')) {
            answerRequestCount += 1
        }
    }
    const stop = () => {
        if (stopped) return
        stopped = true
        page.off('request', trackAnswerRequest)
    }
    page.on('request', trackAnswerRequest)

    try {
        await page.keyboard.press('Tab')
        const radios = page.getByRole('radiogroup').getByRole('radio')
        const targetValue = await targetOption.getAttribute('value')
        if (!targetValue) throw new Error('The requested quiz option has no radio value')

        const initialIndexes = await radios.evaluateAll((elements, value) => {
            const checkedIndex = elements.findIndex((element) => (element as HTMLInputElement).checked)
            return {
                current: elements.findIndex((element) => element === document.activeElement),
                checked: checkedIndex,
                target: elements.findIndex((element) => (element as HTMLInputElement).value === value),
                count: elements.length
            }
        }, targetValue)
        if (initialIndexes.count === 0) throw new Error('The current quiz question has no radio options')
        if (initialIndexes.current < 0) throw new Error('Tab did not focus a radio in the current quiz question')
        const expectedTabStop = initialIndexes.checked >= 0 ? initialIndexes.checked : 0
        if (initialIndexes.current !== expectedTabStop) {
            throw new Error(`Tab focused radio ${initialIndexes.current}, but the radio-group tab stop is ${expectedTabStop}`)
        }
        if (initialIndexes.target < 0) throw new Error('The requested quiz option is not in the current radio group')

        const forwardSteps = (initialIndexes.target - initialIndexes.current + initialIndexes.count) % initialIndexes.count
        const backwardSteps = (initialIndexes.current - initialIndexes.target + initialIndexes.count) % initialIndexes.count
        if (forwardSteps > 0 || backwardSteps > 0) {
            const direction = forwardSteps <= backwardSteps ? 'ArrowDown' : 'ArrowUp'
            const steps = Math.min(forwardSteps, backwardSteps)
            for (let step = 0; step < steps; step += 1) await page.keyboard.press(direction)
        } else if (initialIndexes.checked < 0) {
            // When Tab already focused the first radio, move around the group
            // and back so the active option is selected without submitting it.
            await page.keyboard.press('ArrowDown')
            await page.keyboard.press('ArrowUp')
        }

        const isFocusedAndChecked = await targetOption.evaluate((element) => {
            const radio = element as HTMLInputElement
            return radio === document.activeElement && radio.checked
        })
        if (!isFocusedAndChecked) throw new Error('Arrow navigation did not select and focus the requested quiz option')
        if (answerRequestCount !== 0) throw new Error('Radio keyboard navigation submitted a guest quiz answer before confirmation')
        return { getCount: () => answerRequestCount, stop }
    } catch (error) {
        stop()
        throw error
    }
}
