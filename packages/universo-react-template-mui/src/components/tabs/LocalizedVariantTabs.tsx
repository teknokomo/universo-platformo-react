import type { KeyboardEvent, MouseEvent } from 'react'
import { Box, ButtonBase, IconButton, Stack } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import StarIcon from '@mui/icons-material/Star'

export type LocalizedVariantTabItem = {
    code: string
    label: string
}

export type LocalizedVariantTabsLabels = {
    tabList: string
    add: string
    actions: (language: string) => string
    primary?: string
}

export type LocalizedVariantTabsProps = {
    items: LocalizedVariantTabItem[]
    value: string
    primaryValue?: string
    labels: LocalizedVariantTabsLabels
    canEdit?: boolean
    canAdd?: boolean
    onChange: (value: string) => void
    onAdd: (event: MouseEvent<HTMLElement>) => void
    onOpenActions: (event: MouseEvent<HTMLElement>, value: string) => void
    onTabKeyDown?: (event: KeyboardEvent<HTMLElement>, value: string) => void
}

export const LocalizedVariantTabs = ({
    items,
    value,
    primaryValue,
    labels,
    canEdit = true,
    canAdd = true,
    onChange,
    onAdd,
    onOpenActions,
    onTabKeyDown
}: LocalizedVariantTabsProps) => (
    <Stack direction='row' spacing={1} alignItems='flex-start' sx={{ mb: 1.5, flexWrap: 'wrap' }}>
        <Box
            role='tablist'
            aria-label={labels.tabList}
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                borderBottom: 1,
                borderColor: 'divider'
            }}
        >
            {items.map((item) => {
                const selected = value === item.code
                const isPrimary = primaryValue === item.code

                return (
                    <Stack
                        key={item.code}
                        direction='row'
                        spacing={0.25}
                        alignItems='flex-start'
                        sx={{
                            borderBottom: 2,
                            borderColor: selected ? 'text.primary' : 'transparent',
                            color: selected ? 'text.primary' : 'text.secondary',
                            transition: (theme) =>
                                theme.transitions.create(['border-color', 'color'], {
                                    duration: theme.transitions.duration.shortest
                                })
                        }}
                    >
                        <ButtonBase
                            role='tab'
                            aria-selected={selected}
                            tabIndex={selected ? 0 : -1}
                            data-content-locale-tab={item.code}
                            onClick={() => onChange(item.code)}
                            onKeyDown={(event) => onTabKeyDown?.(event, item.code)}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1,
                                py: '6px',
                                mb: '8px',
                                borderRadius: 1,
                                color: 'inherit',
                                fontFamily: (theme) => theme.typography.fontFamily,
                                fontWeight: (theme) => theme.typography.fontWeightMedium,
                                fontSize: '0.875rem',
                                lineHeight: 1.25,
                                textTransform: 'none',
                                '&:hover': {
                                    color: 'text.primary',
                                    bgcolor: 'action.hover'
                                },
                                '&:focus-visible': {
                                    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                                    outlineOffset: 2
                                }
                            }}
                        >
                            {isPrimary ? (
                                <StarIcon
                                    aria-label={labels.primary}
                                    sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, mx: -0.25 }}
                                />
                            ) : null}
                            <Box component='span'>{item.label}</Box>
                        </ButtonBase>
                        <IconButton
                            size='small'
                            aria-label={labels.actions(item.label)}
                            disabled={!canEdit}
                            onClick={(event) => onOpenActions(event, item.code)}
                            sx={{ width: 28, height: 28, p: 0.5, mt: 0, mb: '8px', lineHeight: 0 }}
                        >
                            <MoreVertRoundedIcon fontSize='small' />
                        </IconButton>
                    </Stack>
                )
            })}
        </Box>
        <IconButton
            size='small'
            aria-label={labels.add}
            disabled={!canAdd || !canEdit}
            onClick={onAdd}
            sx={{
                width: 28,
                height: 28,
                p: 0.5,
                mt: 0,
                mb: '8px',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                lineHeight: 0
            }}
        >
            <AddRoundedIcon fontSize='small' />
        </IconButton>
    </Stack>
)

export default LocalizedVariantTabs
