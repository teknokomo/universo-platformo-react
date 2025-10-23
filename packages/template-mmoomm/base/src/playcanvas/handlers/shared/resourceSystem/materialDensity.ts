// Universo Platformo | MMOOMM Material Density System
// Realistic material densities for space mining simulation

/**
 * Material density data (tons per cubic meter)
 * Based on real-world material densities for space mining simulation
 */
export interface MaterialDensity {
    name: string;
    density: number; // tons per m³
    category: 'common' | 'rare' | 'precious' | 'exotic';
    description: string;
    baseValue: number; // Inmo per ton
}

/**
 * Comprehensive material density database
 */
export const MATERIAL_DENSITIES: Record<string, MaterialDensity> = {
    // Common asteroid materials
    asteroidMass: {
        name: 'Asteroid Mass',
        density: 2.5, // Mixed rock/metal
        category: 'common',
        description: 'Raw asteroid material with mixed composition',
        baseValue: 10
    },
    
    carbonaceousRock: {
        name: 'Carbonaceous Rock',
        density: 1.8,
        category: 'common', 
        description: 'Carbon-rich asteroid material',
        baseValue: 15
    },
    
    silicateRock: {
        name: 'Silicate Rock',
        density: 2.2,
        category: 'common',
        description: 'Silicon-based rocky material',
        baseValue: 12
    },
    
    // Common metals
    iron: {
        name: 'Iron',
        density: 7.9,
        category: 'common',
        description: 'Pure iron ore',
        baseValue: 50
    },
    
    nickel: {
        name: 'Nickel',
        density: 8.9,
        category: 'common',
        description: 'Nickel ore',
        baseValue: 80
    },
    
    aluminum: {
        name: 'Aluminum',
        density: 2.7,
        category: 'common',
        description: 'Aluminum ore',
        baseValue: 60
    },
    
    // Rare metals
    titanium: {
        name: 'Titanium',
        density: 4.5,
        category: 'rare',
        description: 'Lightweight but strong metal',
        baseValue: 200
    },
    
    cobalt: {
        name: 'Cobalt',
        density: 8.9,
        category: 'rare',
        description: 'Strategic metal for alloys',
        baseValue: 300
    },
    
    lithium: {
        name: 'Lithium',
        density: 0.5,
        category: 'rare',
        description: 'Light metal for energy storage',
        baseValue: 400
    },
    
    // Precious metals
    gold: {
        name: 'Gold',
        density: 19.3,
        category: 'precious',
        description: 'Highly valuable precious metal',
        baseValue: 2000
    },
    
    platinum: {
        name: 'Platinum',
        density: 21.5,
        category: 'precious',
        description: 'Extremely valuable catalyst metal',
        baseValue: 3000
    },
    
    palladium: {
        name: 'Palladium',
        density: 12.0,
        category: 'precious',
        description: 'Rare precious metal',
        baseValue: 2500
    },
    
    // Exotic materials
    antimatter: {
        name: 'Antimatter',
        density: 0.001, // Extremely light but valuable
        category: 'exotic',
        description: 'Exotic energy source',
        baseValue: 100000
    },
    
    quantumCrystals: {
        name: 'Quantum Crystals',
        density: 15.0,
        category: 'exotic',
        description: 'Crystalline structures with quantum properties',
        baseValue: 50000
    },
    
    darkMatter: {
        name: 'Dark Matter',
        density: 0.1,
        category: 'exotic',
        description: 'Mysterious matter with unknown properties',
        baseValue: 75000
    }
};

/**
 * Get material density information
 */
export function getMaterialDensity(materialType: string): MaterialDensity {
    return MATERIAL_DENSITIES[materialType] || MATERIAL_DENSITIES.asteroidMass;
}

/**
 * Convert weight to volume based on material density
 */
export function weightToVolume(materialType: string, weightInTons: number): number {
    const density = getMaterialDensity(materialType).density;
    return weightInTons / density; // m³
}

/**
 * Convert volume to weight based on material density
 */
export function volumeToWeight(materialType: string, volumeInM3: number): number {
    const density = getMaterialDensity(materialType).density;
    return volumeInM3 * density; // tons
}

/**
 * Calculate total value of material
 */
export function calculateMaterialValue(materialType: string, weightInTons: number): number {
    const material = getMaterialDensity(materialType);
    return weightInTons * material.baseValue; // Inmo
}

/**
 * Get all materials by category
 */
export function getMaterialsByCategory(category: MaterialDensity['category']): Record<string, MaterialDensity> {
    return Object.fromEntries(
        Object.entries(MATERIAL_DENSITIES).filter(([_, material]) => material.category === category)
    );
}

/**
 * Get material info for UI display
 */
export function getMaterialDisplayInfo(materialType: string, amount: number, unit: 'tons' | 'volume' = 'tons') {
    const material = getMaterialDensity(materialType);
    
    if (unit === 'tons') {
        const volume = weightToVolume(materialType, amount);
        const value = calculateMaterialValue(materialType, amount);
        
        return {
            name: material.name,
            weight: amount,
            volume: Math.round(volume * 100) / 100,
            density: material.density,
            value: Math.round(value),
            category: material.category
        };
    } else {
        const weight = volumeToWeight(materialType, amount);
        const value = calculateMaterialValue(materialType, weight);
        
        return {
            name: material.name,
            weight: Math.round(weight * 100) / 100,
            volume: amount,
            density: material.density,
            value: Math.round(value),
            category: material.category
        };
    }
}
