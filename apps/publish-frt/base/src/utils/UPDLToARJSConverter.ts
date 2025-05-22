// Universo Platformo | Utility for converting UPDL scene data to AR.js HTML code
import { UPDLSceneGraph } from '../interfaces/UPDLTypes'

/**
 * Класс для конвертации UPDL сцены в HTML-код AR.js
 * Используется в потоковой генерации AR.js сцены из UPDL данных
 */
export class UPDLToARJSConverter {
    /**
     * Конвертирует UPDL сцену напрямую в HTML-код AR.js
     * @param updlScene Сцена UPDL
     * @param projectName Название проекта
     * @returns HTML-код для AR.js
     */
    static convertToHTML(updlScene: UPDLSceneGraph, projectName: string = 'UPDL-AR.js'): string {
        const aframeVersion = '1.6.0'
        const arjsVersion = 'master'

        // Построение HTML-структуры
        const html = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(projectName)}</title>
        <script src="https://aframe.io/releases/${aframeVersion}/aframe.min.js"></script>
        <script src="https://raw.githack.com/AR-js-org/AR.js/${arjsVersion}/aframe/build/aframe-ar.js"></script>
        <style>
            body {
                margin: 0;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                z-index: 9999;
            }
            .loading-screen.hidden {
                display: none;
            }
            .loading-spinner {
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top: 5px solid #fff;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .ar-instructions {
                position: fixed;
                bottom: 20px;
                left: 0;
                width: 100%;
                text-align: center;
                color: white;
                background-color: rgba(0,0,0,0.5);
                padding: 10px;
                z-index: 999;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <!-- Экран загрузки -->
        <div id="loading-screen" class="loading-screen">
            <div class="loading-spinner"></div>
            <div>Загрузка AR сцены...</div>
        </div>

        <!-- Инструкции для пользователя -->
        <div id="ar-instructions" class="ar-instructions">
            Наведите камеру на маркер HIRO для отображения 3D объектов
        </div>

        <!-- AR.js сцена -->
        <a-scene embedded arjs="trackingMethod: best; debugUIEnabled: false;" vr-mode-ui="enabled: false">
            <a-marker preset="hiro">
                ${this.generateSceneContent(updlScene)}
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>

        <script>
            // Скрыть экран загрузки когда сцена загружена
            document.addEventListener('DOMContentLoaded', function() {
                const scene = document.querySelector('a-scene');
                if (scene.hasLoaded) {
                    document.querySelector('#loading-screen').classList.add('hidden');
                } else {
                    scene.addEventListener('loaded', function() {
                        document.querySelector('#loading-screen').classList.add('hidden');
                    });
                }

                // Скрыть инструкции через 10 секунд
                setTimeout(function() {
                    const instructions = document.querySelector('#ar-instructions');
                    if (instructions) {
                        instructions.style.opacity = '0';
                        instructions.style.transition = 'opacity 1s';
                        setTimeout(() => instructions.style.display = 'none', 1000);
                    }
                }, 10000);
            });
        </script>
    </body>
</html>
    `

        return html
    }

    /**
     * Генерирует содержимое AR сцены из UPDL-объектов
     * @param updlScene Сцена UPDL
     * @returns HTML-строка с элементами сцены
     */
    private static generateSceneContent(updlScene: UPDLSceneGraph): string {
        let content = ''

        try {
            // Если сцена пустая или отсутствует, создаем красный куб по умолчанию
            if (!updlScene || !updlScene.objects || updlScene.objects.length === 0) {
                console.log('[UPDLToARJSConverter] No objects found, creating default red cube')
                content += `<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n`
                return content
            }

            console.log(`[UPDLToARJSConverter] Processing ${updlScene.objects.length} objects`)

            // Обработка объектов из UPDL-сцены
            for (const obj of updlScene.objects) {
                content += this.generateObjectElement(obj)
            }

            return content
        } catch (error) {
            console.error('[UPDLToARJSConverter] Error generating scene content:', error)
            // В случае ошибки возвращаем простой красный куб
            return `<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n`
        }
    }

    /**
     * Генерирует HTML элемент A-Frame для объекта UPDL
     * @param object Объект UPDL
     * @returns HTML-строка с элементом
     */
    private static generateObjectElement(object: any): string {
        if (!object || !object.type) {
            console.warn('[UPDLToARJSConverter] Invalid object, missing type:', object)
            return ''
        }

        try {
            // Получаем общие атрибуты
            const position = this.getPositionString(object.position)
            const scale = this.getScaleString(object.scale)
            const color = object.color || '#FF0000'
            const rotation = this.getRotationString(object.rotation)

            // Определяем тип объекта и создаем соответствующий элемент A-Frame
            switch (object.type.toLowerCase()) {
                case 'box':
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`

                case 'sphere':
                    return `<a-sphere 
                position="${position}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
            ></a-sphere>\n`

                case 'cylinder':
                    return `<a-cylinder 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cylinder>\n`

                case 'plane':
                    return `<a-plane 
                position="${position}"
                material="color: ${color};"
                width="${object.width || 1}"
                height="${object.height || 1}"
                rotation="${object.rotation?.x || -90} ${object.rotation?.y || 0} ${object.rotation?.z || 0}"
                scale="${scale}"
            ></a-plane>\n`

                case 'text':
                    return `<a-text 
                position="${position}"
                rotation="${rotation}"
                value="${this.escapeHtml(object.value || 'Text')}"
                color="${color}"
                width="${object.width || 10}"
                align="${object.align || 'center'}"
                scale="${scale}"
            ></a-text>\n`

                case 'circle':
                    return `<a-circle 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius="${object.radius || 0.5}"
                scale="${scale}"
            ></a-circle>\n`

                case 'cone':
                    return `<a-cone 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                radius-bottom="${object.radiusBottom || 0.5}"
                radius-top="${object.radiusTop || 0}"
                height="${object.height || 1}"
                scale="${scale}"
            ></a-cone>\n`

                // По умолчанию, если тип не определен, создаем куб
                default:
                    console.warn(`[UPDLToARJSConverter] Unknown object type: ${object.type}, defaulting to box`)
                    return `<a-box 
                position="${position}"
                rotation="${rotation}"
                material="color: ${color};"
                scale="${scale}"
            ></a-box>\n`
            }
        } catch (error) {
            console.error(`[UPDLToARJSConverter] Error processing object:`, error, object)
            return ''
        }
    }

    /**
     * Формирует строку позиции из объекта position
     */
    private static getPositionString(position: any): string {
        if (!position) return '0 0.5 0'
        return `${position.x || 0} ${position.y || 0.5} ${position.z || 0}`
    }

    /**
     * Формирует строку масштаба из объекта scale
     */
    private static getScaleString(scale: any): string {
        if (!scale) return '1 1 1'
        return `${scale.x || 1} ${scale.y || 1} ${scale.z || 1}`
    }

    /**
     * Формирует строку поворота из объекта rotation
     */
    private static getRotationString(rotation: any): string {
        if (!rotation) return '0 0 0'
        return `${rotation.x || 0} ${rotation.y || 0} ${rotation.z || 0}`
    }

    /**
     * Простой метод для экранирования HTML
     * @param text Исходный текст
     * @returns Экранированный текст
     */
    private static escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    }
}
