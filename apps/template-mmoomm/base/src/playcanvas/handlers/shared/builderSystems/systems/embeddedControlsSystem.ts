// Universo Platformo | MMOOMM Embedded Controls System
// Extracts window.SpaceControls from PlayCanvasMMOOMMBuilder

import { BaseEmbeddedSystem } from '../htmlSystems/embeddedSystemsTemplate'

/**
 * Interface for embedded controls system
 */
export interface IEmbeddedControlsSystem {
    name: string
    generateCode(): string
    getDependencies(): string[]
}

/**
 * Embedded Controls System for MMOOMM template
 * Manages window.SpaceControls object and all input handling
 */
export class EmbeddedControlsSystem extends BaseEmbeddedSystem implements IEmbeddedControlsSystem {
    name = 'SpaceControls'

    /**
     * Generate window.SpaceControls JavaScript code
     */
    generateCode(): string {
        // Guarded initialization to avoid duplicate listeners on reload
        return `        (function(){
            if (window.SpaceControls && window.SpaceControls._initialized) {
                console.log('[SpaceControls] Already initialized');
                return;
            }
            window.SpaceControls = {
            keys: {},

            // Initialize input handling
            init() {
                console.log('[SpaceControls] Initializing input handling...');

                // Keyboard input
                window.addEventListener('keydown', (e) => {
                    this.keys[e.code] = true;

                    // Handle special keys
                    if (e.code === 'Space') {
                        e.preventDefault();
                        this.fireWeapon();
                    } else if (e.code === 'KeyF') {
                        this.interact();
                    }
                });

                window.addEventListener('keyup', (e) => {
                    this.keys[e.code] = false;
                });

                // Mouse wheel for camera zoom
                window.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    this.handleCameraZoom(e.deltaY);
                }, { passive: false });

                // Update loop
                if (window.app) {
                    window.app.on('update', (dt) => {
                        this.updateShipMovement(dt);
                        this.updateCamera(dt);
                    });
                }

                this.showControlInstructions();
            },

            // IMPROVED: New ship movement system with rotation-based controls
            updateShipMovement(dt) {
                const ship = window.playerShip;
                if (!ship || !ship.shipController) {
                    return;
                }

                const controller = ship.shipController;
                let hasInput = false;

                // Check for Shift modifier (for strafe mode)
                const isShiftPressed = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

                // NEW: Thrust controls (W/S for forward/backward)
                let thrustForward = false;
                let thrustBackward = false;

                // Rotation flags
                let rotateUp = false;
                let rotateDown = false;
                let rotateLeft = false;
                let rotateRight = false;
                // Roll flags
                let rollLeft = false;   // E
                let rollRight = false;  // C

                // Strafe flags (Shift held)
                let strafeLeft = false;
                let strafeRight = false;
                let strafeUp = false;
                let strafeDown = false;

                if (this.keys['KeyW']) { thrustForward = true; hasInput = true; }
                if (this.keys['KeyS']) { thrustBackward = true; hasInput = true; }

                if (isShiftPressed) {
                    // SHIFT + WASD = Strafe movement (no rotation)
                    if (this.keys['KeyA']) { strafeLeft = true; hasInput = true; }
                    if (this.keys['KeyD']) { strafeRight = true; hasInput = true; }
                    if (this.keys['KeyQ']) { strafeUp = true; hasInput = true; }
                    if (this.keys['KeyZ']) { strafeDown = true; hasInput = true; }
                } else {
                    // Normal mode: QAZD = Rotation + Roll (E/C)
                    if (this.keys['KeyQ']) { rotateUp = true; hasInput = true; }
                    if (this.keys['KeyZ']) { rotateDown = true; hasInput = true; }
                    if (this.keys['KeyA']) { rotateLeft = true; hasInput = true; }
                    if (this.keys['KeyD']) { rotateRight = true; hasInput = true; }
                    if (this.keys['KeyE']) { rollLeft = true; hasInput = true; }
                    if (this.keys['KeyC']) { rollRight = true; hasInput = true; }
                }

                // LEGACY: Arrow keys still work for rotation (backup)
                if (this.keys['ArrowUp']) { rotateUp = true; hasInput = true; }
                if (this.keys['ArrowDown']) { rotateDown = true; hasInput = true; }
                if (this.keys['ArrowLeft']) { rotateLeft = true; hasInput = true; }
                if (this.keys['ArrowRight']) { rotateRight = true; hasInput = true; }

                // Apply thrust (forward/backward along ship's nose direction)
                if (thrustForward) {
                    // W = fly forward (toward ship's nose)
                    const forward = ship.forward.clone().scale(-1);
                    controller.thrust(forward);
                } else if (thrustBackward) {
                    // S = fly backward (reverse)
                    const backward = ship.forward.clone().scale(0.7);
                    controller.thrust(backward);
                } else if (strafeLeft || strafeRight || strafeUp || strafeDown) {
                    // STRAFE: Shift + WASD/QZ moves ship sideways/up/down using maneuver thrusters
                    const strafeVector = new pc.Vec3();
                    if (strafeLeft)  strafeVector.x += 1;  // Shift+A  → left (local -X wing)
                    if (strafeRight) strafeVector.x -= 1;  // Shift+D  → right
                    if (strafeUp)    strafeVector.y += 1;  // Shift+Q  → up
                    if (strafeDown)  strafeVector.y -= 1;  // Shift+Z  → down

                    // Convert from local to world based on current ship orientation
                    const worldStrafe = ship.getRotation().transformVector(strafeVector.normalize());
                    controller.thrust(worldStrafe.scale(0.8)); // Maneuver thrusters weaker
                } else {
                    controller.stopThrust();
                }

                // FIXED: Apply rotation with correct directions for camera-behind-ship setup
                const rotationVector = new pc.Vec3();

                // Pitch (up/down rotation around X-axis) - FIXED directions
                if (rotateUp) rotationVector.x += 1;    // Q = positive X rotation (nose up)
                if (rotateDown) rotationVector.x -= 1;  // Z = negative X rotation (nose down)

                // Yaw (left/right rotation around Y-axis) - FIXED directions
                if (rotateLeft) rotationVector.y += 1;  // A = positive Y rotation (turn left)
                if (rotateRight) rotationVector.y -= 1; // D = negative Y rotation (turn right)

                // Roll mapping
                if (rollLeft)  rotationVector.z += 1;   // E = roll left (counter-clockwise)
                if (rollRight) rotationVector.z -= 1;   // C = roll right (clockwise)

                // Apply rotation if any rotation input detected
                if (rotationVector.length() > 0) {
                    // Normalize for consistent speed in diagonal movements
                    rotationVector.normalize();
                    controller.rotate(rotationVector, dt);
                }
            },

            // Show control instructions in console
            showControlInstructions() {
                console.log('=== SPACE SHIP CONTROLS ===');
                console.log('WASD - Move Forward/Back/Turn Left/Right');
                console.log('Shift+WASD - Strafe Movement');
                console.log('Q/Z - Move Up/Down');
                console.log('E/C - Roll Left/Right');
                console.log('Arrow Keys - Pitch Up/Down');
                console.log('Space - Fire Laser (Mining)');
                console.log('F - Interact (Trading)');
                console.log('Mouse Wheel - Camera Zoom');
                console.log('===========================');
            },

            // Update camera following behavior
            updateCamera(dt) {
                if (!window.playerShip || !window.spaceCamera) return;

                const ship = window.playerShip;
                
                // Use ship's camera controller if available
                if (ship.cameraController) {
                    ship.cameraController.update(dt);
                } else {
                    // Fallback to basic camera following
                    this.basicCameraFollow();
                }
            },

            // Basic camera following (fallback)
            basicCameraFollow() {
                if (!window.playerShip || !window.spaceCamera) return;

                const ship = window.playerShip;
                const camera = window.spaceCamera;
                const shipPos = ship.getPosition();
                const shipRot = ship.getRotation();

                // Position camera behind ship
                const offset = shipRot.transformVector(new pc.Vec3(0, 5, -15));
                camera.setPosition(shipPos.x + offset.x, shipPos.y + offset.y, shipPos.z + offset.z);
                
                // Look at ship
                camera.lookAt(shipPos);
            },

            // ADDED: Handle camera zoom with mouse wheel
            handleCameraZoom(deltaY) {
                const ship = window.playerShip;
                if (!ship || !ship.cameraController) return;

                // Zoom sensitivity
                const zoomSpeed = 2;
                const zoomDelta = deltaY > 0 ? zoomSpeed : -zoomSpeed;

                ship.cameraController.zoom(zoomDelta);

                // Optional: Log zoom level for debugging
                if (Math.random() < 0.1) { // Log occasionally to avoid spam
                    console.log('[Camera] Zoom distance:', ship.cameraController.distance.toFixed(1));
                }
            },

            // Activate laser mining system
            fireWeapon() {
                const ship = window.playerShip;
                if (ship && ship.laserSystem) {
                    const activated = ship.laserSystem.activate();
                    if (activated) {
                        console.log('[SpaceControls] Laser mining system activated');
                    } else {
                        console.log('[SpaceControls] Laser system busy or unavailable');
                    }
                } else {
                    console.warn('[SpaceControls] No laser system found on player ship');
                }
            },

            // Interact with nearby objects (trading)
            interact() {
                if (!window.playerShip) return;

                const ship = window.playerShip;
                
                // Check if near trading station
                if (ship.nearStation) {
                    if (window.SpaceHUD && window.SpaceHUD.showTradingPanel) {
                        window.SpaceHUD.showTradingPanel(ship.nearStation);
                    }
                } else {
                    // English comments only inside code
                    // Improve diagnostic: find nearest station and log distance vs interactionRange
                    let nearest = null;
                    let nearestId = null;
                    let nearestDist = Number.POSITIVE_INFINITY;
                    let nearestRange = null;
                    const shipPos = ship.getPosition();
                    // Helper distance to station AABB (reuses cached AABB if present)
                    const distanceToStation = (station) => {
                        if (!station.__stationAabb || station.__stationAabb.__empty) {
                            // Build cached union AABB lazily
                            const collectMeshAabbs = (root) => {
                                const out = [];
                                const stack = [root];
                                while (stack.length) {
                                    const node = stack.pop();
                                    if (node?.model?.meshInstances) node.model.meshInstances.forEach(mi => mi?.aabb && out.push(mi.aabb));
                                    if (node?.render?.meshInstances) node.render.meshInstances.forEach(mi => mi?.aabb && out.push(mi.aabb));
                                    if (node?.children?.length) stack.push(...node.children);
                                }
                                return out;
                            };
                            const buildUnionAabb = (aabbs) => {
                                if (!aabbs.length) return null;
                                const first = aabbs[0];
                                const min = first.center.clone().sub(first.halfExtents);
                                const max = first.center.clone().add(first.halfExtents);
                                for (let i = 1; i < aabbs.length; i++) {
                                    const bb = aabbs[i];
                                    const bbMin = bb.center.clone().sub(bb.halfExtents);
                                    const bbMax = bb.center.clone().add(bb.halfExtents);
                                    min.x = Math.min(min.x, bbMin.x);
                                    min.y = Math.min(min.y, bbMin.y);
                                    min.z = Math.min(min.z, bbMin.z);
                                    max.x = Math.max(max.x, bbMax.x);
                                    max.y = Math.max(max.y, bbMax.y);
                                    max.z = Math.max(max.z, bbMax.z);
                                }
                                return { min, max };
                            };
                            const aabbs = collectMeshAabbs(station);
                            const union = buildUnionAabb(aabbs);
                            station.__stationAabb = union || { __empty: true };
                        }
                        if (station.__stationAabb && !station.__stationAabb.__empty) {
                            const aabb = station.__stationAabb;
                            const cx = Math.max(aabb.min.x, Math.min(shipPos.x, aabb.max.x));
                            const cy = Math.max(aabb.min.y, Math.min(shipPos.y, aabb.max.y));
                            const cz = Math.max(aabb.min.z, Math.min(shipPos.z, aabb.max.z));
                            const dx = shipPos.x - cx, dy = shipPos.y - cy, dz = shipPos.z - cz;
                            return Math.sqrt(dx * dx + dy * dy + dz * dz);
                        }
                        // Fallback to center distance
                        return station.getPosition().distance(shipPos);
                    };

                    if (window.MMOEntities && window.MMOEntities.size > 0) {
                        window.MMOEntities.forEach((e, id) => {
                            if (e?.tradingPost) {
                                const d = distanceToStation(e);
                                if (d < nearestDist) {
                                    nearestDist = d;
                                    nearest = e;
                                    nearestId = id;
                                    nearestRange = e.tradingPost?.interactionRange ?? null;
                                }
                            }
                        });
                    }

                    if (nearest) {
                        console.log('[SpaceControls] No trading station nearby (closest:', nearestId, 'dist:', nearestDist.toFixed(1), 'range:', (nearestRange ?? 'n/a'), ')');
                    } else {
                        console.log('[SpaceControls] No trading station nearby');
                    }
                }
            }
            };
            window.SpaceControls._initialized = true;
        })();`;
    }

    /**
     * Get system dependencies
     */
    getDependencies(): string[] {
        return ['SpaceHUD']; // SpaceControls depends on SpaceHUD for interaction feedback
    }
}
