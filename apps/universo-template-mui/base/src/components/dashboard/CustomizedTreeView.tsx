import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

export default function CustomizedTreeView() {
    return (
        <Card variant='outlined' sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
            <CardContent>
                <Typography component='h2' variant='subtitle2'>
                    Product tree
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                    Tree view temporarily disabled for compatibility
                </Typography>
            </CardContent>
        </Card>
    )
}
