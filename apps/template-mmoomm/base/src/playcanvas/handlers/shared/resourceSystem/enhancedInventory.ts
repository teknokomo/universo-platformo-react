// Universo Platformo | MMOOMM Enhanced Inventory System
// Advanced inventory with material density support

import { getMaterialDensity, weightToVolume, volumeToWeight, calculateMaterialValue } from './materialDensity';

/**
 * Enhanced inventory item with weight and volume tracking
 */
export interface InventoryItem {
    materialType: string;
    weightInTons: number;
    volumeInM3: number;
    value: number;
}

/**
 * Enhanced inventory system with material density support
 */
export interface EnhancedInventorySystem {
    maxCapacity: number; // m³
    currentVolume: number; // m³
    currentWeight: number; // tons
    items: Record<string, InventoryItem>;
    
    // Core methods
    addItem(materialType: string, amount: number, unit?: 'tons' | 'volume'): boolean;
    removeItem(materialType: string, amount: number, unit?: 'tons' | 'volume'): boolean;
    
    // Information methods
    getCapacityInfo(): {
        volumeUsed: number;
        volumeMax: number;
        volumeFree: number;
        volumePercentage: number;
        totalWeight: number;
        totalValue: number;
    };
    
    getItemList(): Array<{
        materialType: string;
        name: string;
        weight: number;
        volume: number;
        value: number;
        density: number;
        category: string;
    }>;
    
    // Utility methods
    canFit(materialType: string, amount: number, unit?: 'tons' | 'volume'): boolean;
    getTotalValue(): number;
    getItemsByCategory(category: string): InventoryItem[];
}

/**
 * Creates enhanced inventory system with material density support
 */
export function createEnhancedInventorySystem(
    maxCapacity: number = 20,
    initialItems: Record<string, number> = {}
): EnhancedInventorySystem {
    const inventory: EnhancedInventorySystem = {
        maxCapacity,
        currentVolume: 0,
        currentWeight: 0,
        items: {},
        
        addItem(materialType: string, amount: number, unit: 'tons' | 'volume' = 'tons'): boolean {
            // Calculate volume needed
            let volumeToAdd: number;
            let weightToAdd: number;
            
            if (unit === 'tons') {
                weightToAdd = amount;
                volumeToAdd = weightToVolume(materialType, amount);
            } else {
                volumeToAdd = amount;
                weightToAdd = volumeToWeight(materialType, amount);
            }
            
            // Check if we have space
            if (this.currentVolume + volumeToAdd > this.maxCapacity) {
                return false;
            }
            
            // Add or update item
            if (this.items[materialType]) {
                this.items[materialType].weightInTons += weightToAdd;
                this.items[materialType].volumeInM3 += volumeToAdd;
                this.items[materialType].value = calculateMaterialValue(
                    materialType, 
                    this.items[materialType].weightInTons
                );
            } else {
                this.items[materialType] = {
                    materialType,
                    weightInTons: weightToAdd,
                    volumeInM3: volumeToAdd,
                    value: calculateMaterialValue(materialType, weightToAdd)
                };
            }
            
            this.currentVolume += volumeToAdd;
            this.currentWeight += weightToAdd;
            
            return true;
        },
        
        removeItem(materialType: string, amount: number, unit: 'tons' | 'volume' = 'tons'): boolean {
            if (!this.items[materialType]) return false;
            
            let volumeToRemove: number;
            let weightToRemove: number;
            
            if (unit === 'tons') {
                weightToRemove = amount;
                volumeToRemove = weightToVolume(materialType, amount);
            } else {
                volumeToRemove = amount;
                weightToRemove = volumeToWeight(materialType, amount);
            }
            
            // Check if we have enough
            if (this.items[materialType].weightInTons < weightToRemove) {
                return false;
            }
            
            // Remove item
            this.items[materialType].weightInTons -= weightToRemove;
            this.items[materialType].volumeInM3 -= volumeToRemove;
            this.items[materialType].value = calculateMaterialValue(
                materialType,
                this.items[materialType].weightInTons
            );
            
            this.currentVolume -= volumeToRemove;
            this.currentWeight -= weightToRemove;
            
            // Remove if empty
            if (this.items[materialType].weightInTons <= 0) {
                delete this.items[materialType];
            }
            
            return true;
        },
        
        getCapacityInfo() {
            return {
                volumeUsed: Math.round(this.currentVolume * 100) / 100,
                volumeMax: this.maxCapacity,
                volumeFree: Math.round((this.maxCapacity - this.currentVolume) * 100) / 100,
                volumePercentage: Math.round((this.currentVolume / this.maxCapacity) * 100),
                totalWeight: Math.round(this.currentWeight * 100) / 100,
                totalValue: this.getTotalValue()
            };
        },
        
        getItemList() {
            return Object.values(this.items).map(item => {
                const material = getMaterialDensity(item.materialType);
                return {
                    materialType: item.materialType,
                    name: material.name,
                    weight: Math.round(item.weightInTons * 100) / 100,
                    volume: Math.round(item.volumeInM3 * 100) / 100,
                    value: Math.round(item.value),
                    density: material.density,
                    category: material.category
                };
            });
        },
        
        canFit(materialType: string, amount: number, unit: 'tons' | 'volume' = 'tons'): boolean {
            const volumeNeeded = unit === 'tons' 
                ? weightToVolume(materialType, amount)
                : amount;
            return this.currentVolume + volumeNeeded <= this.maxCapacity;
        },
        
        getTotalValue(): number {
            return Math.round(Object.values(this.items).reduce((total, item) => total + item.value, 0));
        },
        
        getItemsByCategory(category: string): InventoryItem[] {
            return Object.values(this.items).filter(item => {
                const material = getMaterialDensity(item.materialType);
                return material.category === category;
            });
        }
    };
    
    // Initialize with provided items
    Object.entries(initialItems).forEach(([materialType, amount]) => {
        inventory.addItem(materialType, amount, 'tons');
    });
    
    return inventory;
}

/**
 * Generates JavaScript code for enhanced inventory system
 */
export function generateEnhancedInventoryCode(
    maxCapacity: number = 20,
    includeLogging: boolean = false,
    includeEvents: boolean = false
): string {
    const addItemLogging = includeLogging ? `
                console.log('[Enhanced Inventory] Added', amount, unit, 'of', materialType, '- Volume:', this.currentVolume + '/' + this.maxCapacity);` : '';
    
    const removeItemLogging = includeLogging ? `
                console.log('[Enhanced Inventory] Removed', amount, unit, 'of', materialType);` : '';
    
    const addItemEvents = includeEvents ? `
                if (window.app) window.app.fire('inventory:itemAdded', { materialType, amount, unit });` : '';
    
    return `{
        maxCapacity: ${maxCapacity},
        currentVolume: 0,
        currentWeight: 0,
        items: {},
        
        // Material density data (embedded for runtime use)
        materialDensities: ${JSON.stringify(require('./materialDensity').MATERIAL_DENSITIES, null, 8)},
        
        getMaterialDensity(materialType) {
            return this.materialDensities[materialType] || this.materialDensities.asteroidMass;
        },
        
        weightToVolume(materialType, weightInTons) {
            const density = this.getMaterialDensity(materialType).density;
            return weightInTons / density;
        },
        
        volumeToWeight(materialType, volumeInM3) {
            const density = this.getMaterialDensity(materialType).density;
            return volumeInM3 * density;
        },
        
        addItem(materialType, amount, unit = 'tons') {
            let volumeToAdd, weightToAdd;
            
            if (unit === 'tons') {
                weightToAdd = amount;
                volumeToAdd = this.weightToVolume(materialType, amount);
            } else {
                volumeToAdd = amount;
                weightToAdd = this.volumeToWeight(materialType, amount);
            }
            
            if (this.currentVolume + volumeToAdd > this.maxCapacity) {
                return false;
            }
            
            if (this.items[materialType]) {
                this.items[materialType].weightInTons += weightToAdd;
                this.items[materialType].volumeInM3 += volumeToAdd;
            } else {
                this.items[materialType] = {
                    materialType,
                    weightInTons: weightToAdd,
                    volumeInM3: volumeToAdd
                };
            }
            
            this.currentVolume += volumeToAdd;
            this.currentWeight += weightToAdd;${addItemLogging}${addItemEvents}
            
            return true;
        },
        
        removeItem(materialType, amount, unit = 'tons') {
            if (!this.items[materialType]) return false;
            
            let volumeToRemove, weightToRemove;
            
            if (unit === 'tons') {
                weightToRemove = amount;
                volumeToRemove = this.weightToVolume(materialType, amount);
            } else {
                volumeToRemove = amount;
                weightToRemove = this.volumeToWeight(materialType, amount);
            }
            
            if (this.items[materialType].weightInTons < weightToRemove) {
                return false;
            }
            
            this.items[materialType].weightInTons -= weightToRemove;
            this.items[materialType].volumeInM3 -= volumeToRemove;
            this.currentVolume -= volumeToRemove;
            this.currentWeight -= weightToRemove;
            
            if (this.items[materialType].weightInTons <= 0) {
                delete this.items[materialType];
            }${removeItemLogging}
            
            return true;
        },
        
        getCapacityInfo() {
            return {
                volumeUsed: Math.round(this.currentVolume * 100) / 100,
                volumeMax: this.maxCapacity,
                volumeFree: Math.round((this.maxCapacity - this.currentVolume) * 100) / 100,
                volumePercentage: Math.round((this.currentVolume / this.maxCapacity) * 100),
                totalWeight: Math.round(this.currentWeight * 100) / 100
            };
        },
        
        getItemList() {
            return Object.values(this.items).map(item => {
                const material = this.getMaterialDensity(item.materialType);
                return {
                    materialType: item.materialType,
                    name: material.name,
                    weight: Math.round(item.weightInTons * 100) / 100,
                    volume: Math.round(item.volumeInM3 * 100) / 100,
                    density: material.density,
                    category: material.category
                };
            });
        }
    }`;
}
