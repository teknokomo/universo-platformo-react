import React, { useEffect, useState } from 'react'
import UnikDetail from './UnikDetail'
import { useTranslation } from 'react-i18next'
import api from '@/api' // ваш API helper, который прикрепляет JWT-токен к запросам

const CommonPage = () => {
    const { t } = useTranslation()
    const [commonUnik, setCommonUnik] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Запрашиваем объект общего рабочего пространства.
        // Предполагается, что API поддерживает параметр common=true
        api.get('/api/v1/uniks?common=true')
            .then((res) => {
                // Если API возвращает массив, можно взять первый элемент
                // Например: setCommonUnik(res.data[0])
                setCommonUnik(res.data)
            })
            .catch((err) => {
                console.error('Ошибка при загрузке общего Unik:', err)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    if (loading) {
        return <div>{t('Loading...')}</div>
    }

    if (!commonUnik) {
        return <div>{t('Common workspace not found')}</div>
    }

    return <UnikDetail unik={commonUnik} />
}

export default CommonPage
