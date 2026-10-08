import * as React from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { useForkRef } from '@mui/material/utils'
import Button from '@mui/material/Button'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker, type DatePickerFieldProps } from '@mui/x-date-pickers/DatePicker'
import { useParsedFormat, usePickerContext, useSplitFieldProps } from '@mui/x-date-pickers'
import { useTranslation } from 'react-i18next'
import Stack from '@mui/material/Stack'

interface ButtonFieldProps extends DatePickerFieldProps {}

function ButtonField(props: ButtonFieldProps) {
    const { forwardedProps } = useSplitFieldProps(props, 'date')
    const pickerContext = usePickerContext()
    const handleRef = useForkRef(pickerContext.triggerRef, pickerContext.rootRef)
    const parsedFormat = useParsedFormat()
    const valueStr = pickerContext.value == null ? parsedFormat : pickerContext.value.format(pickerContext.fieldFormat)
    const buttonProps = { ...forwardedProps } as React.ComponentProps<typeof Button> & {
        inputRef?: unknown
        slotProps?: unknown
    }

    delete buttonProps.inputRef
    delete buttonProps.slotProps

    return (
        <Button
            {...buttonProps}
            variant='outlined'
            ref={handleRef}
            size='small'
            startIcon={<CalendarTodayRoundedIcon fontSize='small' />}
            sx={{ minWidth: 'fit-content' }}
            onClick={() => pickerContext.setOpen((prev) => !prev)}
        >
            {pickerContext.label ?? valueStr}
        </Button>
    )
}

export interface CustomDatePickerProps {
    selection?: 'single' | 'range'
    showPresets?: boolean
}

const formatPickerValue = (value: Dayjs | null, locale: string): string | null =>
    value ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(value.toDate()) : null

export default function CustomDatePicker({ selection = 'single', showPresets = true }: CustomDatePickerProps) {
    const initialToday = React.useMemo(() => dayjs().startOf('day'), [])
    const [value, setValue] = React.useState<Dayjs | null>(initialToday)
    const [range, setRange] = React.useState<[Dayjs | null, Dayjs | null]>([initialToday, initialToday])
    const { t, i18n } = useTranslation('apps')
    const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'
    const formattedValue = formatPickerValue(value, locale)
    const formattedStart = formatPickerValue(range[0], locale)
    const formattedEnd = formatPickerValue(range[1], locale)

    const applyToday = () => {
        const today = dayjs().startOf('day')
        if (selection === 'range') {
            setRange([today, today])
            return
        }
        setValue(today)
    }

    const applyLastSevenDays = () => {
        const today = dayjs().startOf('day')
        setRange([today.subtract(6, 'day'), today])
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction='row' spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
                {selection === 'range' ? (
                    <>
                        <DatePicker
                            value={range[0]}
                            label={formattedStart ?? t('dashboard.widget.datePicker.start', 'Start date')}
                            onChange={(newValue) => setRange(([, end]) => [newValue, newValue && end?.isBefore(newValue) ? newValue : end])}
                            maxDate={range[1] ?? undefined}
                            slots={{ field: ButtonField }}
                            slotProps={{
                                nextIconButton: { size: 'small' },
                                previousIconButton: { size: 'small' }
                            }}
                            views={['day', 'month', 'year']}
                        />
                        <DatePicker
                            value={range[1]}
                            label={formattedEnd ?? t('dashboard.widget.datePicker.end', 'End date')}
                            onChange={(newValue) =>
                                setRange(([start]) => [newValue && start?.isAfter(newValue) ? newValue : start, newValue])
                            }
                            minDate={range[0] ?? undefined}
                            slots={{ field: ButtonField }}
                            slotProps={{
                                nextIconButton: { size: 'small' },
                                previousIconButton: { size: 'small' }
                            }}
                            views={['day', 'month', 'year']}
                        />
                    </>
                ) : (
                    <DatePicker
                        value={value}
                        label={formattedValue}
                        onChange={(newValue) => setValue(newValue)}
                        slots={{ field: ButtonField }}
                        slotProps={{
                            nextIconButton: { size: 'small' },
                            previousIconButton: { size: 'small' }
                        }}
                        views={['day', 'month', 'year']}
                    />
                )}
                {showPresets ? (
                    <>
                        <Button size='small' onClick={applyToday}>
                            {t('dashboard.widget.datePicker.today', 'Today')}
                        </Button>
                        {selection === 'range' ? (
                            <Button size='small' onClick={applyLastSevenDays}>
                                {t('dashboard.widget.datePicker.lastSevenDays', 'Last 7 days')}
                            </Button>
                        ) : null}
                    </>
                ) : null}
            </Stack>
        </LocalizationProvider>
    )
}
