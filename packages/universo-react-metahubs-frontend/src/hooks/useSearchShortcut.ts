import { useEffect, RefObject } from 'react'
import { getOS } from '../utils/genericHelper'

const isMac = getOS() === 'macos'

interface UseSearchShortcutOptions {
    inputRef: RefObject<HTMLElement>
    onFocus?: () => void
    enabled?: boolean
}

const useSearchShortcut = ({ inputRef, onFocus, enabled = true }: UseSearchShortcutOptions): void => {
    useEffect(() => {
        if (!enabled) return

        const component = inputRef.current
        if (!component) return

        const handleKeyDown = (event: KeyboardEvent) => {
            const isSearchShortcut = isMac ? event.metaKey && event.key === 'f' : event.ctrlKey && event.key === 'f'

            if (isSearchShortcut) {
                event.preventDefault()
                if (onFocus) {
                    onFocus()
                } else {
                    component.focus()
                }
            }
        }

        const handleInputEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                component.blur()
            }
        }

        component.addEventListener('keydown', handleInputEscape)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            if (component) {
                component.removeEventListener('keydown', handleInputEscape)
            }
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [inputRef, onFocus, enabled])
}

export default useSearchShortcut
