import * as React from 'react'
import dayjs, { Dayjs } from 'dayjs'
import { useForkRef } from '@mui/material/utils'
import Button from '@mui/material/Button'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker, DatePickerFieldProps } from '@mui/x-date-pickers/DatePicker'
import { useParsedFormat, usePickerContext, useSplitFieldProps } from '@mui/x-date-pickers'
import { useTranslation } from 'react-i18next'

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

export default function CustomDatePicker() {
    const [value, setValue] = React.useState<Dayjs | null>(dayjs('2023-04-17'))
    const { i18n } = useTranslation('apps')
    const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'
    const formattedValue = value
        ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(value.toDate())
        : null

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
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
        </LocalizationProvider>
    )
}
