// Laser Mining System State Machine Design
// Date: 2025-01-24

/**
 * Laser System States:
 * 
 * IDLE - Default state, ready to target
 * TARGETING - Searching and acquiring target
 * MINING - Active 3-second mining cycle
 * COLLECTING - Brief collection animation phase
 */

const LaserSystemStates = {
    IDLE: 'idle',
    TARGETING: 'targeting', 
    MINING: 'mining',
    COLLECTING: 'collecting'
};

/**
 * State Transitions:
 * 
 * IDLE -> TARGETING: Player presses spacebar, valid target found
 * TARGETING -> MINING: Target acquired and validated
 * TARGETING -> IDLE: No valid target found or target lost
 * MINING -> COLLECTING: 3-second cycle completed successfully
 * MINING -> IDLE: Target lost during mining or error occurred
 * COLLECTING -> IDLE: Collection animation completed
 */

const LaserSystemDesign = {
    // State management
    state: LaserSystemStates.IDLE,
    currentTarget: null,
    miningStartTime: 0,
    cycleProgress: 0,
    
    // Visual components
    laserBeam: null,
    targetIndicator: null,
    
    // Configuration
    config: {
        maxRange: 75, // 50-100 units as specified
        miningDuration: 3000, // 3 seconds in milliseconds
        resourceYield: 1.5, // 1-2 cubic meters per cycle
        fadeInDuration: 200, // Laser fade in time
        fadeOutDuration: 300, // Laser fade out time
    },
    
    // State transition methods
    setState(newState, reason = '') {
        const oldState = this.state;
        this.state = newState;
        console.log(`[LaserSystem] ${oldState} -> ${newState}${reason ? ` (${reason})` : ''}`);
        
        // Handle state entry actions
        this.onStateEnter(newState, oldState);
    },
    
    onStateEnter(newState, oldState) {
        switch (newState) {
            case LaserSystemStates.IDLE:
                this.currentTarget = null;
                this.miningStartTime = 0;
                this.cycleProgress = 0;
                this.hideLaser();
                break;
                
            case LaserSystemStates.TARGETING:
                this.findTarget();
                break;
                
            case LaserSystemStates.MINING:
                this.miningStartTime = Date.now();
                this.cycleProgress = 0;
                this.showLaser();
                break;
                
            case LaserSystemStates.COLLECTING:
                this.hideLaser();
                this.collectResources();
                break;
        }
    },
    
    // Core methods (to be implemented)
    findTarget() {
        if (!window.app || !window.playerShip) {
            console.warn('[LaserSystem] Cannot find target - app or playerShip missing');
            this.setState(LaserSystemStates.IDLE, 'no app or ship');
            return;
        }

        const asteroids = window.app.root.findByTag ? window.app.root.findByTag('asteroid') : [];
        if (!asteroids || asteroids.length === 0) {
            this.setState(LaserSystemStates.IDLE, 'no asteroids');
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
            this.currentTarget = closest;
            console.log('[LaserSystem] Target acquired', closest.name || closest.getGuid?.());
            // Immediately proceed to mining state
            this.setState(LaserSystemStates.MINING, 'target found');
        } else {
            this.setState(LaserSystemStates.IDLE, 'no target in range');
        }
    },
    
    // Initialization, should be called once after LaserSystemDesign is loaded
init(retry = 0) {
    if (this._initialized) return;

    if (typeof window !== 'undefined' && window.app) {
        window.app.on('update', (dt) => {
            // Call main update each frame
            this.update(dt);
        });
        this._initialized = true;
        console.log('[LaserSystem] Registered update listener');
    } else if (retry < 20) { // try for ~2 seconds max
        setTimeout(() => this.init(retry + 1), 100);
    } else {
        console.warn('[LaserSystem] Failed to attach update listener: app not found');
    }
},

showLaser() {
        if (!window.app || !window.playerShip || !this.currentTarget) return;

        // Create laser beam entity if it doesn't exist
        if (!this.laserBeam) {
            const beam = new pc.Entity('laserBeam');
            const mat = new pc.StandardMaterial();
            mat.diffuse.set(1, 0, 0);
            mat.emissive.set(1, 0, 0);
            mat.update();
            beam.addComponent('model', { type: 'box' });
            beam.model.material = mat;
            beam.setLocalScale(0.05, 0.05, 1); // Thin beam, Z length will be updated
            window.app.root.addChild(beam);
            this.laserBeam = beam;
        }
        this.laserBeam.enabled = true;
        // Initial update to position/orient
        this.updateLaserBeam();
    },
    
    hideLaser() {
        if (this.laserBeam) {
            this.laserBeam.enabled = false;
        }
    },
    
    // Update beam position, orientation and length
    updateLaserBeam() {
        if (!this.laserBeam || !this.currentTarget || !window.playerShip) return;

        const shipPos = window.playerShip.getPosition();
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
        if (!this.currentTarget || !window.playerShip) return;

        const yieldAmount = this.config.resourceYield;
        let collected = false;

        if (this.currentTarget.mineable && !this.currentTarget.mineable.isDestroyed) {
            // Reduce asteroid yield
            this.currentTarget.mineable.currentYield -= yieldAmount;
            if (this.currentTarget.mineable.currentYield <= 0) {
                this.currentTarget.mineable.destroy();
            }
            collected = true;
        }

        // Add to ship inventory
        if (window.playerShip.inventory) {
            const added = window.playerShip.inventory.addItem('asteroidMass', yieldAmount);
            collected = collected && added;
        }

        console.log('[LaserSystem] Collected', yieldAmount, 'units');
    },
    
    // Update method called every frame
    update(deltaTime) {
        switch (this.state) {
            case LaserSystemStates.TARGETING:
                this.updateTargeting();
                break;
                
            case LaserSystemStates.MINING:
                this.updateMining(deltaTime);
                break;
                
            case LaserSystemStates.COLLECTING:
                this.updateCollecting(deltaTime);
                break;
        }
    },
    
    updateTargeting() {
        // Validate current target is still valid
        if (!this.isValidTarget(this.currentTarget)) {
            this.setState(LaserSystemStates.IDLE, 'target lost');
            return;
        }
        
        // Start mining if target is good
        this.setState(LaserSystemStates.MINING, 'target acquired');
    },
    
    updateMining(deltaTime) {
        // Update beam orientation continuously
        this.updateLaserBeam();

        const elapsed = Date.now() - this.miningStartTime;
        this.cycleProgress = elapsed / this.config.miningDuration;

        // Check if target is still valid
        if (!this.isValidTarget(this.currentTarget)) {
            this.setState(LaserSystemStates.IDLE, 'target lost during mining');
            return;
        }

        // Check if mining cycle is complete
        if (elapsed >= this.config.miningDuration) {
            this.setState(LaserSystemStates.COLLECTING, 'mining cycle complete');
        }
    },

    updateCollecting(deltaTime) {
        // Schedule idle transition once
        if (!this._collectTimeout) {
            this._collectTimeout = setTimeout(() => {
                this.setState(LaserSystemStates.IDLE, 'collection complete');
                this._collectTimeout = null;
            }, 500);
        }
    },
    
    // Validation methods
    isValidTarget(target) {
        if (!target || target.mineable?.isDestroyed) return false;
        
        const distance = this.getDistanceToTarget(target);
        if (distance > this.config.maxRange) return false;
        
        // Add line-of-sight check here
        return true;
    },
    
    getDistanceToTarget(target) {
        if (!target || !window.playerShip) return Infinity;
        
        const shipPos = window.playerShip.getPosition();
        const targetPos = target.getPosition();
        return shipPos.distance(targetPos);
    },
    
    // Public interface
    activate() {
        if (this.state === LaserSystemStates.IDLE) {
            this.setState(LaserSystemStates.TARGETING, 'player activated');
            return true;
        }
        return false; // Already active or busy
    },
    
    canActivate() {
        return this.state === LaserSystemStates.IDLE;
    },
    
    getStatus() {
        return {
            state: this.state,
            progress: this.cycleProgress,
            hasTarget: !!this.currentTarget,
            targetDistance: this.currentTarget ? this.getDistanceToTarget(this.currentTarget) : null
        };
    }
};

module.exports = { LaserSystemDesign, LaserSystemStates };

// Auto-initialize when script is loaded
if (typeof window !== 'undefined') {
    setTimeout(() => {
        LaserSystemDesign.init();
    }, 0);
}
