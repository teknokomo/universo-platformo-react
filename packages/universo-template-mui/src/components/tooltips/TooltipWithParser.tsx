import React from 'react'
import { Info } from '@mui/icons-material'
import { IconButton, Tooltip, type TooltipProps, type SxProps, type Theme } from '@mui/material'
import parse from 'html-react-parser'

/**
 * Props for TooltipWithParser component
 */
export interface TooltipWithParserProps {
    /**
     * HTML content to display in tooltip (will be parsed as HTML)
     * @example "<strong>Bold</strong> and <em>italic</em> text"
     */
    title: string

    /**
     * Custom styles for the info icon
     */
    sx?: SxProps<Theme>

    /**
     * Tooltip placement
     * @default 'right'
     */
    placement?: TooltipProps['placement']

    /**
     * Icon size in pixels
     * @default 15
     */
    iconSize?: number

    /**
     * Maximum width of the tooltip
     * @default 300
     */
    maxWidth?: number
}

/**
 * Tooltip component with HTML parsing support for Universo Platformo
 *
 * Displays an Info icon that shows a tooltip with HTML content when hovered.
 * Automatically adapts to light/dark theme using MUI theme inheritance.
 *
 * **IMPORTANT**: This component does NOT use Redux for dark mode detection.
 * Instead, it relies on MUI's ColorScheme API (v6+) with `color: 'inherit'`.
 * The icon color automatically adapts to the current theme.palette.mode.
 *
 * @example Basic usage
 * ```tsx
 * import { TooltipWithParser } from '@universo/template-mui'
 *
 * <TooltipWithParser
 *   title="<strong>Important:</strong> This field is required"
 * />
 * ```
 *
 * @example Custom placement and size
 * ```tsx
 * <TooltipWithParser
 *   title="<em>Tip:</em> Click to expand"
 *   placement="top"
 *   iconSize={20}
 * />
 * ```
 *
 * @example Custom icon styles
 * ```tsx
 * <TooltipWithParser
 *   title="Help text"
 *   sx={{ color: 'primary.main' }}
 * />
 * ```
 */
export const TooltipWithParser: React.FC<TooltipWithParserProps> = ({ title, sx, placement = 'right', iconSize = 15, maxWidth = 300 }) => {
    return (
        <Tooltip
            title={parse(title)}
            placement={placement}
            componentsProps={{
                tooltip: {
                    sx: { maxWidth }
                }
            }}
        >
            <IconButton
                sx={{
                    height: iconSize,
                    width: iconSize,
                    ml: 2,
                    mt: -0.5
                }}
            >
                <Info
                    sx={{
                        ...sx,
                        background: 'transparent',
                        // CRITICAL: Use 'inherit' for automatic theme adaptation
                        // MUI v6 ColorScheme API handles light/dark mode automatically
                        // No Redux needed!
                        color: 'inherit',
                        height: iconSize,
                        width: iconSize
                    }}
                />
            </IconButton>
        </Tooltip>
    )
}
