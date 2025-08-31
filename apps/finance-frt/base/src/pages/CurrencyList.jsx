import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

// material-ui
import { List, ListItem, ListItemText, Skeleton } from '@mui/material'

// project imports
import MainCard from '../../../../../packages/ui/src/ui-component/cards/MainCard'
import ErrorBoundary from '../../../../../packages/ui/src/ErrorBoundary'
import { getCurrencies } from '../api/finance/currencies'

const CurrencyList = () => {
    const { t } = useTranslation('finance')
    const { unikId } = useParams()
    const [currencies, setCurrencies] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!unikId) return
        getCurrencies(unikId)
            .then((res) => setCurrencies(res.data))
            .catch((err) => setError(err))
            .finally(() => setIsLoading(false))
    }, [unikId])

    if (error) {
        return (
            <MainCard>
                <ErrorBoundary error={error} />
            </MainCard>
        )
    }

    return (
        <MainCard title={t('currencyList.title')}>
            {isLoading ? (
                <Skeleton variant='rounded' height={40} />
            ) : (
                <List>
                    {currencies.map((currency) => (
                        <ListItem key={currency.id} divider>
                            <ListItemText primary={currency.name || currency.code} />
                        </ListItem>
                    ))}
                </List>
            )}
        </MainCard>
    )
}

export default CurrencyList
