import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import api from '@/api'

const DocumentList = ({ unikId }) => {
    const { t } = useTranslation()
    const [documents, setDocuments] = useState([])

    useEffect(() => {
        // Запрашиваем список документов для данного Unik
        api.get(`/api/v1/uniks/${unikId}/document-stores`)
            .then((res) => setDocuments(res.data))
            .catch((err) => console.error('Error fetching documents: ', err))
    }, [unikId])

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        try {
            await api.post(`/api/v1/document-store/${unikId}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            // После загрузки можно перезагрузить список или добавить новый элемент (здесь добавляем имя файла)
            setDocuments((prev) => [...prev, file.name])
        } catch (err) {
            alert(t('Failed to upload file'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Document Store')}</h3>
            <Button variant='contained' component='label'>
                {t('Upload File')}
                <input type='file' hidden onChange={handleUpload} />
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {documents.map((doc) => (
                    <li key={doc} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        <a href={`/api/v1/document-store/${unikId}/files/${doc}`} target='_blank' rel='noopener noreferrer'>
                            {doc}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default DocumentList
