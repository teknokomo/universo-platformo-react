// Universo Platformo | Utility for converting UPDL scene data to AR.js HTML code
import { UPDLSceneGraph } from '../interfaces/UPDLTypes'

/**
 * Класс для конвертации UPDL сцены в HTML-код AR.js
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
        </style>
    </head>
    <body>
        <div id="loading-screen" class="loading-screen">
            <div class="loading-spinner"></div>
            <div>Загрузка AR сцены...</div>
        </div>

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

        // Если нет объектов, создаем красный куб по умолчанию
        if (!updlScene.objects || updlScene.objects.length === 0) {
            content += `<a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>\n`
            return content
        }

        // Обработка объектов из UPDL-сцены
        for (const obj of updlScene.objects) {
            content += this.generateObjectElement(obj)
        }

        return content
    }

    /**
     * Генерирует HTML элемент A-Frame для объекта UPDL
     * @param object Объект UPDL
     * @returns HTML-строка с элементом
     */
    private static generateObjectElement(object: any): string {
        // Определяем тип объекта и создаем соответствующий элемент A-Frame
        switch (object.type) {
            case 'box':
                return `<a-box 
          position="${object.position?.x || 0} ${object.position?.y || 0.5} ${object.position?.z || 0}"
          material="color: ${object.color || '#FF0000'};"
          scale="${object.scale?.x || 1} ${object.scale?.y || 1} ${object.scale?.z || 1}"
        ></a-box>\n`

            case 'sphere':
                return `<a-sphere 
          position="${object.position?.x || 0} ${object.position?.y || 0.5} ${object.position?.z || 0}"
          material="color: ${object.color || '#FF0000'};"
          radius="${object.radius || 0.5}"
        ></a-sphere>\n`

            case 'cylinder':
                return `<a-cylinder 
          position="${object.position?.x || 0} ${object.position?.y || 0.5} ${object.position?.z || 0}"
          material="color: ${object.color || '#FF0000'};"
          radius="${object.radius || 0.5}"
          height="${object.height || 1}"
        ></a-cylinder>\n`

            case 'plane':
                return `<a-plane 
          position="${object.position?.x || 0} ${object.position?.y || 0} ${object.position?.z || 0}"
          material="color: ${object.color || '#FF0000'};"
          width="${object.width || 1}"
          height="${object.height || 1}"
          rotation="-90 0 0"
        ></a-plane>\n`

            // По умолчанию, если тип не определен, создаем куб
            default:
                return `<a-box 
          position="${object.position?.x || 0} ${object.position?.y || 0.5} ${object.position?.z || 0}"
          material="color: #FF0000;"
          scale="1 1 1"
        ></a-box>\n`
        }
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
