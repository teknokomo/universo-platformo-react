import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { extractRuntimeErrorMessage } from '../../../../utils/runtimeErrors'

export const RuntimeContextMissing = ({ message }: { message: string }) => <Alert severity='info'>{message}</Alert>

export const WorkspaceLoading = ({ label }: { label: string }) => (
    <Stack data-testid='interpretation-network-workspace' spacing={1.5}>
        <LinearProgress aria-label={label} />
        <Typography variant='body2' color='text.secondary'>
            {label}
        </Typography>
    </Stack>
)

export const WorkspaceError = ({ error, fallback, locale }: { error: unknown; fallback: string; locale: string }) => (
    <Alert severity='error'>{extractRuntimeErrorMessage(error, fallback, locale)}</Alert>
)
