import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// material-ui
import { List, ListItem, ListItemText, Skeleton } from '@mui/material'

// project imports
import MainCard from '../../../../../packages/ui/src/ui-component/cards/MainCard'
import ErrorBoundary from '../../../../../packages/ui/src/ErrorBoundary'
import { getAccounts } from '../api/finance/accounts'

const AccountList = () => {
    const { t } = useTranslation('finance')
    const [accounts, setAccounts] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getAccounts()
            .then((res) => setAccounts(res.data))
            .catch((err) => setError(err))
            .finally(() => setIsLoading(false))
    }, [])

    if (error) {
        return (
            <MainCard>
                <ErrorBoundary error={error} />
            </MainCard>
        )
    }

    return (
        <MainCard title={t('accountList.title')}>
            {isLoading ? (
                <Skeleton variant='rounded' height={40} />
            ) : (
                <List>
                    {accounts.map((account) => (
                        <ListItem key={account.id} divider>
                            <ListItemText primary={account.name} />
                        </ListItem>
                    ))}
                </List>
            )}
        </MainCard>
    )
}

export default AccountList
