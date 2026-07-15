declare const matrixColorBrand: unique symbol

/**
 * Canonical opaque colour used by Interpretation Network matrix cells.
 *
 * The value is always an uppercase six-digit hexadecimal CSS colour. Alpha
 * channels and executable CSS values are deliberately outside this contract.
 */
export type MatrixColor = string & { readonly [matrixColorBrand]: 'MatrixColor' }

const shortHexColorPattern = /^#([0-9a-fA-F]{3})$/
const canonicalHexColorPattern = /^#[0-9A-F]{6}$/

export const isMatrixColor = (value: unknown): value is MatrixColor => typeof value === 'string' && canonicalHexColorPattern.test(value)

/**
 * Converts a user-entered three- or six-digit opaque hexadecimal colour to
 * its canonical persisted representation. Invalid values return null.
 */
export const parseInterpretationNetworkHexColor = (value: unknown): MatrixColor | null => {
    if (typeof value !== 'string') return null

    const shortMatch = value.match(shortHexColorPattern)
    if (shortMatch) {
        const [, shortHex] = shortMatch
        return `#${shortHex
            .toUpperCase()
            .split('')
            .map((character) => `${character}${character}`)
            .join('')}` as MatrixColor
    }

    const normalized = value.toUpperCase()
    return canonicalHexColorPattern.test(normalized) ? (normalized as MatrixColor) : null
}

/**
 * Applies the nullable persisted colour contract. It fails closed for every
 * non-null value that is not a strict opaque hexadecimal colour.
 */
export const normalizeInterpretationNetworkHexColor = (value: unknown): MatrixColor | null => {
    if (value === null) return null

    const color = parseInterpretationNetworkHexColor(value)
    if (!color) {
        throw new TypeError('Expected a #RGB or #RRGGBB opaque hexadecimal colour')
    }
    return color
}

/** Resolves untrusted persisted display input without throwing. */
export const resolveInterpretationNetworkDisplayColor = (value: unknown): MatrixColor | null => parseInterpretationNetworkHexColor(value)

const toLinearRgbChannel = (channel: number): number => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

const relativeLuminance = (color: MatrixColor): number => {
    const red = Number.parseInt(color.slice(1, 3), 16)
    const green = Number.parseInt(color.slice(3, 5), 16)
    const blue = Number.parseInt(color.slice(5, 7), 16)
    return 0.2126 * toLinearRgbChannel(red) + 0.7152 * toLinearRgbChannel(green) + 0.0722 * toLinearRgbChannel(blue)
}

/** Returns the WCAG contrast ratio for two canonical colours. */
export const calculateInterpretationNetworkContrastRatio = (foreground: MatrixColor, background: MatrixColor): number => {
    const foregroundLuminance = relativeLuminance(foreground)
    const backgroundLuminance = relativeLuminance(background)
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

const black = '#000000' as MatrixColor
const white = '#FFFFFF' as MatrixColor

/**
 * Chooses the deterministic black-or-white foreground with the strongest
 * contrast against a valid background. Invalid background input falls back
 * to the current theme text colour passed by the caller.
 */
export const resolveInterpretationNetworkMaximumContrastForeground = (background: unknown, fallback: MatrixColor = black): MatrixColor => {
    const resolvedBackground = resolveInterpretationNetworkDisplayColor(background)
    if (!resolvedBackground) return fallback

    return calculateInterpretationNetworkContrastRatio(black, resolvedBackground) >=
        calculateInterpretationNetworkContrastRatio(white, resolvedBackground)
        ? black
        : white
}
