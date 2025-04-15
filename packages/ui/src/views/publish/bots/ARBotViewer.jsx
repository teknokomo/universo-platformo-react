// Universo Platformo | AR Bot Viewer implementation
import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

// Project import
import BaseBot from './BaseBot'
import chatflowsApi from '@/api/chatflows'

// Composer
import { composeARScene } from './handlers/ARSceneComposer'

// ==============================|| AR Bot Viewer ||============================== //

// Universo Platformo | Component for AR bot
const ARBotComponent = ({ chatflow }) => {
    const [error, setError] = useState(null)
    const iframeRef = useRef(null)

    // Universo Platformo | Initialize AR when the component mounts
    useEffect(() => {
        const initAR = async () => {
            try {
                if (!chatflow?.id) {
                    setError('Не удалось инициализировать AR: отсутствует ID chatflow')
                    return
                }

                // Universo Platformo | Get API data
                const response = await chatflowsApi.getARData(chatflow.id)
                const apiData = response.data

                if (!apiData?.scene) {
                    setError('Некорректные данные AR: отсутствует сцена')
                    return
                }

                // Universo Platformo | Generate HTML using the composer
                const html = composeARScene(apiData.scene)

                if (!html) {
                    setError('Не удалось сгенерировать HTML для AR сцены')
                    return
                }

                // Universo Platformo | Create iframe and set its content
                const iframe = document.createElement('iframe')
                iframe.style.width = '100%'
                iframe.style.height = '100%'
                iframe.style.border = 'none'
                iframe.allow = 'camera'
                iframe.allowFullscreen = true

                if (iframeRef.current) {
                    iframeRef.current.innerHTML = ''
                    iframeRef.current.appendChild(iframe)

                    // Universo Platformo | Write HTML to the iframe
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
                    iframeDoc.open()
                    iframeDoc.write(html)
                    iframeDoc.close()
                }
            } catch (err) {
                console.error('Ошибка инициализации AR:', err)
                setError(err.message || 'Ошибка загрузки AR')
            }
        }

        initAR()
    }, [chatflow])

    // Universo Platformo | Display error if exists
    if (error) {
        return <div style={{ color: 'red', padding: '20px' }}>{error}</div>
    }

    // Universo Platformo | Render only the container for the iframe
    return <div ref={iframeRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
}

ARBotComponent.propTypes = {
    chatflow: PropTypes.object
}

// Universo Platformo | Wrapper with BaseBot
const ARBotViewer = () => {
    return <BaseBot>{(chatflow) => <ARBotComponent chatflow={chatflow} />}</BaseBot>
}

export default ARBotViewer
