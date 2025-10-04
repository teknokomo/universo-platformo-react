import Stack from '@mui/material/Stack'
import MainGrid from '../../components/dashboard/MainGrid'

interface DashboardProps {
    disableCustomTheme?: boolean
}

export default function Dashboard(_props: DashboardProps) {
    return (
        <Stack spacing={2} sx={{ width: '100%' }}>
            <MainGrid />
        </Stack>
    )
}
