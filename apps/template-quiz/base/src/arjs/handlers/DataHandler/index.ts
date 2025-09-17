// Universo Platformo | AR.js Data Handler (Quiz Template)
// Handles processing of UPDL Data nodes for AR.js quiz functionality

// Local types to avoid circular dependency
interface IUPDLData {
    id: string;
    name: string;
    dataType: string;
    content: string;
    isCorrect: boolean;
    [key: string]: any
}
interface IUPDLMultiScene {
    scenes: any[];
    currentSceneIndex: number;
    totalScenes: number;
    isCompleted: boolean
}
interface IUPDLScene {
    spaceId: string;
    spaceData: any;
    dataNodes: any[];
    objectNodes: any[];
    [key: string]: any
}
import { BuildOptions } from '../../../common/types'

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

            // If no data nodes, return empty content
            if (!datas || datas.length === 0) {
                return ''
            }

            // Separate data by type
            const questions = datas.filter((data) => data.dataType?.toLowerCase() === 'question')
            const answers = datas.filter((data) => data.dataType?.toLowerCase() === 'answer')


            // Generate quiz UI and logic
            let content = ''

            // Add quiz UI elements
            content += this.generateQuizUI(questions, answers)

            // Add quiz JavaScript logic
            content += this.generateQuizScript(questions, answers)

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
        // Points system configuration logged only in debug mode
        try {
            console.log(`[DataHandler] Processing multi-scene with ${multiScene.totalScenes} scenes`)

            if (!multiScene.scenes || multiScene.scenes.length === 0) {
                console.log(`[DataHandler] No scenes provided, returning empty string`)
                return ''
            }

            // Universo Platformo | Extract leadCollection from first scene
            const firstScene = multiScene.scenes.length > 0 ? multiScene.scenes[0] : null
            const leadCollection = firstScene?.spaceData?.leadCollection

            // Universo Platformo | Extract showPoints from any scene that has it enabled
            let showPointsFromScenes = false
            for (const scene of multiScene.scenes) {
                if (scene.spaceData?.showPoints || scene.spaceData?.inputs?.showPoints) {
                    showPointsFromScenes = true
                    break
                }
            }

            // Use showPoints from scenes or from options parameter
            const finalShowPoints = showPointsFromScenes || !!options.showPoints

            console.log('🔧 [DataHandler] Lead collection analysis:', {
                hasScenes: multiScene.scenes.length > 0,
                firstSceneExists: !!firstScene,
                hasSpaceData: !!firstScene?.spaceData,
                leadCollection,
                showPointsFromScenes,
                showPointsFromOptions: !!options.showPoints,
                finalShowPoints,
                sceneWithPointsFound: multiScene.scenes.findIndex(
                    (scene) => scene.spaceData?.showPoints || scene.spaceData?.inputs?.showPoints
                ),
                spaceDataKeys: firstScene?.spaceData ? Object.keys(firstScene.spaceData) : []
            })

            // Generate multi-scene UI and logic
            let content = ''

            // Add multi-scene UI elements (all scenes, but hidden initially)
            content += this.generateMultiSceneUI(multiScene, finalShowPoints, leadCollection)

            // Add multi-scene JavaScript logic with state management
            content += this.generateMultiSceneScript(multiScene, finalShowPoints, leadCollection)

            // (quiet) multi-scene generation summary suppressed

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
        // UI generation parameters logged only in debug mode

        // Universo Platformo | Count only scenes with questions (not lead collection scenes)
        const questionScenes = multiScene.scenes.filter((scene) => {
            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            return questions.length > 0
        })
        const totalQuestionScenes = questionScenes.length

        // Scene count information logged only in debug mode

        let html = ''

        // Universo Platformo | Add lead collection form if configured
        if (leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)) {
            html += this.generateLeadCollectionForm(leadCollection)
        }

        html += `
            <!-- Universo Platformo | Multi-Scene Quiz UI -->
            <div id="multi-scene-quiz-container" style="
                position: fixed;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                max-width: 300px;
                z-index: 9999;
                font-family: Arial, sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                ${leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                ? 'display: none;'
                : ''
            }
            ">
                <div id="scene-progress" style="margin-bottom: 15px; font-size: 12px; opacity: 0.8;">
                    Вопрос <span id="current-scene-number">1</span> из ${totalQuestionScenes}
                </div>
                ${showPoints
                ? `<div id="points-counter" style="margin-bottom: 15px; font-size: 14px; font-weight: bold; color: #FFD700;">
                    Баллы: <span id="current-points">0</span>
                </div>`
                : ''
            }
        `

        // Scene order and content analysis - detailed logs disabled for production

        // Generate UI for each scene (initially hidden except first)
        multiScene.scenes.forEach((scene, sceneIndex) => {
            const isVisible = sceneIndex === 0

            // Data analysis for scene - detailed logs disabled for production

            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            const answers = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'answer')

            // Scene content summary - detailed logs disabled for production

            // Scene visibility and content logged only in debug mode

            // Universo Platformo | Generate results screen for final scene with showPoints and no data
            if (scene.isResultsScene) {
                html += `
                    <div id="scene-${sceneIndex}" class="quiz-scene quiz-results-scene" style="display: ${isVisible ? 'block' : 'none'};">
                        <div class="results-content" style="text-align: center;">
                            <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #FFD700;">
                                🎉 Квиз завершен!
                            </h2>
                            <div class="score-display" style="margin: 20px 0;">
                                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 5px;">Ваш результат:</div>
                                <div style="font-size: 24px; font-weight: bold; color: #FFD700;">
                                    <span id="final-score">0</span> баллов
                                </div>
                            </div>
                            <div id="performance-message" style="margin: 15px 0; font-size: 14px; opacity: 0.9;">
                                <!-- Universo Platformo | Dynamic message -->
                            </div>
                            <!-- Universo Platformo | Temporarily hidden restart button - will be fixed later
                            <button id="restart-quiz-btn" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 25px;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                margin-top: 15px;
                                transition: transform 0.2s ease;
                            " 
                            onmouseover="this.style.transform='scale(1.05)'"
                            onmouseout="this.style.transform='scale(1)'">
                                🔄 Начать сначала
                            </button>
                            -->
                        </div>
                    </div>
                `
                // Results screen generation logged only in debug mode
            } else if (questions.length > 0) {
                const question = questions[0]

                html += `
                    <div id="scene-${sceneIndex}" class="quiz-scene" style="display: ${isVisible ? 'block' : 'none'};">
                        <h3 id="quiz-question-${sceneIndex}" style="margin: 0 0 15px 0; font-size: 16px;">
                            ${this.escapeHtml(question.content)}
                        </h3>
                        <div id="quiz-buttons-${sceneIndex}">
                `

                // HTML generation for scene - detailed logs disabled for production

                // Generate answer buttons for this scene
                answers.forEach((answer, answerIndex) => {
                    // Answer processing - detailed logs disabled for production

                    // Universo Platformo | Get corresponding object for thumbnail
                    const correspondingObject = scene.objectNodes && scene.objectNodes[answerIndex] ? scene.objectNodes[answerIndex] : null
                    const objectThumbnail = correspondingObject ? this.generateObjectThumbnail(correspondingObject, 20) : ''

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
                                    display: flex;
                                    align-items: center;
                                    width: 100%; 
                                    margin: 5px 0; 
                                    padding: 10px; 
                                    background: #4CAF50; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 5px; 
                                    cursor: pointer;
                                    font-size: 14px;
                                    text-align: left;
                                "
                                onmouseover="this.style.background='#45a049'"
                                onmouseout="this.style.background='#4CAF50'"
                            >
                                ${objectThumbnail}
                                <span style="flex: 1;">${this.escapeHtml(answer.content)}</span>
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

        // Final HTML structure - detailed logs disabled for production

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
        // Script generation parameters logged only in debug mode

        // Universo Platformo | Count only scenes with questions (not lead collection scenes)
        const questionScenes = multiScene.scenes.filter((scene) => {
            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            return questions.length > 0
        })
        const totalQuestionScenes = questionScenes.length

        // Universo Platformo | Map scene indices to question numbers
        const sceneToQuestionMap: { [key: number]: number } = {}
        let questionNumber = 1
        multiScene.scenes.forEach((scene, sceneIndex) => {
            const questions = scene.dataNodes.filter((data) => data.dataType?.toLowerCase() === 'question')
            if (questions.length > 0) {
                sceneToQuestionMap[sceneIndex] = questionNumber++
            }
        })

        // Scene mapping logged only in debug mode

    return `
            <script>
                // Universo Platformo | Multi-Scene Quiz Logic
        // Lightweight debug facility
        const QUIZ_DEBUG = false; // flip to true for verbose diagnostics
        const dbg = (...args) => { if (QUIZ_DEBUG) console.log(...args); };
        console.log('[MultiSceneQuiz] Init');
                
                // Universo Platformo | Scene to question number mapping
                const sceneToQuestionMap = ${JSON.stringify(sceneToQuestionMap)};
                const totalQuestionScenes = ${totalQuestionScenes};
                
                // Universo Platformo | Lead data collection variables
                let leadData = {
                    name: '',
                    email: '',
                    phone: '',
                    hasData: false
                };
                
                // Universo Platformo | Global flag to prevent duplicate lead saves
                let leadSaved = false;
                
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
                        dbg(\`[PointsManager] +\${points} => \${this.currentPoints}\`);
                    }

                    updateDisplay() {
                        if (this.pointsElement) {
                            this.pointsElement.textContent = this.currentPoints;
                        }
                    }

                    getCurrentPoints() {
                        return this.currentPoints;
                    }
                    
                    // Universo Platformo | Reset points for quiz restart
                    reset() {
                        this.currentPoints = 0;
                        this.updateDisplay();
                        dbg('[PointsManager] reset');
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
                            dbg(\`[MultiSceneQuiz] forceScene=\${sceneIndex}\`);
                        }
                    }

                    nextScene() {
                        if (this.currentSceneIndex < this.totalScenes - 1) {
                            this.currentSceneIndex++;
                            this.sceneAnswered = false;

                            // Universo Platformo | Auto-skip empty scenes (scenes with no questions)
                            const allScenes = ${JSON.stringify(multiScene.scenes)};
                            const currentScene = allScenes[this.currentSceneIndex];
                            const questions = currentScene?.dataNodes?.filter(data => data.dataType?.toLowerCase() === 'question') || [];

                            if (questions.length === 0 && !currentScene?.isResultsScene) {
                                console.log(\`[MultiSceneQuiz] Scene \${this.currentSceneIndex} is empty, auto-skipping to next scene\`);
                                return this.nextScene(); // Recursively skip empty scenes
                            }

                            this.showCurrentScene();
                            this.hideObjectsOfPreviousScene();
                            this.showObjectsOfCurrentScene();
                            return true;
                        }
                        this.isCompleted = true;
                            dbg('[MultiSceneQuiz] completed flag');
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
                        
                        // Update progress indicator with correct question number
                        const progressElement = document.getElementById('current-scene-number');
                        const progressContainer = document.getElementById('scene-progress');
                        
                        if (progressElement && progressContainer) {
                            // Use mapping to get correct question number (only for scenes with questions)
                            const questionNumber = sceneToQuestionMap[this.currentSceneIndex];
                            if (questionNumber) {
                                progressElement.textContent = questionNumber;
                                progressContainer.style.display = 'block';
                                dbg(\`[MultiSceneQuiz] Q#=\${questionNumber} scene=\${this.currentSceneIndex}\`);
                            } else {
                                // This scene has no questions (e.g., lead collection), hide progress
                                progressContainer.style.display = 'none';
                                dbg(\`[MultiSceneQuiz] scene=\${this.currentSceneIndex} noQuestions progress hidden\`);
                            }
                        }
                        dbg(\`[MultiSceneQuiz] show scene=\${this.currentSceneIndex}\`);

                        // Universo Platformo | If the scene we just showed is a results screen, immediately display the results summary
                        if (currentScene && currentScene.classList.contains('quiz-results-scene')) {
                            dbg('[MultiSceneQuiz] enter results scene');
                            showQuizResults(pointsManager.getCurrentPoints());
                        }
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
                    
                    // Universo Platformo | Reset quiz state for restart
                    reset() {
                        this.currentSceneIndex = 0;
                        this.sceneAnswered = false;
                        this.isCompleted = false;
                        console.log('[SceneStateManager] Quiz state reset');
                    }
                    
                    // Universo Platformo | Get current scene index for results detection
                    getCurrentSceneIndex() {
                        return this.currentSceneIndex;
                    }
                }

                // Initialize scene manager and points manager
                const sceneManager = new SceneStateManager(${multiScene.totalScenes});
                // Universo Platformo | Always create pointsManager for data saving, but only display if showPoints is true
                const pointsManager = new PointsManager();
                
                // Initialize quiz when A-Frame scene loads
                document.addEventListener('DOMContentLoaded', function() {
                    initializeMultiSceneQuiz();
                });
                
                function initializeMultiSceneQuiz() {
                        dbg('[MultiSceneQuiz] setup interactions');
                    
                    // Universo Platformo | Lead form initialization
                    ${leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                ? 'initializeLeadForm();'
                : '// No lead collection configured'
            }
                    
                    // Universo Platformo | Debug initial state
                    dbg(\`[MultiSceneQuiz] start sceneIndex=\${sceneManager.getCurrentScene()}\`);
                    
                    // Initialize first scene display
                    sceneManager.showCurrentScene();
                    
                    // Initialize points manager (always needed for data saving)
                    pointsManager.initialize();
                    
                    // Universo Platformo | Debug scene elements after initialization
                    // (verbose scene enumeration removed; re-enable via QUIZ_DEBUG if needed)
                    
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
                    
                    // Universo Platformo | Process points (always track for data saving)
                    const enablePoints = button.getAttribute('data-enable-points') === 'true';
                    const pointsValue = parseInt(button.getAttribute('data-points-value')) || 0;
                    
                    // Add points for correct answers (default 1 point if not specified)
                    if (isCorrect) {
                        const pointsToAdd = (enablePoints && pointsValue > 0) ? pointsValue : 1;
                        pointsManager.addPoints(pointsToAdd);
                        console.log(\`[MultiSceneQuiz] Added \${pointsToAdd} points for correct answer\`);
                    }
                    
                    sceneManager.markSceneAnswered();
                    
                    // Visual feedback
                    if (isCorrect) {
                        button.style.background = '#4CAF50';
                        button.style.border = '3px solid #2E7D32';
                        showSceneFeedback(sceneIndex, 'Правильно! ✅', '#4CAF50');
                        
                        // Universo Platformo | Highlight correct 3D object with scale effect
                        highlightCorrectObjectMultiScene(answerId, sceneIndex);
                    } else {
                        button.style.background = '#f44336';
                        button.style.border = '3px solid #c62828';
                        showSceneFeedback(sceneIndex, 'Неправильно ❌', '#f44336');
                        
                        // Highlight correct answer button
                        const correctButton = document.querySelector(\`[data-scene-index="\${sceneIndex}"][data-is-correct="true"]\`);
                        if (correctButton) {
                            correctButton.style.background = '#4CAF50';
                            correctButton.style.border = '3px solid #2E7D32';
                            
                            // Universo Platformo | Also highlight the correct 3D object
                            const correctAnswerId = correctButton.getAttribute('data-answer-id');
                            if (correctAnswerId) {
                                highlightCorrectObjectMultiScene(correctAnswerId, sceneIndex);
                            }
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
                            // NOTE: Lead saving now handled in showQuizResults (results) or here for non-results ending
                            // Just mark completion; do not save here to avoid timing issues with results scene rendering

                            // Universo Platformo | Check if current scene is results scene to decide where to save
                            const currentSceneIndex = sceneManager.getCurrentSceneIndex();
                            const allScenes = ${JSON.stringify(multiScene.scenes)};
                            const currentScene = allScenes[currentSceneIndex];

                            console.log('[MultiSceneQuiz] Quiz completion check - currentSceneIndex:', currentSceneIndex);
                            console.log('[MultiSceneQuiz] Current scene:', currentScene);
                            console.log('[MultiSceneQuiz] Current points before results:', pointsManager.getCurrentPoints());

                            if (currentScene && currentScene.isResultsScene) {
                                console.log('[MultiSceneQuiz] Showing results screen (lead save deferred to showQuizResults)');
                                showQuizResults(pointsManager.getCurrentPoints(), /*fromCompletion*/ true);
                            } else {
                                console.log('[MultiSceneQuiz] Quiz completed without results screen – performing immediate lead save');
                                if (!leadSaved) {
                                    if (!leadData.hasData) {
                                        leadData.name = null;
                                        leadData.email = null;
                                        leadData.phone = null;
                                        leadData.hasData = true;
                                        console.log('[MultiSceneQuiz] (NoForm) Creating basic completion lead payload before save');
                                    }
                                    saveLeadDataToSupabase(leadData, pointsManager.getCurrentPoints(), 'no-results-ending');
                                } else {
                                    console.log('[MultiSceneQuiz] Lead already saved earlier, skipping immediate save');
                                }
                            }
                        } else {
                            // Navigating to the next scene no longer calls showQuizResults here,
                            // since showCurrentScene already handles displaying the scene results and calling showQuizResults.
                            // This prevents a double call and a potential lead save race.
                        }
                    }, 1000);
                }

                // Universo Platformo | Highlight correct object with scale effect (multi-scene version)
                function highlightCorrectObjectMultiScene(answerId, sceneIndex) {
                        dbg(\`[MultiSceneQuiz] highlight answer=\${answerId} scene=\${sceneIndex}\`);
                    
                    // Find all answer buttons for current scene
                    const buttons = document.querySelectorAll(\`[data-scene-index="\${sceneIndex}"][data-answer-id]\`);
                    let correctIndex = -1;
                    
                    // Determine the index of the correct answer button
                    buttons.forEach((btn, index) => {
                        if (btn.getAttribute('data-answer-id') === answerId) {
                            correctIndex = index;
                        }
                    });
                    
                    if (correctIndex >= 0) {
                        // Find all objects for current scene
                        const sceneObjects = document.querySelectorAll(\`[data-scene-id="\${sceneIndex}"]\`);
                        
                        if (sceneObjects[correctIndex]) {
                            const targetObject = sceneObjects[correctIndex];
                            dbg(\`[MultiSceneQuiz] scaleFX objectIndex=\${correctIndex}\`);
                            
                            // Universo Platformo | Apply scale effect instead of color change
                            // Scale up to 115% and back 3 times with smooth animation
                            targetObject.setAttribute('animation__highlight_scale', 
                                'property: scale; to: 1.15 1.15 1.15; dur: 400; loop: 3; dir: alternate; easing: easeInOutQuad');
                                
                            // Add a subtle glow effect using emission
                            targetObject.setAttribute('animation__highlight_glow', 
                                'property: material.emissive; to: #FFD700; dur: 400; loop: 3; dir: alternate; easing: easeInOutQuad');
                                
                            console.log(\`[MultiSceneQuiz] Scale effect applied successfully to \${targetObject.tagName} at index \${correctIndex}\`);
                        } else {
                            dbg(\`[MultiSceneQuiz] !object index=\${correctIndex} scene=\${sceneIndex}\`);
                        }
                    } else {
                        dbg(\`[MultiSceneQuiz] !button answer=\${answerId} scene=\${sceneIndex}\`);
                    }
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
                ${leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                ? `
                function initializeLeadForm() {
                    dbg('[LeadCollection] init form');
                    
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
                    dbg('[LeadCollection] validate form');
                    
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
                    
                    ${leadCollection.collectName
                    ? `
                    if (!leadData.name) {
                        isValid = false;
                        errorMessage = 'Пожалуйста, введите ваше имя';
                    }`
                    : ''
                }
                    
                    ${!leadCollection.collectName && leadCollection.collectEmail
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
                    
                    ${!leadCollection.collectName && !leadCollection.collectEmail && leadCollection.collectPhone
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
                    dbg('[LeadCollection] collected');
                    
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
                
                // Universo Platformo | Save lead data to Supabase when quiz completes
                async function saveLeadDataToSupabase(leadInfo, totalPoints = 0, origin = 'unknown') {
                    if (!leadInfo.hasData) {
                        dbg('[LeadCollection] skip save (no data) origin=' + origin);
                        return;
                    }
                    
                    // Prevent duplicate save using global flag
                    if (leadSaved) {
                        dbg('[LeadCollection] duplicate save blocked origin=' + origin);
                        return;
                    }
                    
                    try {
                        console.log('[LeadCollection] Attempting save (origin=' + origin + ')');
                        
                        const leadPayload = {
                            canvasid: window.canvasId || window.chatflowId || null,
                            chatflowid: window.chatflowId || window.canvasId || null, // Backward compatibility
                            name: leadInfo.name || null,
                            email: leadInfo.email || null,
                            phone: leadInfo.phone || null,
                            points: totalPoints, // Dedicated field for points
                            createdDate: new Date().toISOString()
                        };
                        
                        dbg('[LeadCollection] payload', leadPayload);
                        if (!leadPayload.chatflowid && !leadPayload.canvasid) {
                            console.warn('[LeadCollection] WARNING: Both canvasid and chatflowid are null');
                        }
                        
                        const response = await fetch('/api/v1/leads', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(leadPayload)
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            console.log('[LeadCollection] Saved (origin=' + origin + ')');
                            leadSaved = true; // Set global flag to prevent duplicate saves
                        } else {
                            console.error('[LeadCollection] Failed to save lead data (origin=' + origin + '):', response.status, response.statusText);
                        }
                    } catch (error) {
                        console.error('[LeadCollection] Error saving lead data (origin=' + origin + '):', error);
                    }
                }
                
                // Universo Platformo | Quiz results and restart functions
                function showQuizResults(totalPoints, fromCompletionFlag) {
                    console.log('[QuizResults] Results screen points=' + totalPoints);
                    dbg('[QuizResults] ctx fromCompletion=' + fromCompletionFlag + ' leadSaved=' + leadSaved + ' hasData=' + leadData.hasData);
                    // Attempt guarded save here (primary point for results-ending quizzes)
                    if (!leadSaved) {
                        if (!leadData.hasData) {
                            leadData.name = null;
                            leadData.email = null;
                            leadData.phone = null;
                            leadData.hasData = true;
                            dbg('[QuizResults] synth basic payload');
                        }
                        saveLeadDataToSupabase(leadData, totalPoints, fromCompletionFlag ? 'results-completion-path' : 'results-navigation-path');
                    } else {
                        dbg('[QuizResults] save already done');
                    }
                    
                    // Hide the main points counter to avoid duplication
                    const pointsCounter = document.getElementById('points-counter');
                    if (pointsCounter) {
                        pointsCounter.style.display = 'none';
                    }
                    
                    // Hide the progress indicator
                    const progressContainer = document.getElementById('scene-progress');
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                    
                    // Update final score display
                    const finalScoreElement = document.getElementById('final-score');
                    if (finalScoreElement) {
                        dbg('[QuizResults] set final score');
                        // Set the score immediately without animation for now
                        finalScoreElement.textContent = totalPoints;
                        dbg('[QuizResults] final score element updated');
                    }
                    
                    // Generate performance message
                    const performanceMessage = generatePerformanceMessage(totalPoints, ${totalQuestionScenes});
                    dbg('[QuizResults] perf msg');
                    const messageElement = document.getElementById('performance-message');
                    if (messageElement) {
                        messageElement.innerHTML = performanceMessage;
                        dbg('[QuizResults] perf msg applied');
                    } else {
                        console.error('[QuizResults] Performance message element not found');
                    }
                    
                    // Universo Platformo | Restart button temporarily disabled
                    // Setup restart button (remove existing listeners first)
                    // const restartBtn = document.getElementById('restart-quiz-btn');
                    // if (restartBtn) {
                    //     // Clone button to remove all existing event listeners
                    //     const newRestartBtn = restartBtn.cloneNode(true);
                    //     restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
                    //     
                    //     // Add new event listener
                    //     newRestartBtn.addEventListener('click', restartQuiz);
                    // }
                    
                    // Note: Lead data save executed above (guarded)
                }
                
                function animateScoreCount(element, targetScore) {
                    console.log('[QuizResults] Animating score count from 0 to', targetScore);
                    
                    // If target score is 0, just set it immediately
                    if (targetScore === 0) {
                        element.textContent = '0';
                        return;
                    }
                    
                    // Start with 0 and animate to target
                    let currentScore = 0;
                    element.textContent = currentScore;
                    
                    const increment = Math.max(1, Math.floor(targetScore / 10)) || 1;
                    
                    const interval = setInterval(() => {
                        currentScore += increment;
                        if (currentScore >= targetScore) {
                            currentScore = targetScore;
                            clearInterval(interval);
                        }
                        element.textContent = currentScore;
                        console.log('[QuizResults] Score animation step:', currentScore, 'target:', targetScore);
                    }, 100);
                }
                
                function generatePerformanceMessage(points, totalQuestions) {
                    const maxPossiblePoints = totalQuestions; // 1 point per correct answer
                    const percentage = totalQuestions > 0 ? Math.round((points / maxPossiblePoints) * 100) : 0;
                    
                    console.log(\`[QuizResults] Performance calculation: \${points}/\${maxPossiblePoints} = \${percentage}%\`);
                    
                    if (percentage >= 90) {
                        return '🏆 Превосходно! Вы настоящий эксперт!';
                    } else if (percentage >= 70) {
                        return '🎯 Отлично! Хороший результат!';
                    } else if (percentage >= 50) {
                        return '👍 Хорошо! Есть куда расти!';
                    } else {
                        return '💪 Не расстраивайтесь! Попробуйте еще раз!';
                    }
                }
                
                function restartQuiz() {
                    console.log('[QuizResults] Restarting quiz');
                    
                    // Reset quiz state
                    sceneManager.reset();
                    pointsManager.reset();
                    
                    // Reset lead data for new attempt
                    leadData.hasData = false;
                    leadData.saved = false;
                    leadData.name = '';
                    leadData.email = '';
                    leadData.phone = '';
                    
                    // Show the main points counter and progress again
                    const pointsCounter = document.getElementById('points-counter');
                    if (pointsCounter) {
                        pointsCounter.style.display = 'block';
                    }
                    
                    const progressContainer = document.getElementById('scene-progress');
                    if (progressContainer) {
                        progressContainer.style.display = 'block';
                    }
                    
                    // Re-enable all answer buttons
                    const allButtons = document.querySelectorAll('.quiz-answer-btn');
                    allButtons.forEach(btn => {
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        btn.disabled = false;
                    });
                    
                    // Hide results screen and show appropriate starting screen
                    ${leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                    ? `
                    // Show lead collection form again
                    const leadForm = document.getElementById('lead-collection-form');
                    const quizContainer = document.getElementById('multi-scene-quiz-container');
                    
                    if (leadForm) {
                        leadForm.style.display = 'block';
                        // Reset form fields
                        const nameField = document.getElementById('lead-name');
                        const emailField = document.getElementById('lead-email');
                        const phoneField = document.getElementById('lead-phone');
                        if (nameField) nameField.value = '';
                        if (emailField) emailField.value = '';
                        if (phoneField) phoneField.value = '';
                    }
                    
                    if (quizContainer) {
                        quizContainer.style.display = 'none';
                    }`
                    : `
                    // Start directly with first quiz scene
                    sceneManager.setCurrentScene(1); // Start with scene 1 (first question scene)
                    sceneManager.showCurrentScene();
                    sceneManager.showObjectsOfCurrentScene();`
                }
                    
                    console.log('[QuizResults] Quiz restarted successfully');
                }
                
                function showQuizAfterLeadCollection() {
                    console.log('[LeadCollection] Transitioning from lead form to quiz');
                    
                    const quizContainer = document.getElementById('multi-scene-quiz-container');
                    if (quizContainer) {
                        quizContainer.style.display = 'block';
                    }
                    
                    // Universo Platformo | Show progress indicator now that we're starting quiz
                    const progressContainer = document.getElementById('scene-progress');
                    if (progressContainer) {
                        progressContainer.style.display = 'block';
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
                bottom: 10px; 
                left: 50%; 
                transform: translateX(-50%);
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
                            // Universo Platformo | Apply scale effect instead of color change
                            // Scale up to 115% and back 3 times with smooth animation
                            objects[correctIndex].setAttribute('animation__highlight_scale', 
                                'property: scale; to: 1.15 1.15 1.15; dur: 400; loop: 3; dir: alternate; easing: easeInOutQuad');
                                
                            // Optional: Add a subtle glow effect using emission
                            objects[correctIndex].setAttribute('animation__highlight_glow', 
                                'property: material.emissive; to: #FFD700; dur: 400; loop: 3; dir: alternate; easing: easeInOutQuad');
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
     * Universo Platformo | Generate CSS thumbnail for an object
     * @param object UPDL object
     * @param size Size of the thumbnail in pixels
     * @returns HTML string with CSS thumbnail
     */
    private generateObjectThumbnail(object: any, size: number = 24): string {
        if (!object || !object.type) {
            return `<div style="
                display: inline-block;
                width: ${size}px;
                height: ${size}px;
                margin-right: 8px;
                vertical-align: middle;
                background-color: #cccccc;
                border-radius: 2px;
                border: 1px solid rgba(255,255,255,0.3);
            "></div>`
        }

        // Get color from object (matching ObjectHandler logic)
        let color = '#FF0000' // default red

        // Legacy format support (direct color string)
        if (typeof object.color === 'string') {
            color = object.color
        }
        // New format support (material.color object)
        else if (object.material?.color) {
            const { r, g, b } = object.material.color
            // Convert RGB (0-1) to hex
            const toHex = (c: number) =>
                Math.round(c * 255)
                    .toString(16)
                    .padStart(2, '0')
            color = `#${toHex(r)}${toHex(g)}${toHex(b)}`
        }

        const baseStyle = `
            display: inline-block;
            width: ${size}px;
            height: ${size}px;
            margin-right: 8px;
            vertical-align: middle;
            background-color: ${color};
            border: 1px solid rgba(255,255,255,0.3);
        `

        switch (object.type.toLowerCase()) {
            case 'box':
                return `<div style="${baseStyle} border-radius: 2px;"></div>`

            case 'sphere':
                return `<div style="${baseStyle} border-radius: 50%;"></div>`

            case 'cylinder':
                return `<div style="${baseStyle} border-radius: ${size / 4}px;"></div>`

            case 'plane':
                return `<div style="${baseStyle} border-radius: 1px; height: ${size / 2}px; margin-top: ${size / 4}px;"></div>`

            case 'cone':
                return `<div style="${baseStyle} clip-path: polygon(50% 0%, 0% 100%, 100% 100%); border-radius: 2px;"></div>`

            case 'circle':
                return `<div style="${baseStyle} border-radius: 50%; border-width: 2px; background: transparent; border-color: ${color};"></div>`

            default:
                // Default to box for unknown types
                return `<div style="${baseStyle} border-radius: 2px;"></div>`
        }
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
                bottom: 10px; 
                left: 50%; 
                transform: translateX(-50%);
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
