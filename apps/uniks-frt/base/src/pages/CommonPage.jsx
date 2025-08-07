import React, { useEffect, useState } from 'react'
import UnikDetail from './UnikDetail'
import { useTranslation } from 'react-i18next'
import api from '../../../../../packages/ui/src/api'

const CommonPage = () => {
    const { t } = useTranslation('uniks')
    const [commonUnik, setCommonUnik] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Request the common workspace object
        // Assuming the API supports the common=true parameter
        api.get('/api/v1/uniks?common=true')
            .then((res) => {
                // If the API returns an array, you can take the first element
                // For example: setCommonUnik(res.data[0])
                setCommonUnik(res.data)
            })
            .catch((err) => {
                console.error('Error loading common Unik:', err)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    if (loading) {
        return <div>{t('uniks.loading')}</div>
    }

    if (!commonUnik) {
        return <div>{t('uniks.notFound')}</div>
    }

    return <UnikDetail unik={commonUnik} />
}

export default CommonPage
