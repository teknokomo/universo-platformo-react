import type { GridLocaleText } from '@mui/x-data-grid'
import { ruRU } from '@mui/x-data-grid/locales'

const ruLocaleText = ruRU.components.MuiDataGrid.defaultProps.localeText

/**
 * Return the MUI DataGrid localeText for a given i18n language code.
 *
 * Currently supported: 'ru' → ruRU.  All other codes fall back to the
 * built-in English default (returns `undefined`).
 */
export function getDataGridLocaleText(language: string): Partial<GridLocaleText> | undefined {
    const lang = language.slice(0, 2).toLowerCase()

    if (lang === 'ru') {
        return ruLocaleText
    }

    // English (default) — no override needed
    return undefined
}
