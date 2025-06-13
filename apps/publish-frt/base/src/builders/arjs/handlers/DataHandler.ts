// Universo Platformo | AR.js Data Handler
// Handles processing of UPDL Data nodes for AR.js quiz functionality

import { IUPDLData, IUPDLMultiScene, IUPDLScene } from '../../../../../../../packages/server/src/Interface.UPDL'
import { BuildOptions } from '../../common/types'

/**
 * Processes UPDL Data nodes for AR.js quiz generation
 */
export class DataHandler {
    // Universo Platformo | Global points counter for quiz
    private currentPoints: number = 0
    /**
     * Process data array for quiz functionality
     * @param datas Array of UPDL data nodes
     * @param options Build options
     * @returns HTML string with quiz UI and JavaScript logic
     */
    process(datas: IUPDLData[], options: BuildOptions = {}): string {
        try {
            console.log(`[DataHandler] Processing ${datas?.length || 0} data nodes`)
            console.log(`[DataHandler] Input data details:`, datas)

            // If no data nodes, return empty content
            if (!datas || datas.length === 0) {
                console.log(`[DataHandler] No data nodes provided, returning empty string`)
                return ''
            }

            // Separate data by type
            const questions = datas.filter((data) => data.dataType?.toLowerCase() === 'question')
            const answers = datas.filter((data) => data.dataType?.toLowerCase() === 'answer')

            console.log(`[DataHandler] Found ${questions.length} questions, ${answers.length} answers`)

            // Generate quiz UI and logic
            let content = ''

            // Add quiz UI elements
            content += this.generateQuizUI(questions, answers)

            // Add quiz JavaScript logic
            content += this.generateQuizScript(questions, answers)

            console.log(`[DataHandler] Generated quiz UI and logic`)
            console.log(`[DataHandler] Generated content length: ${content.length}`)
            console.log(`[DataHandler] Generated content preview:`, content.substring(0, 300) + '...')
            return content
        } catch (error) {
            console.error('[DataHandler] Error processing data:', error)
            return ''
        }
    }

    /**
     * Universo Platformo | Process multi-scene structure for quiz functionality
     * @param multiScene Multi-scene data structure
     * @param options Build options including showPoints option
     * @returns HTML string with multi-scene quiz UI and JavaScript logic
     */
    processMultiScene(multiScene: IUPDLMultiScene, options: BuildOptions & { showPoints?: boolean } = {}): string {
        console.log('🎯 [DataHandler] Points system configuration:', {
            showPointsOption: options.showPoints,
            optionsKeys: Object.keys(options),
            hasShowPoints: 'showPoints' in options
        })
        try {
            console.log(`[DataHandler] Processing multi-scene with ${multiScene.totalScenes} scenes`)

            if (!multiScene.scenes || multiScene.scenes.length === 0) {
                console.log(`[DataHandler] No scenes provided, returning empty string`)
                return ''
            }

            // Universo Platformo | Extract leadCollection from first scene
            const firstScene = multiScene.scenes.length > 0 ? multiScene.scenes[0] : null
            const leadCollection = firstScene?.spaceData?.leadCollection

            console.log('🔧 [DataHandler] Lead collection analysis:', {
                hasScenes: multiScene.scenes.length > 0,
                firstSceneExists: !!firstScene,
                hasSpaceData: !!firstScene?.spaceData,
                leadCollection,
                spaceDataKeys: firstScene?.spaceData ? Object.keys(firstScene.spaceData) : []
            })

            // Generate multi-scene UI and logic
            let content = ''

            // Add multi-scene UI elements (all scenes, but hidden initially)
            content += this.generateMultiSceneUI(multiScene, options.showPoints, leadCollection)

            // Add multi-scene JavaScript logic with state management
            content += this.generateMultiSceneScript(multiScene, options.showPoints, leadCollection)

            console.log(`[DataHandler] Generated multi-scene UI and logic`)
            console.log(`[DataHandler] Generated content length: ${content.length}`)

            return content
        } catch (error) {
            console.error('[DataHandler] Error processing multi-scene:', error)
            return ''
        }
    }

    /**
     * Generates multi-scene UI HTML elements
     * @param multiScene Multi-scene data structure
     * @param showPoints Whether to show points counter
     * @param leadCollection Lead collection configuration
     * @returns HTML string with multi-scene quiz UI
     */
    private generateMultiSceneUI(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean }
    ): string {
        console.log('🎯 [DataHandler] generateMultiSceneUI called with showPoints:', showPoints)
        console.log('🎯 [DataHandler] generateMultiSceneUI called with leadCollection:', leadCollection)

        let html = ''

        // Universo Platformo | Add lead collection form if configured
        if (leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)) {
            html += this.generateLeadCollectionForm(leadCollection)
        }

        html += `
            <!-- Universo Platformo | Multi-Scene Quiz UI -->
            <div id="multi-scene-quiz-container" style="
                position: fixed; 
                top: 20px; 
                left: 20px; 
                background: rgba(0,0,0,0.8); 
                color: white; 
                padding: 20px; 
                border-radius: 10px; 
                max-width: 300px;
                z-index: 1000;
                font-family: Arial, sans-serif;
                ${
                    leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                        ? 'display: none;'
                        : ''
                }
            ">
                <div id="scene-progress" style="margin-bottom: 15px; font-size: 12px; opacity: 0.8;">
                    Вопрос <span id="current-scene-number">1</span> из ${multiScene.totalScenes}
                </div>
                ${
                    showPoints
                        ? `<div id="points-counter" style="margin-bottom: 15px; font-size: 14px; font-weight: bold; color: #FFD700;">
                    Баллы: <span id="current-points">0</span>
                </div>`
                        : ''
                }
        `

        // Universo Platformo | Debug scene order and content
        console.log(`[DataHandler] Processing scenes in order:`)
        multiScene.scenes.forEach((scene, index) => {
            console.log(`[DataHandler] Scene ${index}: spaceId=${scene.spaceId}, order=${scene.order || 'undefined'}`)
            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            if (questions.length > 0) {
                console.log(`[DataHandler] Scene ${index} main question: "${questions[0].content?.substring(0, 100)}..."`)
            }
        })

        // Generate UI for each scene (initially hidden except first)
        multiScene.scenes.forEach((scene, sceneIndex) => {
            const isVisible = sceneIndex === 0

            // Universo Platformo | Debug logging for data analysis
            console.log(`[DataHandler] Scene ${sceneIndex}: Space ${scene.spaceId}, total data nodes: ${scene.dataNodes.length}`)
            scene.dataNodes.forEach((data, dataIndex) => {
                console.log(
                    `[DataHandler] Scene ${sceneIndex} Data ${dataIndex}: type=${data.dataType}, id=${
                        data.id
                    }, content=${data.content?.substring(0, 50)}...`
                )
            })

            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            const answers = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'answer')

            console.log(
                `[DataHandler] Scene ${sceneIndex}: Space ${scene.spaceId}, ${questions.length} questions, ${answers.length} answers`
            )

            // Universo Platformo | Debug scene visibility and content
            console.log(`[DataHandler] Scene ${sceneIndex} visibility: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`)
            console.log(`[DataHandler] Scene ${sceneIndex} HTML will have id: "scene-${sceneIndex}"`)
            console.log(`[DataHandler] Scene ${sceneIndex} HTML display style: ${isVisible ? 'block' : 'none'}`)
            if (questions.length > 0) {
                console.log(`[DataHandler] Scene ${sceneIndex} will show question: "${questions[0].content?.substring(0, 100)}..."`)
            }

            if (questions.length > 0) {
                const question = questions[0]

                html += `
                    <div id="scene-${sceneIndex}" class="quiz-scene" style="display: ${isVisible ? 'block' : 'none'};">
                        <h3 id="quiz-question-${sceneIndex}" style="margin: 0 0 15px 0; font-size: 16px;">
                            ${this.escapeHtml(question.content)}
                        </h3>
                        <div id="quiz-buttons-${sceneIndex}">
                `

                // Universo Platformo | Debug HTML generation for this scene
                console.log(
                    `[DataHandler] Generated HTML for scene ${sceneIndex}: div id="scene-${sceneIndex}", display=${
                        isVisible ? 'block' : 'none'
                    }`
                )

                // Generate answer buttons for this scene
                answers.forEach((answer, answerIndex) => {
                    // Universo Platformo | Debug logging for answer processing
                    console.log(
                        `[DataHandler] Scene ${sceneIndex} Answer ${answerIndex}: id=${answer.id}, content=${answer.content}, isCorrect=${answer.isCorrect}`
                    )

                    html += `
                            <button 
                                id="answer-btn-${sceneIndex}-${answerIndex}"
                                class="quiz-answer-btn"
                                data-scene-index="${sceneIndex}"
                                data-answer-id="${answer.id}"
                                data-is-correct="${answer.isCorrect}"
                                data-enable-points="${answer.enablePoints || false}"
                                data-points-value="${answer.pointsValue || 0}"
                                style="
                                    display: block; 
                                    width: 100%; 
                                    margin: 5px 0; 
                                    padding: 10px; 
                                    background: #4CAF50; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 5px; 
                                    cursor: pointer;
                                    font-size: 14px;
                                "
                                onmouseover="this.style.background='#45a049'"
                                onmouseout="this.style.background='#4CAF50'"
                            >
                                ${this.escapeHtml(answer.content)}
                            </button>
                    `
                })

                html += `
                        </div>
                        <div id="quiz-feedback-${sceneIndex}" style="margin-top: 15px; font-size: 14px; display: none;"></div>
                    </div>
                `
            }
        })

        html += `
            </div>
        `

        // Universo Platformo | Debug final HTML structure info
        console.log(`[DataHandler] Generated HTML contains ${multiScene.scenes.length} scene containers`)
        console.log(`[DataHandler] Scene 0 should be visible by default, others hidden`)

        return html
    }

    /**
     * Generates multi-scene JavaScript logic with state management
     * @param multiScene Multi-scene data structure
     * @param showPoints Whether to show points counter
     * @param leadCollection Lead collection configuration
     * @returns JavaScript string with multi-scene logic
     */
    private generateMultiSceneScript(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean }
    ): string {
        console.log('🎯 [DataHandler] generateMultiSceneScript called with showPoints:', showPoints)
        console.log('🎯 [DataHandler] generateMultiSceneScript called with leadCollection:', leadCollection)

        return `
            <script>
                // Universo Platformo | Multi-Scene Quiz Logic
                console.log('[MultiSceneQuiz] Initializing multi-scene quiz functionality');
                
                // Universo Platformo | Lead data collection variables
                let leadData = {
                    name: '',
                    email: '',
                    phone: '',
                    hasData: false
                };
                
                // Universo Platformo | Points management system
                class PointsManager {
                    constructor() {
                        this.currentPoints = 0;
                        this.pointsElement = null;
                    }

                    initialize() {
                        this.pointsElement = document.getElementById('current-points');
                        this.updateDisplay();
                    }

                    addPoints(points) {
                        this.currentPoints = Math.max(0, this.currentPoints + points);
                        this.updateDisplay();
                        console.log(\`[PointsManager] Points updated: +\${points}, total: \${this.currentPoints}\`);
                    }

                    updateDisplay() {
                        if (this.pointsElement) {
                            this.pointsElement.textContent = this.currentPoints;
                        }
                    }

                    getCurrentPoints() {
                        return this.currentPoints;
                    }
                }

                // Scene state management
                class SceneStateManager {
                    constructor(totalScenes) {
                        this.totalScenes = totalScenes;
                        this.currentSceneIndex = 0;
                        this.sceneAnswered = false;
                        this.isCompleted = false;
                    }

                    getCurrentScene() {
                        return this.currentSceneIndex;
                    }

                    // Universo Platformo | Method to manually set current scene (for lead form transition)
                    setCurrentScene(sceneIndex) {
                        if (sceneIndex >= 0 && sceneIndex < this.totalScenes) {
                            this.currentSceneIndex = sceneIndex;
                            this.sceneAnswered = false;
                            console.log(\`[MultiSceneQuiz] Scene manually set to \${sceneIndex}\`);
                        }
                    }

                    nextScene() {
                        if (this.currentSceneIndex < this.totalScenes - 1) {
                            this.currentSceneIndex++;
                            this.sceneAnswered = false;
                            this.showCurrentScene();
                            this.hideObjectsOfPreviousScene();
                            this.showObjectsOfCurrentScene();
                            return true;
                        }
                        this.isCompleted = true;
                        console.log('[MultiSceneQuiz] Quiz completed!');
                        return false;
                    }

                    showCurrentScene() {
                        // Hide all scenes
                        document.querySelectorAll('.quiz-scene').forEach(scene => {
                            scene.style.display = 'none';
                        });
                        
                        // Show current scene
                        const currentScene = document.getElementById(\`scene-\${this.currentSceneIndex}\`);
                        if (currentScene) {
                            currentScene.style.display = 'block';
                        }
                        
                        // Update progress indicator
                        const progressElement = document.getElementById('current-scene-number');
                        if (progressElement) {
                            progressElement.textContent = this.currentSceneIndex + 1;
                        }
                        
                        console.log(\`[MultiSceneQuiz] Showing scene \${this.currentSceneIndex}\`);
                    }

                    hideObjectsOfPreviousScene() {
                        // Hide objects from previous scene
                        const prevSceneIndex = this.currentSceneIndex - 1;
                        if (prevSceneIndex >= 0) {
                            const prevObjects = document.querySelectorAll(\`[data-scene-id="\${prevSceneIndex}"]\`);
                            prevObjects.forEach(obj => {
                                obj.setAttribute('visible', 'false');
                            });
                        }
                    }

                    showObjectsOfCurrentScene() {
                        // Show objects for current scene
                        const currentObjects = document.querySelectorAll(\`[data-scene-id="\${this.currentSceneIndex}"]\`);
                        currentObjects.forEach(obj => {
                            obj.setAttribute('visible', 'true');
                        });
                    }

                    markSceneAnswered() {
                        this.sceneAnswered = true;
                    }

                    isSceneAnswered() {
                        return this.sceneAnswered;
                    }

                    isQuizCompleted() {
                        return this.isCompleted;
                    }
                }

                // Initialize scene manager and points manager
                const sceneManager = new SceneStateManager(${multiScene.totalScenes});
                ${showPoints ? 'const pointsManager = new PointsManager();' : '// Points disabled for this quiz'}
                
                // Initialize quiz when A-Frame scene loads
                document.addEventListener('DOMContentLoaded', function() {
                    initializeMultiSceneQuiz();
                });
                
                function initializeMultiSceneQuiz() {
                    console.log('[MultiSceneQuiz] Setting up multi-scene quiz interactions');
                    
                    // Universo Platformo | Lead form initialization
                    ${
                        leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                            ? 'initializeLeadForm();'
                            : '// No lead collection configured'
                    }
                    
                    // Universo Platformo | Debug initial state
                    console.log(\`[MultiSceneQuiz] Current scene index: \${sceneManager.getCurrentScene()}\`);
                    console.log('[MultiSceneQuiz] Calling showCurrentScene() to initialize visibility');
                    
                    // Initialize first scene display
                    sceneManager.showCurrentScene();
                    
                    // Initialize points manager if enabled
                    ${showPoints ? 'pointsManager.initialize();' : '// Points disabled'}
                    
                    // Universo Platformo | Debug scene elements after initialization
                    setTimeout(() => {
                        const allScenes = document.querySelectorAll('.quiz-scene');
                        console.log(\`[MultiSceneQuiz] Found \${allScenes.length} scene elements in DOM:\`);
                        allScenes.forEach((scene, index) => {
                            const isVisible = scene.style.display !== 'none';
                            const sceneId = scene.id;
                            console.log(\`[MultiSceneQuiz] Scene element \${index}: id=\${sceneId}, display=\${scene.style.display}, visible=\${isVisible}\`);
                            
                            // Check question content
                            const questionElement = scene.querySelector('[id^="quiz-question-"]');
                            if (questionElement) {
                                console.log(\`[MultiSceneQuiz] Scene \${index} question content: "\${questionElement.textContent?.substring(0, 100)}..."\`);
                            }
                        });
                    }, 100);
                    
                    // Add click handlers to answer buttons
                    const answerButtons = document.querySelectorAll('.quiz-answer-btn');
                    answerButtons.forEach(button => {
                        button.addEventListener('click', function() {
                            const sceneIndex = parseInt(this.getAttribute('data-scene-index'));
                            
                            // Only handle clicks for current scene
                            if (sceneIndex !== sceneManager.getCurrentScene()) return;
                            if (sceneManager.isSceneAnswered()) return;
                            
                            handleMultiSceneAnswerClick(this);
                        });
                    });
                    
                    // Add click handlers to 3D objects for interaction
                    setTimeout(() => {
                        setupMultiSceneObjectInteractions();
                    }, 1000); // Wait for A-Frame to initialize
                }
                
                function handleMultiSceneAnswerClick(button) {
                    if (sceneManager.isSceneAnswered()) return;
                    
                    const sceneIndex = parseInt(button.getAttribute('data-scene-index'));
                    const isCorrect = button.getAttribute('data-is-correct') === 'true';
                    const answerId = button.getAttribute('data-answer-id');
                    
                    // Universo Platformo | Process points if enabled
                    const enablePoints = button.getAttribute('data-enable-points') === 'true';
                    const pointsValue = parseInt(button.getAttribute('data-points-value')) || 0;
                    
                    ${
                        showPoints
                            ? `if (enablePoints && pointsValue !== 0) {
                        pointsManager.addPoints(pointsValue);
                    }`
                            : '// Points processing disabled'
                    }
                    
                    sceneManager.markSceneAnswered();
                    
                    // Visual feedback
                    if (isCorrect) {
                        button.style.background = '#4CAF50';
                        button.style.border = '3px solid #2E7D32';
                        showSceneFeedback(sceneIndex, 'Правильно! ✅', '#4CAF50');
                    } else {
                        button.style.background = '#f44336';
                        button.style.border = '3px solid #c62828';
                        showSceneFeedback(sceneIndex, 'Неправильно ❌', '#f44336');
                        
                        // Highlight correct answer
                        const correctButton = document.querySelector(\`[data-scene-index="\${sceneIndex}"][data-is-correct="true"]\`);
                        if (correctButton) {
                            correctButton.style.background = '#4CAF50';
                            correctButton.style.border = '3px solid #2E7D32';
                        }
                    }
                    
                    // Disable all buttons for current scene
                    const sceneButtons = document.querySelectorAll(\`[data-scene-index="\${sceneIndex}"]\`);
                    sceneButtons.forEach(btn => {
                        btn.style.opacity = '0.7';
                        btn.style.cursor = 'not-allowed';
                    });

                    // Transition to next scene after 1 second
                    setTimeout(() => {
                        const hasNextScene = sceneManager.nextScene();
                        if (!hasNextScene) {
                            console.log('[MultiSceneQuiz] All scenes completed!');
                            // Quiz completed - could show final score here in future
                        }
                    }, 1000);
                }

                function showSceneFeedback(sceneIndex, message, color) {
                    const feedbackElement = document.getElementById(\`quiz-feedback-\${sceneIndex}\`);
                    if (feedbackElement) {
                        feedbackElement.innerHTML = message;
                        feedbackElement.style.color = color;
                        feedbackElement.style.display = 'block';
                    }
                }
                
                function setupMultiSceneObjectInteractions() {
                    // Add click interactions to 3D objects with scene association
                    const objects = document.querySelectorAll('a-box, a-sphere, a-cylinder, a-plane');
                    console.log(\`[MultiSceneQuiz] Found \${objects.length} A-Frame objects in DOM\`);
                    
                    objects.forEach((obj, index) => {
                        const sceneId = obj.getAttribute('data-scene-id');
                        const visible = obj.getAttribute('visible');
                        
                        // Get A-Frame component values properly
                        const positionComponent = obj.components.position;
                        const materialComponent = obj.components.material;
                        const scaleComponent = obj.components.scale;
                        
                        const position = positionComponent ? \`\${positionComponent.data.x} \${positionComponent.data.y} \${positionComponent.data.z}\` : 'unknown';
                        const material = materialComponent ? materialComponent.data.color : 'unknown';
                        const scale = scaleComponent ? \`\${scaleComponent.data.x} \${scaleComponent.data.y} \${scaleComponent.data.z}\` : 'unknown';
                        const objType = obj.tagName.toLowerCase();
                        
                        console.log(\`[MultiSceneQuiz] Object \${index}: type=\${objType}, scene=\${sceneId}, visible=\${visible}, position=\${position}\`);
                        console.log(\`[MultiSceneQuiz] Object \${index} details: material=\${material}, scale=\${scale}\`);
                        
                        // Check if object is actually in the scene
                        const object3D = obj.object3D;
                        if (object3D) {
                            console.log(\`[MultiSceneQuiz] Object \${index} 3D position: x=\${object3D.position.x}, y=\${object3D.position.y}, z=\${object3D.position.z}\`);
                            console.log(\`[MultiSceneQuiz] Object \${index} 3D visible: \${object3D.visible}\`);
                        }
                        
                        // Ensure proper visibility based on current scene
                        if (sceneId === '0') {
                            console.log(\`[MultiSceneQuiz] Keeping object \${index} visible (scene 0)\`);
                            obj.setAttribute('visible', 'true');
                            if (object3D) {
                                object3D.visible = true;
                                console.log(\`[MultiSceneQuiz] Force set object3D.visible = true for object \${index}\`);
                            }
                        } else {
                            console.log(\`[MultiSceneQuiz] Hiding object \${index} (scene \${sceneId})\`);
                            obj.setAttribute('visible', 'false');
                            if (object3D) {
                                object3D.visible = false;
                            }
                        }
                        
                        // Add click interaction for debugging
                        obj.addEventListener('click', () => {
                            console.log(\`[MultiSceneQuiz] Object \${index} clicked! Scene: \${sceneId}, Position: \${position}\`);
                        });
                    });
                    
                    // Debug marker events
                    const marker = document.querySelector('a-marker');
                    if (marker) {
                        console.log('[MultiSceneQuiz] AR marker found, checking marker events');
                        
                        marker.addEventListener('markerFound', () => {
                            console.log('[MultiSceneQuiz] AR marker detected! Objects should be visible now.');
                            // Force visibility update for current scene objects
                            objects.forEach((obj, index) => {
                                const sceneId = obj.getAttribute('data-scene-id');
                                if (sceneId === '0') {
                                    obj.setAttribute('visible', 'true');
                                    const object3D = obj.object3D;
                                    if (object3D) {
                                        object3D.visible = true;
                                        console.log(\`[MultiSceneQuiz] Force showing object \${index} on marker found (3D visible: \${object3D.visible})\`);
                                    } else {
                                        console.log(\`[MultiSceneQuiz] Force showing object \${index} on marker found (no 3D object)\`);
                                    }
                                }
                            });
                        });
                        
                        marker.addEventListener('markerLost', () => {
                            console.log('[MultiSceneQuiz] AR marker lost! Objects hidden.');
                        });
                    }
                }
                
                // Universo Platformo | Lead data collection functions
                ${
                    leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                        ? `
                function initializeLeadForm() {
                    console.log('[LeadCollection] Initializing lead data collection form');
                    
                    const startQuizBtn = document.getElementById('start-quiz-btn');
                    if (startQuizBtn) {
                        startQuizBtn.addEventListener('click', function() {
                            if (validateAndCollectLeadData()) {
                                hideLeadForm();
                                showQuizAfterLeadCollection();
                            }
                        });
                    }
                }
                
                function validateAndCollectLeadData() {
                    console.log('[LeadCollection] Validating lead form data');
                    
                    const nameField = document.getElementById('lead-name');
                    const emailField = document.getElementById('lead-email');
                    const phoneField = document.getElementById('lead-phone');
                    const errorElement = document.getElementById('lead-form-error');
                    
                    // Reset error
                    if (errorElement) {
                        errorElement.style.display = 'none';
                    }
                    
                    // Collect data
                    leadData.name = nameField ? nameField.value.trim() : '';
                    leadData.email = emailField ? emailField.value.trim() : '';
                    leadData.phone = phoneField ? phoneField.value.trim() : '';
                    
                    // Validate required fields
                    let isValid = true;
                    let errorMessage = '';
                    
                    ${
                        leadCollection.collectName
                            ? `
                    if (!leadData.name) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите ваше имя';
                    }`
                            : ''
                    }
                    
                    ${
                        !leadCollection.collectName && leadCollection.collectEmail
                            ? `
                    if (!leadData.email) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите ваш email';
                    } else if (leadData.email && !isValidEmail(leadData.email)) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите корректный email';
                    }`
                            : ''
                    }
                    
                    ${
                        !leadCollection.collectName && !leadCollection.collectEmail && leadCollection.collectPhone
                            ? `
                    if (!leadData.phone) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите ваш телефон';
                    }`
                            : ''
                    }
                    
                    // Validate email format if provided
                    if (leadData.email && !isValidEmail(leadData.email)) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите корректный email';
                    }
                    
                    if (!isValid) {
                        if (errorElement) {
                            errorElement.textContent = errorMessage;
                            errorElement.style.display = 'block';
                        }
                        return false;
                    }
                    
                    leadData.hasData = true;
                    console.log('[LeadCollection] Lead data collected:', {
                        name: leadData.name || 'not collected',
                        email: leadData.email || 'not collected',
                        phone: leadData.phone || 'not collected'
                    });
                    
                    return true;
                }
                
                function isValidEmail(email) {
                    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                    return emailRegex.test(email);
                }
                
                function hideLeadForm() {
                    const leadForm = document.getElementById('lead-collection-form');
                    if (leadForm) {
                        leadForm.style.display = 'none';
                    }
                }
                
                function showQuizAfterLeadCollection() {
                    console.log('[LeadCollection] Transitioning from lead form to quiz');
                    
                    const quizContainer = document.getElementById('multi-scene-quiz-container');
                    if (quizContainer) {
                        quizContainer.style.display = 'block';
                    }
                    
                    // Universo Platformo | Transition to first quiz scene (scene 1)
                    // Scene 0 had lead collection form, now we go to scene 1 with questions
                    sceneManager.setCurrentScene(1);
                    sceneManager.showCurrentScene();
                    sceneManager.showObjectsOfCurrentScene();
                    
                    console.log('[LeadCollection] Transitioned to quiz scene 1');
                }
                `
                        : '// No lead collection functions needed'
                }
            </script>
        `
    }

    /**
     * Generates quiz UI HTML elements
     * @param questions Question data nodes
     * @param answers Answer data nodes
     * @returns HTML string with quiz UI
     */
    private generateQuizUI(questions: IUPDLData[], answers: IUPDLData[]): string {
        if (questions.length === 0) return ''

        // For MVP, handle single question with multiple answers
        const question = questions[0]

        let html = `
            <!-- Universo Platformo | Quiz UI -->
            <div id="quiz-container" style="
                position: fixed; 
                top: 20px; 
                left: 20px; 
                background: rgba(0,0,0,0.8); 
                color: white; 
                padding: 20px; 
                border-radius: 10px; 
                max-width: 300px;
                z-index: 1000;
                font-family: Arial, sans-serif;
            ">
                <h3 id="quiz-question" style="margin: 0 0 15px 0; font-size: 16px;">${this.escapeHtml(question.content)}</h3>
                <div id="quiz-buttons">
        `

        // Generate answer buttons
        answers.forEach((answer, index) => {
            html += `
                    <button 
                        id="answer-btn-${index}"
                        class="quiz-answer-btn"
                        data-answer-id="${answer.id}"
                        data-is-correct="${answer.isCorrect}"
                        style="
                            display: block; 
                            width: 100%; 
                            margin: 5px 0; 
                            padding: 10px; 
                            background: #4CAF50; 
                            color: white; 
                            border: none; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 14px;
                        "
                        onmouseover="this.style.background='#45a049'"
                        onmouseout="this.style.background='#4CAF50'"
                    >
                        ${this.escapeHtml(answer.content)}
                    </button>
            `
        })

        html += `
                </div>
                <div id="quiz-feedback" style="margin-top: 15px; font-size: 14px; display: none;"></div>
            </div>
        `

        return html
    }

    /**
     * Generates quiz JavaScript logic
     * @param questions Question data nodes
     * @param answers Answer data nodes
     * @returns JavaScript string with quiz logic
     */
    private generateQuizScript(questions: IUPDLData[], answers: IUPDLData[]): string {
        return `
            <script>
                // Universo Platformo | Quiz Logic
                console.log('[Quiz] Initializing quiz functionality');
                
                // Quiz state
                let quizAnswered = false;
                
                // Initialize quiz when A-Frame scene loads
                document.addEventListener('DOMContentLoaded', function() {
                    initializeQuiz();
                });
                
                function initializeQuiz() {
                    console.log('[Quiz] Setting up quiz interactions');
                    
                    // Add click handlers to answer buttons
                    const answerButtons = document.querySelectorAll('.quiz-answer-btn');
                    answerButtons.forEach(button => {
                        button.addEventListener('click', function() {
                            if (quizAnswered) return;
                            
                            handleAnswerClick(this);
                        });
                    });
                    
                    // Add click handlers to 3D objects for interaction
                    setTimeout(() => {
                        setupObjectInteractions();
                    }, 1000); // Wait for A-Frame to initialize
                }
                
                function handleAnswerClick(button) {
                    if (quizAnswered) return;
                    
                    const isCorrect = button.getAttribute('data-is-correct') === 'true';
                    const answerId = button.getAttribute('data-answer-id');
                    
                    quizAnswered = true;
                    
                    // Visual feedback
                    if (isCorrect) {
                        button.style.background = '#4CAF50';
                        button.style.border = '3px solid #2E7D32';
                        showFeedback('Правильно! ✅', '#4CAF50');
                        highlightCorrectObject(answerId);
                    } else {
                        button.style.background = '#f44336';
                        button.style.border = '3px solid #c62828';
                        showFeedback('Неправильно ❌', '#f44336');
                        
                        // Highlight correct answer
                        const correctButton = document.querySelector('[data-is-correct="true"]');
                        if (correctButton) {
                            correctButton.style.background = '#4CAF50';
                            correctButton.style.border = '3px solid #2E7D32';
                        }
                    }
                    
                    // Disable all buttons
                    const allButtons = document.querySelectorAll('.quiz-answer-btn');
                    allButtons.forEach(btn => {
                        btn.style.opacity = '0.7';
                        btn.style.cursor = 'not-allowed';
                    });
                }
                
                function setupObjectInteractions() {
                    // Add click interactions to 3D objects
                    const objects = document.querySelectorAll('a-box, a-sphere, a-cylinder, a-plane');
                    objects.forEach((obj, index) => {
                        obj.setAttribute('animation__mouseenter', 'property: scale; to: 1.1 1.1 1.1; startEvents: mouseenter; dur: 200');
                        obj.setAttribute('animation__mouseleave', 'property: scale; to: 1 1 1; startEvents: mouseleave; dur: 200');
                        obj.setAttribute('cursor', 'rayOrigin: mouse');
                        
                        obj.addEventListener('click', function() {
                            if (!quizAnswered) {
                                // Find corresponding answer button and trigger click
                                const buttons = document.querySelectorAll('.quiz-answer-btn');
                                if (buttons[index]) {
                                    buttons[index].click();
                                }
                            }
                        });
                    });
                }
                
                function highlightCorrectObject(answerId) {
                    // For MVP, highlight by index - in future versions, use object connections
                    const buttons = document.querySelectorAll('.quiz-answer-btn');
                    let correctIndex = -1;
                    
                    buttons.forEach((btn, index) => {
                        if (btn.getAttribute('data-answer-id') === answerId) {
                            correctIndex = index;
                        }
                    });
                    
                    if (correctIndex >= 0) {
                        const objects = document.querySelectorAll('a-box, a-sphere, a-cylinder, a-plane');
                        if (objects[correctIndex]) {
                            // Add green glow effect
                            objects[correctIndex].setAttribute('animation__highlight', 
                                'property: material.color; to: #4CAF50; dur: 500; loop: 3; dir: alternate');
                        }
                    }
                }
                
                function showFeedback(message, color) {
                    const feedback = document.getElementById('quiz-feedback');
                    if (feedback) {
                        feedback.textContent = message;
                        feedback.style.color = color;
                        feedback.style.display = 'block';
                        feedback.style.fontWeight = 'bold';
                    }
                }
            </script>
        `
    }

    /**
     * Escapes HTML characters in text
     */
    private escapeHtml(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
    }

    /**
     * Universo Platformo | Generate lead data collection form
     * @param leadCollection Lead collection configuration
     * @returns HTML string with lead collection form
     */
    private generateLeadCollectionForm(leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean }): string {
        if (!leadCollection || (!leadCollection.collectName && !leadCollection.collectEmail && !leadCollection.collectPhone)) {
            return ''
        }

        let formHtml = `
            <!-- Universo Platformo | Lead Data Collection Form -->
            <div id="lead-collection-form" style="
                position: fixed; 
                top: 20px; 
                left: 20px; 
                background: rgba(0,0,0,0.9); 
                color: white; 
                padding: 25px; 
                border-radius: 15px; 
                max-width: 350px;
                z-index: 2000;
                font-family: Arial, sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; text-align: center;">
                    Введите ваши данные
                </h3>
                <div id="lead-form-fields">
        `

        if (leadCollection.collectName) {
            formHtml += `
                    <div style="margin-bottom: 15px;">
                        <label for="lead-name" style="display: block; margin-bottom: 5px; font-size: 14px;">
                            Имя *
                        </label>
                        <input 
                            type="text" 
                            id="lead-name" 
                            placeholder="Введите ваше имя"
                            style="
                                width: 100%; 
                                padding: 10px; 
                                border: none; 
                                border-radius: 8px; 
                                font-size: 14px;
                                box-sizing: border-box;
                            "
                            required
                        >
                    </div>
            `
        }

        if (leadCollection.collectEmail) {
            formHtml += `
                    <div style="margin-bottom: 15px;">
                        <label for="lead-email" style="display: block; margin-bottom: 5px; font-size: 14px;">
                            Email ${leadCollection.collectName ? '' : '*'}
                        </label>
                        <input 
                            type="email" 
                            id="lead-email" 
                            placeholder="your@email.com"
                            style="
                                width: 100%; 
                                padding: 10px; 
                                border: none; 
                                border-radius: 8px; 
                                font-size: 14px;
                                box-sizing: border-box;
                            "
                            ${!leadCollection.collectName ? 'required' : ''}
                        >
                    </div>
            `
        }

        if (leadCollection.collectPhone) {
            formHtml += `
                    <div style="margin-bottom: 20px;">
                        <label for="lead-phone" style="display: block; margin-bottom: 5px; font-size: 14px;">
                            Телефон ${!leadCollection.collectName && !leadCollection.collectEmail ? '*' : ''}
                        </label>
                        <input 
                            type="tel" 
                            id="lead-phone" 
                            placeholder="+7 (900) 123-45-67"
                            style="
                                width: 100%; 
                                padding: 10px; 
                                border: none; 
                                border-radius: 8px; 
                                font-size: 14px;
                                box-sizing: border-box;
                            "
                            ${!leadCollection.collectName && !leadCollection.collectEmail ? 'required' : ''}
                        >
                    </div>
            `
        }

        formHtml += `
                    <button 
                        id="start-quiz-btn"
                        style="
                            width: 100%; 
                            padding: 12px; 
                            background: linear-gradient(45deg, #4CAF50, #45a049); 
                            color: white; 
                            border: none; 
                            border-radius: 8px; 
                            font-size: 16px; 
                            font-weight: bold;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        "
                        onmouseover="this.style.transform='scale(1.05)'"
                        onmouseout="this.style.transform='scale(1)'"
                    >
                        Начать квиз
                    </button>
                </div>
                <div id="lead-form-error" style="
                    color: #ff6b6b; 
                    font-size: 12px; 
                    margin-top: 10px; 
                    text-align: center;
                    display: none;
                ">
                    Пожалуйста, заполните обязательные поля
                </div>
            </div>
        `

        return formHtml
    }
}
