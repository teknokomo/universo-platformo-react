// Universo Platformo | AR.js Data Handler (Quiz Template)
// Handles processing of UPDL Data nodes for AR.js quiz functionality

// Local types to avoid circular dependency
interface IUPDLData {
    id: string
    name: string
    dataType: string
    content: string
    isCorrect: boolean
    [key: string]: any
}
interface IUPDLMultiScene {
    scenes: any[]
    currentSceneIndex: number
    totalScenes: number
    isCompleted: boolean
}
interface IUPDLScene {
    spaceId: string
    spaceData: any
    dataNodes: any[]
    objectNodes: any[]
    [key: string]: any
}
import { BuildOptions } from '../../../common/types'

const DATA_HANDLER_DEBUG = false
const debugLog = (...args: any[]) => {
    if (DATA_HANDLER_DEBUG) {
        console.log(...args)
    }
}

/**
 * Processes UPDL Data nodes for AR.js quiz generation
 */
export class DataHandler {
    // Universo Platformo | Global points counter for quiz
    private currentPoints: number = 0

    // Universo Platformo | UI Constants for safe timer integration
    private static readonly TIMER_Z_INDEX = 9998 // Below quiz container (9999)
    private static readonly QUIZ_CONTAINER_Z_INDEX = 9999

    private static readonly WARNING_THRESHOLD_SECONDS = 30
    private static readonly DANGER_THRESHOLD_SECONDS = 10

    private static readonly TIMER_POSITIONS = {
        'top-left': { top: '10px', left: '10px', right: 'auto', bottom: 'auto', transform: 'none' },
        'top-center': { top: '10px', left: '50%', right: 'auto', bottom: 'auto', transform: 'translateX(-50%)' },
        'top-right': { top: '10px', right: '10px', left: 'auto', bottom: 'auto', transform: 'none' },
        'bottom-left': { bottom: '80px', left: '10px', right: 'auto', top: 'auto', transform: 'none' },
        'bottom-right': { bottom: '80px', right: '10px', left: 'auto', top: 'auto', transform: 'none' }
    }

    private static readonly DEFAULT_TIMER_CONFIG = {
        enabled: false,
        limitSeconds: 60,
        position: 'top-center' as const
    }

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
    processMultiScene(
        multiScene: IUPDLMultiScene,
        options: BuildOptions & { showPoints?: boolean; interactionMode?: 'buttons' | 'nodes' } = {}
    ): string {
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

            debugLog('🔧 [DataHandler] Lead collection analysis:', {
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

            // Universo Platformo | Extract and validate timer configuration
            const timerConfig = options.timerConfig || DataHandler.DEFAULT_TIMER_CONFIG
            const safeTimerConfig = {
                enabled: timerConfig.enabled === true,
                limitSeconds: Math.max(10, Math.min(3600, timerConfig.limitSeconds || 60)),
                position: (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'] as const).includes(
                    timerConfig.position as any
                )
                    ? (timerConfig.position as string)
                    : 'top-center'
            }

            debugLog('🔧 [DataHandler] Timer configuration:', safeTimerConfig)

            // Get interaction mode (default to 'buttons' for backward compatibility)
            const interactionMode = options.interactionMode || 'buttons'
            debugLog('🔧 [DataHandler] Interaction mode:', interactionMode)

            // Generate multi-scene UI and logic
            let content = ''

            // Add multi-scene UI elements based on interaction mode
            if (interactionMode === 'nodes') {
                content += this.generateNodeBasedUI(multiScene, finalShowPoints, leadCollection, safeTimerConfig)
            } else {
                content += this.generateMultiSceneUI(multiScene, finalShowPoints, leadCollection, safeTimerConfig)
            }

            // Add multi-scene JavaScript logic based on interaction mode
            if (interactionMode === 'nodes') {
                content += this.generateNodeBasedScript(multiScene, finalShowPoints, leadCollection, safeTimerConfig)
            } else {
                content += this.generateMultiSceneScript(multiScene, finalShowPoints, leadCollection, safeTimerConfig)
            }

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
     * @param timerConfig Timer configuration
     * @returns HTML string with multi-scene quiz UI
     */
    private generateMultiSceneUI(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean },
        timerConfig?: { enabled: boolean; limitSeconds: number; position: string }
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

        // Universo Platformo | Add timer UI if enabled
        if (timerConfig?.enabled) {
            const position =
                DataHandler.TIMER_POSITIONS[timerConfig.position as keyof typeof DataHandler.TIMER_POSITIONS] ||
                DataHandler.TIMER_POSITIONS['top-center']

            html += `
            <!-- Universo Platformo | Timer Display -->
            <div id="quiz-timer" style="
                position: fixed;
                top: ${position.top};
                right: ${position.right};
                bottom: ${position.bottom};
                left: ${position.left};
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                font-weight: bold;
                z-index: ${DataHandler.TIMER_Z_INDEX};
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                min-width: 80px;
                text-align: center;
                transform: ${position.transform};
                display: none;
            ">
                ⏱️ <span id="timer-display">--:--</span>
            </div>
            `
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
                ${
                    leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                        ? 'display: none;'
                        : ''
                }
            ">
                <div id="scene-progress" style="margin-bottom: 15px; font-size: 12px; opacity: 0.8;">
                    Вопрос <span id="current-scene-number">1</span> из ${totalQuestionScenes}
                </div>
                ${
                    showPoints
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
     * @param timerConfig Timer configuration
     * @returns JavaScript string with multi-scene logic
     */
    private generateMultiSceneScript(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean },
        timerConfig?: { enabled: boolean; limitSeconds: number; position: string }
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
        dbg('[MultiSceneQuiz] Init');
                
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
                
                // Universo Platformo | Timer management system
                ${
                    timerConfig?.enabled
                        ? `
                const RESULTS_SCENE_INDEX = ${multiScene.scenes.findIndex((scene) => scene.isResultsScene)};

                class TimerManager {
                    constructor(limitSeconds) {
                        this.limitSeconds = Math.max(10, Number(limitSeconds) || 60);
                        this.timeRemaining = this.limitSeconds;
                        this.frameId = null;
                        this.deadline = null;
                        this.isRunning = false;
                        this.timerDisplay = null;
                        this.timerContainer = null;
                        this.now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

                        this.WARNING_THRESHOLD = ${DataHandler.WARNING_THRESHOLD_SECONDS};
                        this.DANGER_THRESHOLD = ${DataHandler.DANGER_THRESHOLD_SECONDS};
                    }

                    initialize() {
                        this.timerDisplay = document.getElementById('timer-display');
                        this.timerContainer = document.getElementById('quiz-timer');
                        this.updateDisplay(this.limitSeconds * 1000);
                        dbg('[TimerManager] initialized', this.limitSeconds + 's');
                    }

                    start() {
                        if (this.isRunning) return;

                        this.deadline = this.now() + this.limitSeconds * 1000;
                        this.timeRemaining = this.limitSeconds;
                        this.isRunning = true;

                        if (this.timerContainer) {
                            this.timerContainer.style.display = 'block';
                        }

                        this.scheduleFrame();
                        dbg('[TimerManager] Started:', this.limitSeconds + 's');
                    }

                    scheduleFrame() {
                        this.frameId = requestAnimationFrame((timestamp) => this.onFrame(timestamp));
                    }

                    onFrame(timestamp) {
                        if (!this.isRunning) return;

                        const remainingMs = Math.max(0, this.deadline - timestamp);
                        this.timeRemaining = Math.ceil(remainingMs / 1000);
                        this.updateDisplay(remainingMs);

                        if (remainingMs <= 0) {
                            this.stop();
                            this.onTimeExpired();
                            return;
                        }

                        this.scheduleFrame();
                    }

                    updateDisplay(remainingMs) {
                        if (!this.timerDisplay) return;

                        const secondsLeft = Math.max(0, typeof remainingMs === 'number' ? Math.ceil(remainingMs / 1000) : this.timeRemaining);
                        const minutes = Math.floor(secondsLeft / 60);
                        const seconds = secondsLeft % 60;
                        const formattedTime = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

                        this.timerDisplay.textContent = formattedTime;

                        if (this.timerContainer) {
                            if (secondsLeft <= this.DANGER_THRESHOLD) {
                                this.timerContainer.style.background = 'rgba(244, 67, 54, 0.95)';
                            } else if (secondsLeft <= this.WARNING_THRESHOLD) {
                                this.timerContainer.style.background = 'rgba(255, 152, 0, 0.95)';
                            } else {
                                this.timerContainer.style.background = 'rgba(0, 0, 0, 0.85)';
                            }
                        }
                    }

                    stop() {
                        if (this.frameId) {
                            cancelAnimationFrame(this.frameId);
                            this.frameId = null;
                        }
                        this.isRunning = false;
                        this.deadline = null;
                        dbg('[TimerManager] Stopped');

                        if (this.timerContainer) {
                            this.timerContainer.style.display = 'none';
                        }
                    }

                    reset() {
                        this.stop();
                        this.timeRemaining = this.limitSeconds;
                        this.updateDisplay(this.limitSeconds * 1000);
                        if (this.timerContainer) {
                            this.timerContainer.style.display = 'none';
                        }
                        dbg('[TimerManager] reset');
                    }

                    onTimeExpired() {
                        dbg('[TimerManager] ⏰ Time expired! Showing results...');

                        // Prevent further interactions
                        const answerButtons = document.querySelectorAll('.quiz-answer-btn');
                        answerButtons.forEach((btn) => {
                            btn.disabled = true;
                            btn.style.cursor = 'not-allowed';
                            btn.style.opacity = '0.6';
                        });

                        sceneManager.isCompleted = true;

                        if (typeof RESULTS_SCENE_INDEX === 'number' && RESULTS_SCENE_INDEX >= 0) {
                            sceneManager.setCurrentScene(RESULTS_SCENE_INDEX);
                            sceneManager.showCurrentScene();
                            sceneManager.showObjectsOfCurrentScene();
                        } else {
                            showQuizResults(pointsManager.getCurrentPoints(), /*fromCompletion*/ false);
                        }
                    }
                }

                const timerManager = new TimerManager(${timerConfig.limitSeconds});
                `
                        : ''
                }
                
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
                    ${
                        leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                            ? 'initializeLeadForm();'
                            : '// No lead collection configured'
                    }
                    
                    // Universo Platformo | Debug initial state
                    dbg(\`[MultiSceneQuiz] start sceneIndex=\${sceneManager.getCurrentScene()}\`);
                    
                    // Initialize first scene display
                    sceneManager.showCurrentScene();
                    
                    // Initialize points manager (always needed for data saving)
                    pointsManager.initialize();
                    
                    // Universo Platformo | Initialize timer manager
                    ${
                        timerConfig?.enabled
                            ? `
                    timerManager.initialize();
                    
                    // Auto-start timer if no lead collection
                    ${
                        !leadCollection
                            ? `
                    setTimeout(() => {
                        if (timerManager && !timerManager.isRunning) {
                            timerManager.start();
                        }
                    }, 500);
                    `
                            : '// Timer will start after lead form'
                    }
                    `
                            : '// Timer disabled'
                    }
                    
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
                    const objects = document.querySelectorAll('a-box, a-sphere, a-cylinder, a-plane, a-sky');
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
                        
                        // Check if this is a wallpaper sphere (special case)
                        const isWallpaperSphere = objType === 'a-sphere' && 
                            materialComponent && 
                            materialComponent.data.wireframe === true &&
                            materialComponent.data.side === 'back';
                        const isSky = objType === 'a-sky';

                        // Ensure proper visibility based on current scene
                        if (sceneId === '0' || isWallpaperSphere || isSky) {
                            if (isWallpaperSphere) {
                                console.log(\`[MultiSceneQuiz] Keeping wallpaper sphere visible (always visible)\`);
                            } else if (isSky) {
                                console.log('[MultiSceneQuiz] Keeping sky background visible (always visible)');
                            } else {
                                console.log(\`[MultiSceneQuiz] Keeping object \${index} visible (scene 0)\`);
                            }
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
                            canvasId: window.canvasId || null,
                            name: leadInfo.name || null,
                            email: leadInfo.email || null,
                            phone: leadInfo.phone || null,
                            points: totalPoints, // Dedicated field for points
                            createdDate: new Date().toISOString()
                        };
                        
                        dbg('[LeadCollection] payload', leadPayload);
                        if (!leadPayload.canvasId) {
                            console.warn('[LeadCollection] WARNING: canvasId is not defined');
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
                    
                    // Universo Platformo | Stop timer when quiz ends
                    ${
                        timerConfig?.enabled
                            ? `
                    if (timerManager) {
                        timerManager.stop();
                    }
                    `
                            : ''
                    }
                    
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
                    ${
                        leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
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
                    
                    // Universo Platformo | Start timer when quiz begins
                    ${
                        timerConfig?.enabled
                            ? `
                    if (timerManager && !timerManager.isRunning) {
                        timerManager.start();
                    }
                    `
                            : ''
                    }
                    
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

    /**
     * Universo Platformo | Generate node-based UI for quiz (drag-and-drop interaction)
     * @param multiScene Multi-scene data structure
     * @param showPoints Whether to show points counter
     * @param leadCollection Lead collection configuration
     * @param timerConfig Timer configuration
     * @returns HTML string with node-based quiz UI
     */
    private generateNodeBasedUI(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean },
        timerConfig?: { enabled: boolean; limitSeconds: number; position: string }
    ): string {
        debugLog('🔧 [DataHandler] Generating node-based UI')

        let html = ''

        // Add lead collection form if configured
        if (leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)) {
            html += this.generateLeadCollectionForm(leadCollection)
        }

        // Add timer UI if enabled
        if (timerConfig?.enabled) {
            const position =
                DataHandler.TIMER_POSITIONS[timerConfig.position as keyof typeof DataHandler.TIMER_POSITIONS] ||
                DataHandler.TIMER_POSITIONS['top-center']

            html += `
            <!-- Universo Platformo | Timer Display -->
            <div id="quiz-timer" style="
                position: fixed;
                top: ${position.top};
                right: ${position.right};
                bottom: ${position.bottom};
                left: ${position.left};
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                font-weight: bold;
                z-index: ${DataHandler.TIMER_Z_INDEX};
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                min-width: 80px;
                text-align: center;
                transform: ${position.transform};
                display: none;
            ">
                ⏱️ <span id="timer-display">--:--</span>
            </div>
            `
        }

        // Generate node-based UI container with CSS Grid layout
        html += `
        <!-- Universo Platformo | Node-Based Quiz UI Container -->
        <div id="node-quiz-container" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90vw;
            max-width: 800px;
            height: 70vh;
            max-height: 600px;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 12px;
            padding: 20px;
            z-index: ${DataHandler.QUIZ_CONTAINER_Z_INDEX};
            display: none;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        ">
            <!-- Quiz Title -->
            <div id="node-quiz-title" style="
                color: white;
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 20px;
                text-align: center;
                font-family: Arial, sans-serif;
            ">
                Соедините вопросы с ответами
            </div>

            <!-- Grid Layout Container -->
            <div id="node-grid" style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                height: calc(100% - 140px);
                position: relative;
            ">
                <!-- Questions Column -->
                <div id="questions-column" style="
                    display: flex;
                    flex-direction: column;
                    justify-content: space-around;
                    padding: 10px;
                "></div>

                <!-- Answers Column -->
                <div id="answers-column" style="
                    display: flex;
                    flex-direction: column;
                    justify-content: space-around;
                    padding: 10px;
                "></div>
            </div>

            <!-- SVG Overlay for Connection Lines -->
            <svg id="connection-svg" style="
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            " viewBox="0 0 100 100" preserveAspectRatio="none"></svg>

            <!-- Action Buttons -->
            <div style="
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-top: 20px;
            ">
                <button id="check-connections-btn" style="
                    padding: 12px 24px;
                    background: linear-gradient(45deg, #4CAF50, #45a049);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    Проверить
                </button>
                <button id="clear-connections-btn" style="
                    padding: 12px 24px;
                    background: linear-gradient(45deg, #f44336, #d32f2f);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    Очистить
                </button>
            </div>

            <!-- Feedback Message -->
            <div id="node-feedback" style="
                color: white;
                text-align: center;
                margin-top: 15px;
                font-size: 14px;
                min-height: 20px;
                font-family: Arial, sans-serif;
            "></div>

            <!-- Points Display (if enabled) -->
            ${
                showPoints
                    ? `
            <div id="node-points-display" style="
                color: #FFD700;
                text-align: center;
                margin-top: 10px;
                font-size: 18px;
                font-weight: bold;
                font-family: Arial, sans-serif;
            ">
                Баллы: <span id="node-current-points">0</span>
            </div>
            `
                    : ''
            }
        </div>
        `

        return html
    }

    /**
     * Universo Platformo | Generate node-based JavaScript logic for quiz
     * @param multiScene Multi-scene data structure
     * @param showPoints Whether to show points counter
     * @param leadCollection Lead collection configuration
     * @param timerConfig Timer configuration
     * @returns JavaScript string with node-based quiz logic
     */
    private generateNodeBasedScript(
        multiScene: IUPDLMultiScene,
        showPoints: boolean = false,
        leadCollection?: { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean },
        timerConfig?: { enabled: boolean; limitSeconds: number; position: string }
    ): string {
        debugLog('🔧 [DataHandler] Generating node-based script')

        // Extract constants BEFORE template string to avoid scoping issues
        const dangerThreshold = DataHandler.DANGER_THRESHOLD_SECONDS
        const warningThreshold = DataHandler.WARNING_THRESHOLD_SECONDS

        // Build scene-to-question mapping
        const sceneQuestions = multiScene.scenes
            .map((scene, index) => {
                const questions = scene.dataNodes.filter((node) => node.dataType?.toLowerCase() === 'question')
                const answers = scene.dataNodes.filter((node) => node.dataType?.toLowerCase() === 'answer')
                return {
                    sceneIndex: index,
                    questions: questions.map((q) => ({
                        id: q.id,
                        text: q.content,
                        correctAnswerId: answers.find((a) => a.isCorrect)?.id || null
                    })),
                    answers: answers.map((a) => ({
                        id: a.id,
                        text: a.content,
                        isCorrect: a.isCorrect
                    }))
                }
            })
            .filter((scene) => scene.questions.length > 0)

        let script = `
        <script>
        (function() {
            'use strict';
            console.log('[NodeQuiz] Initializing node-based quiz system');

            // Global state
            const quizState = {
                currentSceneIndex: 0,
                totalScenes: ${sceneQuestions.length},
                points: 0,
                connections: new Map(), // questionId -> answerId
                dragState: null,
                leadData: {},
                timerInterval: null,
                timeRemaining: ${timerConfig?.enabled ? timerConfig.limitSeconds : 0}
            };

            // Scene data
            const scenes = ${JSON.stringify(sceneQuestions, null, 2)};

            // DOM elements
            let container, questionsCol, answersCol, svg, checkBtn, clearBtn, feedback, pointsDisplay;

            // Initialize on DOM ready
            document.addEventListener('DOMContentLoaded', function() {
                console.log('[NodeQuiz] DOM ready, setting up UI');
                initializeElements();
                setupLeadForm();
            });

            function initializeElements() {
                container = document.getElementById('node-quiz-container');
                questionsCol = document.getElementById('questions-column');
                answersCol = document.getElementById('answers-column');
                svg = document.getElementById('connection-svg');
                checkBtn = document.getElementById('check-connections-btn');
                clearBtn = document.getElementById('clear-connections-btn');
                feedback = document.getElementById('node-feedback');
                ${showPoints ? "pointsDisplay = document.getElementById('node-current-points');" : ''}

                if (!container || !questionsCol || !answersCol || !svg) {
                    console.error('[NodeQuiz] Critical UI elements not found');
                    return;
                }

                // Setup button handlers
                checkBtn.addEventListener('click', handleCheckConnections);
                clearBtn.addEventListener('click', handleClearConnections);
            }

            function setupLeadForm() {
                ${
                    leadCollection && (leadCollection.collectName || leadCollection.collectEmail || leadCollection.collectPhone)
                        ? `
                const leadForm = document.getElementById('lead-collection-form');
                const startBtn = document.getElementById('start-quiz-btn');
                const errorDiv = document.getElementById('lead-form-error');

                if (!startBtn || !leadForm) {
                    console.error('[NodeQuiz] Lead form elements not found');
                    startQuiz();
                    return;
                }

                startBtn.addEventListener('click', function() {
                    const nameInput = document.getElementById('lead-name');
                    const emailInput = document.getElementById('lead-email');
                    const phoneInput = document.getElementById('lead-phone');

                    let isValid = true;
                    ${
                        leadCollection.collectName
                            ? `
                    if (nameInput && nameInput.value.trim() === '') {
                        isValid = false;
                    } else if (nameInput) {
                        quizState.leadData.name = nameInput.value.trim();
                    }
                    `
                            : ''
                    }
                    ${
                        leadCollection.collectEmail
                            ? `
                    if (emailInput && emailInput.value.trim() === '') {
                        isValid = false;
                    } else if (emailInput) {
                        quizState.leadData.email = emailInput.value.trim();
                    }
                    `
                            : ''
                    }
                    ${
                        leadCollection.collectPhone
                            ? `
                    if (phoneInput && phoneInput.value.trim() === '') {
                        isValid = false;
                    } else if (phoneInput) {
                        quizState.leadData.phone = phoneInput.value.trim();
                    }
                    `
                            : ''
                    }

                    if (!isValid) {
                        errorDiv.style.display = 'block';
                        return;
                    }

                    console.log('[NodeQuiz] Lead data collected:', quizState.leadData);
                    leadForm.style.display = 'none';
                    startQuiz();
                });
                `
                        : `
                startQuiz();
                `
                }
            }

            function startQuiz() {
                console.log('[NodeQuiz] Starting quiz');
                container.style.display = 'block';
                ${
                    timerConfig?.enabled
                        ? `
                startTimer();
                `
                        : ''
                }
                loadScene(0);
            }

            ${
                timerConfig?.enabled
                    ? `
            function startTimer() {
                const timerDisplay = document.getElementById('timer-display');
                const timerContainer = document.getElementById('quiz-timer');
                if (!timerDisplay || !timerContainer) return;

                timerContainer.style.display = 'block';
                updateTimerDisplay();

                quizState.timerInterval = setInterval(function() {
                    quizState.timeRemaining--;
                    updateTimerDisplay();

                    if (quizState.timeRemaining <= 0) {
                        clearInterval(quizState.timerInterval);
                        handleTimeUp();
                    }
                }, 1000);
            }

            function updateTimerDisplay() {
                const timerDisplay = document.getElementById('timer-display');
                if (!timerDisplay) return;

                const minutes = Math.floor(quizState.timeRemaining / 60);
                const seconds = quizState.timeRemaining % 60;
                timerDisplay.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

                const timerContainer = document.getElementById('quiz-timer');
                if (quizState.timeRemaining <= ${dangerThreshold}) {
                    timerContainer.style.background = 'rgba(244, 67, 54, 0.9)';
                } else if (quizState.timeRemaining <= ${warningThreshold}) {
                    timerContainer.style.background = 'rgba(255, 152, 0, 0.9)';
                }
            }

            function handleTimeUp() {
                feedback.textContent = 'Время вышло!';
                feedback.style.color = '#ff6b6b';
                checkBtn.disabled = true;
                clearBtn.disabled = true;
                setTimeout(function() {
                    finishQuiz();
                }, 2000);
            }
            `
                    : ''
            }

            function loadScene(sceneIndex) {
                console.log('[NodeQuiz] Loading scene:', sceneIndex);
                quizState.currentSceneIndex = sceneIndex;
                quizState.connections.clear();

                const scene = scenes[sceneIndex];
                if (!scene) {
                    console.error('[NodeQuiz] Scene not found:', sceneIndex);
                    return;
                }

                // Clear columns and SVG
                questionsCol.innerHTML = '';
                answersCol.innerHTML = '';
                svg.innerHTML = '';
                feedback.textContent = '';

                // Render questions
                scene.questions.forEach(function(question, index) {
                    const node = createNode(question.id, question.text, 'question', index);
                    questionsCol.appendChild(node);
                });

                // Render answers (shuffled for challenge)
                const shuffledAnswers = shuffleArray([...scene.answers]);
                shuffledAnswers.forEach(function(answer, index) {
                    const node = createNode(answer.id, answer.text, 'answer', index);
                    answersCol.appendChild(node);
                });
            }

            function createNode(id, text, type, index) {
                const node = document.createElement('div');
                node.id = type + '-node-' + id;
                node.className = 'quiz-node';
                node.dataset.id = id;
                node.dataset.type = type;
                node.style.cssText = \`
                    background: linear-gradient(135deg, \${type === 'question' ? '#2196F3' : '#9C27B0'}, \${type === 'question' ? '#1976D2' : '#7B1FA2'});
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    cursor: \${type === 'question' ? 'grab' : 'default'};
                    font-size: 14px;
                    text-align: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    position: relative;
                    z-index: 10;
                    user-select: none;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                `;

                node.textContent = text;

                // Add drag functionality only to questions
                if (type === 'question') {
                    node.addEventListener('pointerdown', handlePointerDown);
                }

                return node;
            }

            function handlePointerDown(e) {
                const node = e.currentTarget;
                quizState.dragState = {
                    questionId: node.dataset.id,
                    startX: e.clientX,
                    startY: e.clientY
                };

                node.style.cursor = 'grabbing';
                node.style.transform = 'scale(1.05)';
                node.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';

                // Create temporary line
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.id = 'temp-line';
                line.setAttribute('stroke', '#FFD700');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('stroke-dasharray', '5,5');
                svg.appendChild(line);

                updateTempLine(e);

                document.addEventListener('pointermove', handlePointerMove);
                document.addEventListener('pointerup', handlePointerUp);

                e.preventDefault();
            }

            function handlePointerMove(e) {
                if (!quizState.dragState) return;
                updateTempLine(e);
            }

            function handlePointerUp(e) {
                if (!quizState.dragState) return;

                const questionNode = document.querySelector('[data-id="' + quizState.dragState.questionId + '"]');
                if (questionNode) {
                    questionNode.style.cursor = 'grab';
                    questionNode.style.transform = 'scale(1)';
                    questionNode.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                }

                // Remove temp line
                const tempLine = document.getElementById('temp-line');
                if (tempLine) {
                    svg.removeChild(tempLine);
                }

                // Check if released over answer node
                const answerNode = document.elementFromPoint(e.clientX, e.clientY);
                if (answerNode && answerNode.classList.contains('quiz-node') && answerNode.dataset.type === 'answer') {
                    createConnection(quizState.dragState.questionId, answerNode.dataset.id);
                }

                quizState.dragState = null;
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
            }

            function updateTempLine(e) {
                const line = document.getElementById('temp-line');
                if (!line || !quizState.dragState) return;

                const questionNode = document.querySelector('[data-id="' + quizState.dragState.questionId + '"]');
                if (!questionNode) return;

                const containerRect = container.getBoundingClientRect();
                const questionRect = questionNode.getBoundingClientRect();

                const x1 = ((questionRect.right - containerRect.left) / containerRect.width) * 100;
                const y1 = ((questionRect.top + questionRect.height / 2 - containerRect.top) / containerRect.height) * 100;
                const x2 = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                const y2 = ((e.clientY - containerRect.top) / containerRect.height) * 100;

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
            }

            function createConnection(questionId, answerId) {
                console.log('[NodeQuiz] Creating connection:', questionId, '->', answerId);

                // Remove old connection for this question
                removeConnectionForQuestion(questionId);

                // Store new connection
                quizState.connections.set(questionId, answerId);

                // Draw line
                drawConnection(questionId, answerId);
            }

            function removeConnectionForQuestion(questionId) {
                const oldLine = document.getElementById('line-' + questionId);
                if (oldLine) {
                    svg.removeChild(oldLine);
                }
                quizState.connections.delete(questionId);
            }

            function drawConnection(questionId, answerId) {
                const questionNode = document.querySelector('[data-id="' + questionId + '"]');
                const answerNode = document.querySelector('[data-id="' + answerId + '"]');
                if (!questionNode || !answerNode) return;

                const containerRect = container.getBoundingClientRect();
                const questionRect = questionNode.getBoundingClientRect();
                const answerRect = answerNode.getBoundingClientRect();

                const x1 = ((questionRect.right - containerRect.left) / containerRect.width) * 100;
                const y1 = ((questionRect.top + questionRect.height / 2 - containerRect.top) / containerRect.height) * 100;
                const x2 = ((answerRect.left - containerRect.left) / containerRect.width) * 100;
                const y2 = ((answerRect.top + answerRect.height / 2 - containerRect.top) / containerRect.height) * 100;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.id = 'line-' + questionId;
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#4CAF50');
                line.setAttribute('stroke-width', '3');
                svg.appendChild(line);
            }

            function handleCheckConnections() {
                console.log('[NodeQuiz] Checking connections');
                feedback.textContent = '';

                const scene = scenes[quizState.currentSceneIndex];
                let correctCount = 0;
                let totalQuestions = scene.questions.length;

                scene.questions.forEach(function(question) {
                    const userAnswer = quizState.connections.get(question.id);
                    const isCorrect = userAnswer === question.correctAnswerId;

                    if (isCorrect) {
                        correctCount++;
                        ${showPoints ? 'quizState.points++;' : ''}
                    }

                    // Visual feedback
                    const line = document.getElementById('line-' + question.id);
                    if (line) {
                        line.setAttribute('stroke', isCorrect ? '#4CAF50' : '#f44336');
                        line.setAttribute('stroke-width', '4');
                    }
                });

                ${
                    showPoints
                        ? `
                if (pointsDisplay) {
                    pointsDisplay.textContent = quizState.points;
                }
                `
                        : ''
                }

                if (correctCount === totalQuestions) {
                    feedback.textContent = 'Отлично! Все правильно!';
                    feedback.style.color = '#4CAF50';
                    setTimeout(function() {
                        nextScene();
                    }, 1500);
                } else {
                    feedback.textContent = 'Правильно: ' + correctCount + ' из ' + totalQuestions;
                    feedback.style.color = '#ff9800';
                }
            }

            function handleClearConnections() {
                console.log('[NodeQuiz] Clearing connections');
                quizState.connections.clear();
                svg.innerHTML = '';
                feedback.textContent = '';
            }

            function nextScene() {
                if (quizState.currentSceneIndex + 1 < quizState.totalScenes) {
                    loadScene(quizState.currentSceneIndex + 1);
                } else {
                    finishQuiz();
                }
            }

            function finishQuiz() {
                console.log('[NodeQuiz] Quiz finished');
                ${timerConfig?.enabled ? 'if (quizState.timerInterval) clearInterval(quizState.timerInterval);' : ''}
                container.innerHTML = `<div style="color: white; text-align: center; font-size: 20px; padding: 40px;">Квиз завершён!<br>${showPoints ? 'Ваши баллы: ' + quizState.points : ''}</div>`;
            }
            function shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }
        })();
        </script>
        `

        return script
    }
}
