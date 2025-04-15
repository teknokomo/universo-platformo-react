// Universo Platformo | AR Scene Composer
import BaseHandler, { processComponent as processBaseComponent } from './BaseHandler'
import SceneHandler, { processComponent as processSceneComponent } from './SceneHandler'
import MarkerHandler, { processComponent as processMarkerComponent } from './MarkerHandler'
import BoxHandler, { processComponent as processBoxComponent } from './BoxHandler'
import CameraHandler, { processComponent as processCameraComponent } from './CameraHandler'
import { formatCoordinates } from './ARUtils'

// Universo Platformo | Component handlers registry
const HANDLERS = {
    base: processBaseComponent,
    scene: processSceneComponent,
    arscene: processSceneComponent, // Aliases for scene
    marker: processMarkerComponent,
    cube: processBoxComponent,
    box: processBoxComponent, // Aliases for cube
    camera: processCameraComponent
}

/**
 * Universo Platformo | Process a single component depending on its type
 * @param {Object} componentData - Component data from JSON
 * @returns {string} HTML-markup for the component
 */
const processComponent = (componentData) => {
    if (!componentData) {
        console.warn('Received empty component data')
        return ''
    }

    // Universo Platformo | Check for either component or type field
    const componentType = componentData.component || componentData.type

    if (!componentType) {
        console.warn('Component does not contain either component or type field:', componentData)
        return ''
    }

    const handler = HANDLERS[componentType]

    if (!handler) {
        console.warn(`Handler for component "${componentType}" not found`, componentData)
        return ''
    }

    // Universo Platformo | Process child components if they exist
    let childrenContent = ''
    if (componentData.children && Array.isArray(componentData.children)) {
        childrenContent = componentData.children.map((child) => processComponent(child)).join('')
    }

    // Universo Platformo | Call the corresponding handler
    try {
        return handler(componentData, childrenContent)
    } catch (error) {
        console.error(`Error processing component "${componentType}":`, error, componentData)
        return ''
    }
}

/**
 * Universo Platformo | AR Scene Composer - converts JSON data from API to HTML
 * @param {Object} sceneData - Scene data from API
 * @returns {string} HTML-code for AR scene or null if data is incorrect
 */
export const composeARScene = (sceneData) => {

    if (!sceneData) {
        console.error('AR scene is missing')
        return null
    }

    let sceneContent = '' // Initialize variable for scene content

    // Universo Platformo | Check various data formats that might come from the API

    // Universo Platformo | 1. If sceneData is already a component with a specified type (component or type)
    if (sceneData.component || sceneData.type) {
        // Universo Platformo | Ensure it is a scene component or wrap it in a scene if needed
        if (
            sceneData.component === 'arscene' ||
            sceneData.type === 'arscene' ||
            sceneData.component === 'scene' ||
            sceneData.type === 'scene'
        ) {
            sceneContent = processComponent(sceneData)
        } else {
            // Universo Platformo | If the root element is not a scene, create a scene and place it inside
            console.warn('Корневой элемент данных не является сценой, оборачиваем в <a-scene>')
            const innerContent = processComponent(sceneData)
            // Universo Platformo | Try to add a camera if it's not inside
            const needsCamera = !innerContent.includes('<a-entity camera')
            const cameraHtml = needsCamera ? processCameraComponent({ component: 'camera' }) : ''
            sceneContent = processSceneComponent({ component: 'scene' }, innerContent + cameraHtml)
        }
    }
    // 2. If sceneData contains a scene field that is a component
    else if (sceneData.scene && (sceneData.scene.component || sceneData.scene.type)) {
        sceneContent = processComponent(sceneData.scene)
    }
    // 3. If sceneData has child components, process them (assumed to be a scene)
    else if (sceneData.children && Array.isArray(sceneData.children) && sceneData.children.length > 0) {
        // Process components from sceneData
        const componentsContent = sceneData.children.map((child) => processComponent(child)).join('')

        // Add a camera if it's not among the components or their child elements
        let hasCameraComponent = false
        if (
            sceneData.children.some(
                (child) =>
                    child.component === 'camera' ||
                    child.type === 'camera' ||
                    (child.children &&
                        Array.isArray(child.children) &&
                        child.children.some((c) => c.component === 'camera' || c.type === 'camera'))
            )
        ) {
            hasCameraComponent = true
        }

        const cameraContent = hasCameraComponent
            ? ''
            : processCameraComponent({
                  component: 'camera',
                  position: formatCoordinates(sceneData.cameraPosition, '0 0 0')
              })

        // Compose the scene
        sceneContent = processSceneComponent(
            {
                component: 'scene', // Use 'scene' as the base type
                detectionMode: sceneData.detectionMode || 'mono',
                matrixCodeType: sceneData.matrixCodeType || '3x3', // Add matrixCodeType
                debugMode: sceneData.debugMode || false
                // Other scene attributes can be added here if they exist in sceneData
            },
            componentsContent + cameraContent
        )
    }
    // 4. If none of the above apply
    else {
        console.error('Incorrect data format for AR scene:', sceneData)
        return null // Return null if we couldn't generate a scene
    }

    // Always wrap the generated scene content in base HTML
    return processBaseComponent(
        {
            component: 'base',
            aframeVersion: sceneData.aframeVersion || '1.6.0' // Can be extracted from data if available
        },
        sceneContent // Pass here <a-scene>...</a-scene>
    )
}

/**
 * Universo Platformo | Register a new component handler
 * @param {string} componentType - Component type
 * @param {Function} handler - Handler function, taking (data, childrenContent)
 */
export const registerHandler = (componentType, handler) => {
    if (typeof componentType !== 'string' || typeof handler !== 'function') {
        console.error('Incorrect parameters when registering handler')
        return
    }

    HANDLERS[componentType] = handler
}
