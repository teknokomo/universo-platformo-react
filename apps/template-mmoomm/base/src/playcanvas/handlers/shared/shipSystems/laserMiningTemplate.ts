// Universo Platformo | MMOOMM Laser Mining Template
// Shared template for laser mining system with state machine

/**
 * Interface for laser mining system
 */
export interface LaserMiningSystem {
    state: string;
    currentTarget: any;
    miningStartTime: number;
    cycleProgress: number;
    laserBeam: any;
    config: {
        maxRange: number;
        miningDuration: number;
        resourceYield: number;
        fadeInDuration: number;
        fadeOutDuration: number;
    };
    debugMode: boolean;
    rangeIndicator: any;
    init(): void;
    setState(newState: string, reason?: string): void;
    onStateEnter(newState: string, oldState: string): void;
    findTarget(): void;
    isValidTarget(target: any): boolean;
    getDistanceToTarget(target: any): number;
    hasLineOfSight(from: any, to: any): boolean;
    showLaser(): void;
    hideLaser(): void;
    createLaserBeam(): void;
    updateLaserPosition(): void;
    collectResources(): void;
    update(deltaTime: number): void;
    activate(): boolean;
    canActivate(): boolean;
    getStatus(): any;
}

/**
 * Creates a standardized laser mining system object
 * @param maxRange Maximum mining range
 * @param miningDuration Mining cycle duration in milliseconds
 * @param resourceYield Resource yield per cycle
 * @param enableDebug Whether to enable debug mode
 * @returns Laser mining system object
 */
export function createLaserMiningSystem(
    maxRange: number = 75,
    miningDuration: number = 3000,
    resourceYield: number = 1.5,
    enableDebug: boolean = false
): LaserMiningSystem {
    return {
        state: 'idle',
        currentTarget: null,
        miningStartTime: 0,
        cycleProgress: 0,
        laserBeam: null,
        config: {
            maxRange,
            miningDuration,
            resourceYield,
            fadeInDuration: 200,
            fadeOutDuration: 300
        },
        debugMode: enableDebug,
        rangeIndicator: null,

        // All methods will be implemented in generated code
        init(): void {},
        setState(newState: string, reason?: string): void {},
        onStateEnter(newState: string, oldState: string): void {},
        findTarget(): void {},
        isValidTarget(target: any): boolean { return false; },
        getDistanceToTarget(target: any): number { return Infinity; },
        hasLineOfSight(from: any, to: any): boolean { return true; },
        showLaser(): void {},
        hideLaser(): void {},
        createLaserBeam(): void {},
        updateLaserPosition(): void {},
        collectResources(): void {},
        update(deltaTime: number): void {},
        activate(): boolean { return false; },
        canActivate(): boolean { return false; },
        getStatus(): any { return {}; }
    };
}

/**
 * Generates JavaScript code string for laser mining system
 * This is a complex system with state machine, so we'll generate it in parts
 * @param maxRange Maximum mining range
 * @param miningDuration Mining cycle duration in milliseconds
 * @param resourceYield Resource yield per cycle
 * @param enableDebug Whether to enable debug mode
 * @param includeLogging Whether to include console logging
 * @returns JavaScript code string
 */
export function generateLaserMiningCode(
    maxRange: number = 75,
    miningDuration: number = 3000,
    resourceYield: number = 1.5,
    enableDebug: boolean = false,
    includeLogging: boolean = false
): string {
    // Due to size constraints, we'll generate the core structure
    // and add methods in subsequent calls
    return generateLaserMiningCoreCode(maxRange, miningDuration, resourceYield, enableDebug, includeLogging);
}

/**
 * Generates the core laser mining system code structure
 */
function generateLaserMiningCoreCode(
    maxRange: number,
    miningDuration: number,
    resourceYield: number,
    enableDebug: boolean,
    includeLogging: boolean
): string {
    const initLogging = includeLogging ? `
            console.log('[LaserSystem] Initializing laser system');
            console.log('[LaserSystem] Initialization complete');` : '';

    const stateLogging = includeLogging ? `
            console.log('[LaserSystem] ' + oldState + ' -> ' + newState + (reason ? ' (' + reason + ')' : ''));` : '';

    return `{
        state: 'idle',
        currentTarget: null,
        miningStartTime: 0,
        cycleProgress: 0,
        laserBeam: null,
        config: {
            maxRange: ${maxRange},
            miningDuration: ${miningDuration},
            resourceYield: ${resourceYield},
            fadeInDuration: 200,
            fadeOutDuration: 300
        },
        debugMode: ${enableDebug},
        rangeIndicator: null,

        init() {${initLogging}
            this.state = 'idle';
            this.currentTarget = null;
            this.laserBeam = null;
            this.miningStartTime = 0;
            this.cycleProgress = 0;
        },

        setState(newState, reason = '') {
            const oldState = this.state;
            this.state = newState;${stateLogging}
            this.onStateEnter(newState, oldState);
        },

        onStateEnter(newState, oldState) {
            switch (newState) {
                case 'idle':
                    this.currentTarget = null;
                    this.miningStartTime = 0;
                    this.cycleProgress = 0;
                    this.hideLaser();
                    break;
                case 'targeting':
                    this.findTarget();
                    break;
                case 'mining':
                    this.miningStartTime = Date.now();
                    this.cycleProgress = 0;
                    this.showLaser();
                    break;
                case 'collecting':
                    this.hideLaser();
                    this.collectResources();
                    break;
            }
        },

        ${generateLaserMiningMethods(includeLogging)}
    }`;
}

/**
 * Generates the laser mining methods
 */
function generateLaserMiningMethods(includeLogging: boolean): string {
    const targetLogging = includeLogging ? `
                console.log('[LaserSystem] Target acquired', closest.name || closest.getGuid?.());` : '';

    const miningLogging = includeLogging ? `
            if (Math.floor(elapsed / 100) % 10 === 0) {
                console.log('[LaserSystem] Mining progress:', (this.cycleProgress * 100).toFixed(1) + '%', 'elapsed:', elapsed, 'duration:', this.config.miningDuration);
            }` : '';

    const collectLogging = includeLogging ? `
                console.log('[LaserSystem] Collected ' + resourceAmount + ' asteroidMass');` : '';

    const beamLogging = includeLogging ? `
            console.log('[LaserSystem] Laser beam activated with fade-in');
            console.log('[LaserSystem] Laser beam entity created with box rendering');` : '';

    return `findTarget() {
            if (!window.app || !window.playerShip) {
                console.warn('[LaserSystem] Cannot find target - app or playerShip missing');
                this.setState('idle', 'no app or ship');
                return;
            }

            const asteroids = window.app.root.findByTag ? window.app.root.findByTag('asteroid') : [];
            if (!asteroids || asteroids.length === 0) {
                this.setState('idle', 'no asteroids');
                return;
            }

            let closest = null;
            let closestDist = Infinity;
            const shipPos = window.playerShip.getPosition();

            asteroids.forEach((ast) => {
                if (!this.isValidTarget(ast)) return;
                const dist = shipPos.distance(ast.getPosition());
                if (dist < closestDist) {
                    closest = ast;
                    closestDist = dist;
                }
            });

            if (closest) {
                this.currentTarget = closest;${targetLogging}
                this.setState('mining', 'target found');
            } else {
                this.setState('idle', 'no target in range');
            }
        },

        isValidTarget(target) {
            if (!target || target.mineable?.isDestroyed) return false;
            const distance = this.getDistanceToTarget(target);
            if (distance > this.config.maxRange) return false;
            return this.hasLineOfSight(entity.getPosition(), target.getPosition());
        },

        getDistanceToTarget(target) {
            if (!target || !window.playerShip) return Infinity;
            const shipPos = window.playerShip.getPosition();
            const targetPos = target.getPosition();
            return shipPos.distance(targetPos);
        },

        hasLineOfSight(from, to) {
            if (!app.systems.rigidbody || !app.systems.rigidbody.dynamicsWorld) {
                return true;
            }

            const direction = to.clone().sub(from).normalize();
            const startPos = from.clone().add(direction.clone().scale(1));

            try {
                const result = app.systems.rigidbody.raycastFirst(startPos, to);
                if (result) {
                    if (result.entity === this.currentTarget) return true;
                    const hitDistance = startPos.distance(result.point);
                    const targetDistance = startPos.distance(to);
                    if (Math.abs(hitDistance - targetDistance) < 2.0) return true;
                    return false;
                }
                return true;
            } catch (error) {
                return true;
            }
        },

        showLaser() {
            if (!this.currentTarget) return;
            if (!this.laserBeam) {
                this.createLaserBeam();
            }
            this.updateLaserPosition();
            this.laserBeam.enabled = true;${beamLogging}
        },

        hideLaser() {
            if (this.laserBeam && this.laserBeam.enabled) {
                this.laserBeam.enabled = false;
                if (this.laserBeam.model && this.laserBeam.model.material) {
                    this.laserBeam.model.material.opacity = 0.9;
                    this.laserBeam.model.material.update();
                }
            }
        },

        createLaserBeam() {
            this.laserBeam = new pc.Entity('laserBeam');
            this.laserBeam.addComponent('model', { type: 'box' });
            const mat = new pc.StandardMaterial();
            mat.diffuse.set(1, 0, 0);
            mat.emissive.set(1, 0, 0);
            mat.update();
            this.laserBeam.model.material = mat;
            this.laserBeam.setLocalScale(0.05, 0.05, 1);
            app.root.addChild(this.laserBeam);
            this.laserBeam.enabled = false;
        },

        updateLaserPosition() {
            if (!this.laserBeam || !this.currentTarget) return;
            const shipPos = entity.getPosition();
            const targetPos = this.currentTarget.getPosition();
            const dir = new pc.Vec3();
            dir.sub2(targetPos, shipPos);
            const length = dir.length();
            const mid = new pc.Vec3();
            mid.add2(shipPos, dir.clone().scale(0.5));
            this.laserBeam.setPosition(mid);
            this.laserBeam.lookAt(targetPos);
            this.laserBeam.setLocalScale(0.05, 0.05, length);
        },

        collectResources() {
            if (!this.currentTarget || !entity.inventory) {
                this.setState('idle', 'collection failed');
                return;
            }

            const resourceAmount = this.config.resourceYield;
            if (entity.inventory.currentLoad + resourceAmount > entity.inventory.maxCapacity) {
                this.setState('idle', 'cargo hold full');
                return;
            }

            if (entity.inventory.addItem('asteroidMass', resourceAmount)) {${collectLogging}
                if (window.SpaceHUD) {
                    window.SpaceHUD.updateShipStatus(entity);
                }
                if (this.currentTarget.mineable) {
                    this.currentTarget.mineable.onHit({ damage: 1 });
                }
                setTimeout(() => {
                    this.setState('idle', 'collection complete');
                }, 500);
            } else {
                this.setState('idle', 'failed to add resources');
            }
        },

        update(deltaTime) {
            switch (this.state) {
                case 'targeting':
                    if (!this.isValidTarget(this.currentTarget)) {
                        this.setState('idle', 'target lost');
                        return;
                    }
                    this.setState('mining', 'target acquired');
                    break;
                case 'mining':
                    this.updateLaserPosition();
                    const elapsed = Date.now() - this.miningStartTime;
                    this.cycleProgress = elapsed / this.config.miningDuration;${miningLogging}
                    if (!this.isValidTarget(this.currentTarget)) {
                        this.setState('idle', 'target lost during mining');
                        return;
                    }
                    if (elapsed >= this.config.miningDuration) {
                        this.setState('collecting', 'mining cycle complete');
                    }
                    break;
                case 'collecting':
                    if (!this._collectTimeout) {
                        this._collectTimeout = setTimeout(() => {
                            this.setState('idle', 'collection complete');
                            this._collectTimeout = null;
                        }, 500);
                    }
                    break;
            }
        },

        activate() {
            if (this.state === 'idle') {
                this.setState('targeting', 'player activated');
                return true;
            }
            if (this.state === 'targeting') {
                this.setState('idle', 'force reset from targeting');
                return this.activate();
            }
            return false;
        },

        canActivate() {
            return this.state === 'idle';
        },

        getStatus() {
            return {
                state: this.state,
                progress: this.cycleProgress,
                hasTarget: !!this.currentTarget,
                targetDistance: this.currentTarget ? this.getDistanceToTarget(this.currentTarget) : null
            };
        }`;
}
