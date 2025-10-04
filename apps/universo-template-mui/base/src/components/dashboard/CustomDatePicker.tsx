import * as React from 'react'
import dayjs, { Dayjs } from 'dayjs'
import Button from '@mui/material/Button'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker, DatePickerFieldProps } from '@mui/x-date-pickers/DatePicker'

interface ButtonFieldProps extends DatePickerFieldProps<Dayjs> {}

function ButtonField(props: ButtonFieldProps) {
    return (
        <Button variant='outlined' size='small' startIcon={<CalendarTodayRoundedIcon fontSize='small' />} sx={{ minWidth: 'fit-content' }}>
            Apr 17, 2023
        </Button>
    )
}

export default function CustomDatePicker() {
    const [value, setValue] = React.useState<Dayjs | null>(dayjs('2023-04-17'))

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
                value={value}
                label={value == null ? null : value.format('MMM DD, YYYY')}
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
