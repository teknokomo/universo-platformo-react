import type { ThemeModeColors, ThemeTokens } from '@universo-react/types'

/**
 * Browser-safe adapter: turns validated theme tokens into the input shape the
 * runtime `AppTheme` spreads over its base `colorSchemes`. Pure data — no
 * React, no MUI imports — so the package stays usable from Node.
 */

export interface ThemeMuiPaletteScheme {
    primary: { main: string; contrastText: string }
    secondary: { main: string; contrastText: string }
    background: { default: string; paper: string }
    text: { primary: string; secondary: string }
    divider: string
}

export interface ThemeMuiInput {
    palettePerScheme: { light: ThemeMuiPaletteScheme; dark: ThemeMuiPaletteScheme }
    fontFamily: string
    /** Base body font size in px (12–20). */
    fontSize: number
    /** Heading scale factor (1.1–1.4) applied to h1–h6 font sizes. */
    headingScale: number
    /** Computed h1–h6 font sizes in px from `fontSize` and `headingScale`. */
    headingFontSizes: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number }
    /** Font weights from `shared.typography.weights`, mapped to MUI's `fontWeightRegular`/`Medium`/`Bold` typography defaults. */
    fontWeight: { regular: number; medium: number; bold: number }
    /** MUI `theme.spacing` unit in px (density already applied). */
    spacingUnit: number
    shape: { borderRadius: number; borderWidth: number }
    shadows: string[]
}

const FONT_FAMILY_STACKS: Record<ThemeTokens['shared']['typography']['fontFamily'], string> = {
    inter: 'Inter, sans-serif',
    system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"JetBrains Mono", "Fira Code", "SFMono-Regular", monospace'
}

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

const computeHeadingFontSizes = (baseSize: number, scale: number): ThemeMuiInput['headingFontSizes'] => {
    // h6 stays at body size; each larger heading multiplies by the scale.
    const entries = HEADING_LEVELS.map((level, index) => {
        const exponent = HEADING_LEVELS.length - 1 - index
        const size = Math.round(baseSize * scale ** exponent * 10) / 10
        return [level, size] as const
    })
    return Object.fromEntries(entries) as ThemeMuiInput['headingFontSizes']
}

const toMuiPalette = (colors: ThemeModeColors): ThemeMuiPaletteScheme => ({
    primary: { main: colors.primary.main, contrastText: colors.primary.contrastText },
    secondary: { main: colors.secondary.main, contrastText: colors.secondary.contrastText },
    background: { default: colors.background.default, paper: colors.background.paper },
    text: { primary: colors.text.primary, secondary: colors.text.secondary },
    divider: colors.divider
})

const SHADOW_COLOR = 'hsla(220, 30%, 5%, OPACITY)'
const SHADOW_GEOMETRY = '0px 4px 16px 0px, hsla(220, 25%, 10%, OPACITY) 0px 8px 16px -5px'

const buildShadowRow = (opacity: number): string =>
    `${SHADOW_COLOR.replace('OPACITY', String(opacity))} ${SHADOW_GEOMETRY.replace(/OPACITY/g, String(opacity))}`

const SHADOW_SCALES: Record<ThemeTokens['shared']['shadows']['scale'], number[]> = {
    none: [],
    soft: [0.04, 0.05],
    default: [0.07, 0.07],
    strong: [0.16, 0.14]
}

const buildShadows = (scale: ThemeTokens['shared']['shadows']['scale']): string[] => {
    const rows = SHADOW_SCALES[scale]
    if (rows.length === 0) {
        return Array.from({ length: 25 }, (_, index) => (index === 0 ? 'none' : 'none'))
    }
    const first = buildShadowRow(rows[0])
    const second = buildShadowRow(rows[1])
    return Array.from({ length: 25 }, (_, index) => (index <= 1 ? (index === 0 ? 'none' : first) : second))
}

export const themeTokensToMuiInput = (tokens: ThemeTokens): ThemeMuiInput => {
    const { shared } = tokens
    const densityFactor = shared.spacing.density === 'compact' ? 0.75 : 1
    const spacingUnit = Math.max(2, Math.round(shared.spacing.base * densityFactor))
    return {
        palettePerScheme: {
            light: toMuiPalette(tokens.modes.light),
            dark: toMuiPalette(tokens.modes.dark)
        },
        fontFamily: FONT_FAMILY_STACKS[shared.typography.fontFamily],
        fontSize: shared.typography.baseSize,
        headingScale: shared.typography.scale,
        headingFontSizes: computeHeadingFontSizes(shared.typography.baseSize, shared.typography.scale),
        fontWeight: {
            regular: shared.typography.weights.regular,
            medium: shared.typography.weights.medium,
            bold: shared.typography.weights.bold
        },
        spacingUnit,
        shape: { borderRadius: shared.shape.borderRadius, borderWidth: shared.shape.borderWidth },
        shadows: buildShadows(shared.shadows.scale)
    }
}
