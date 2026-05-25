import { Theme, Components } from '@mui/material/styles'
import { gray } from '../themePrimitives'

export const feedbackCustomizations: Components<Theme> = {
    MuiAlert: {
        styleOverrides: {
            root: {
                borderRadius: 10
            }
        }
    },
    MuiDialog: {
        styleOverrides: {
            root: ({ theme }) => ({
                '& .MuiDialog-paper': {
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: (theme.vars || theme).palette.divider
                }
            })
        }
    },
    MuiLinearProgress: {
        styleOverrides: {
            root: ({ theme }) => ({
                height: 8,
                borderRadius: 8,
                backgroundColor: gray[200],
                ...theme.applyStyles('dark', {
                    backgroundColor: gray[800]
                })
            })
        }
    }
}
