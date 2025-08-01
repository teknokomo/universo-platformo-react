// Universo Platformo | MMOOMM Embedded HUD System
// Extracts window.SpaceHUD from PlayCanvasMMOOMMBuilder

import { BaseEmbeddedSystem } from '../htmlSystems/embeddedSystemsTemplate'

/**
 * Interface for embedded HUD system
 */
export interface IEmbeddedHUDSystem {
    name: string
    generateCode(): string
    getDependencies(): string[]
}

/**
 * Embedded HUD System for MMOOMM template
 * Manages window.SpaceHUD object and all HUD-related functionality
 */
export class EmbeddedHUDSystem extends BaseEmbeddedSystem implements IEmbeddedHUDSystem {
    name = 'SpaceHUD'

    /**
     * Generate window.SpaceHUD JavaScript code
     */
    generateCode(): string {
        return this.createGlobalObject('SpaceHUD', `{
            // Update ship status display
            updateShipStatus(ship) {
                if (!ship) return;

                // Update currency
                const currency = ship.currency || 0;
                const currencyElement = document.getElementById('ship-currency');
                if (currencyElement) {
                    currencyElement.textContent = currency + ' Inmo';
                }

                // Update inventory
                if (ship.inventory) {
                    const capacity = ship.inventory.getCapacityInfo();
                    
                    const capacityElement = document.getElementById('cargo-capacity');
                    if (capacityElement) {
                        capacityElement.textContent = 
                            capacity.current.toFixed(1) + '/' + capacity.max + ' m³';
                    }
                    
                    const cargoBar = document.getElementById('cargo-bar');
                    if (cargoBar) {
                        cargoBar.style.width = capacity.percentage + '%';
                    }

                    // Update item list
                    const itemsContainer = document.getElementById('cargo-items');
                    if (itemsContainer) {
                        const items = ship.inventory.getItemList();

                        if (items.length === 0) {
                            itemsContainer.innerHTML = '<div class="item"><span>Empty</span><span>-</span></div>';
                        } else {
                            itemsContainer.innerHTML = items.map(item =>
                                '<div class="item"><span>' + item.type + '</span><span>' + item.amount.toFixed(1) + '</span></div>'
                            ).join('');
                        }
                    }
                }

                // Update laser system status
                if (ship.laserSystem) {
                    const laserElement = document.getElementById('laser-status');
                    if (laserElement) {
                        const status = ship.laserSystem.isActive ? 'Active' : 'Ready';
                        const color = ship.laserSystem.isActive ? '#ff0000' : '#00ff00';
                        laserElement.innerHTML = '<span style="color: ' + color + '">Laser: ' + status + '</span>';
                    }
                }
            },

            // Show trading panel
            showTradingPanel(stationInfo) {
                const panel = document.getElementById('trading-panel');
                if (panel) {
                    panel.style.display = 'block';
                    
                    const stationName = document.getElementById('station-name');
                    if (stationName && stationInfo) {
                        stationName.textContent = stationInfo.name || 'Trading Station';
                    }
                }
            },

            // Hide trading panel
            hideTradingPanel() {
                const panel = document.getElementById('trading-panel');
                if (panel) {
                    panel.style.display = 'none';
                }
            },

            // Update mini-map display
            updateMiniMap(entities) {
                const canvas = document.getElementById('mini-map-canvas');
                if (!canvas || !entities) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw background
                ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw border
                ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
                ctx.strokeRect(0, 0, canvas.width, canvas.height);

                // Draw entities
                if (window.MMOEntities && window.MMOEntities.size > 0) {
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const scale = 0.1; // Adjust scale as needed

                    window.MMOEntities.forEach((entity, id) => {
                        if (!entity || !entity.getPosition) return;

                        const pos = entity.getPosition();
                        const x = centerX + (pos.x * scale);
                        const y = centerY + (pos.z * scale);

                        // Skip if outside canvas
                        if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;

                        ctx.beginPath();
                        
                        // Different colors for different entity types
                        if (entity === window.playerShip) {
                            ctx.fillStyle = '#00ff00'; // Green for player
                            ctx.arc(x, y, 3, 0, 2 * Math.PI);
                        } else if (entity.tags && entity.tags.has('asteroid')) {
                            ctx.fillStyle = '#888888'; // Gray for asteroids
                            ctx.arc(x, y, 2, 0, 2 * Math.PI);
                        } else if (entity.tags && entity.tags.has('station')) {
                            ctx.fillStyle = '#0088ff'; // Blue for stations
                            ctx.arc(x, y, 4, 0, 2 * Math.PI);
                        } else {
                            ctx.fillStyle = '#ffffff'; // White for others
                            ctx.arc(x, y, 1, 0, 2 * Math.PI);
                        }
                        
                        ctx.fill();
                    });
                }
            },

            // Update world name display
            updateWorld(worldName) {
                const worldElement = document.getElementById('current-world');
                if (worldElement && worldName) {
                    worldElement.textContent = worldName;
                    window.currentWorld = worldName;
                }
            }
        }`);
    }

    /**
     * Get system dependencies
     */
    getDependencies(): string[] {
        return []; // SpaceHUD has no dependencies on other embedded systems
    }
}
