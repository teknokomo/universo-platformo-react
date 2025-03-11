import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import UnikDetail from './UnikDetail'
import { useTranslation } from 'react-i18next'
import api from '@/api' // Ваш helper для API-запросов

const UnikDetailWrapper = () => {
    const { unikId } = useParams()
    const { t } = useTranslation()
    const [unik, setUnik] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Запрос деталей рабочего пространства по ID
        api.get(`/api/v1/uniks/${unikId}`)
            .then((res) => {
                setUnik(res.data)
                setLoading(false)
            })
            .catch((err) => {
                console.error('Ошибка при загрузке Unik:', err)
                setLoading(false)
            })
    }, [unikId])

    if (loading) {
        return <div>{t('Loading...')}</div>
    }

    if (!unik) {
        return <div>{t('Unik not found')}</div>
    }

    return <UnikDetail unik={unik} />
}

export default UnikDetailWrapper
