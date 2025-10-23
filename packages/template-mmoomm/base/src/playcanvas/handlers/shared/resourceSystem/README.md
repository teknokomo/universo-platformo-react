# Universo Platformo | Enhanced Resource System

Advanced material density and inventory system for realistic space mining simulation.

## 🎯 Overview

The Enhanced Resource System introduces realistic material physics to space mining:

- **Material Density**: Different materials have different densities (tons/m³)
- **Volume vs Weight**: Separate tracking of weight and volume
- **Realistic Mining**: Heavy metals take less space but are harder to mine
- **Economic Balance**: Rare materials are more valuable but harder to store efficiently

## 📊 Material Categories

### Common Materials (Low Value, Varied Density)
- **Asteroid Mass**: 2.5 t/m³ - Mixed rock/metal composition
- **Carbonaceous Rock**: 1.8 t/m³ - Carbon-rich, lightweight
- **Silicate Rock**: 2.2 t/m³ - Silicon-based rocky material
- **Iron**: 7.9 t/m³ - Dense but common metal
- **Aluminum**: 2.7 t/m³ - Light metal, good volume efficiency

### Rare Materials (Medium Value, High Density)
- **Titanium**: 4.5 t/m³ - Strong but lightweight
- **Cobalt**: 8.9 t/m³ - Strategic metal for alloys
- **Lithium**: 0.5 t/m³ - Very light, excellent volume efficiency

### Precious Materials (High Value, Very Dense)
- **Gold**: 19.3 t/m³ - Extremely dense, small volume
- **Platinum**: 21.5 t/m³ - Densest common material
- **Palladium**: 12.0 t/m³ - Rare catalyst metal

### Exotic Materials (Extreme Value, Special Properties)
- **Antimatter**: 0.001 t/m³ - Almost weightless but incredibly valuable
- **Quantum Crystals**: 15.0 t/m³ - Dense crystalline structures
- **Dark Matter**: 0.1 t/m³ - Mysterious low-density material

## 🔧 Technical Implementation

### Material Density System
```typescript
// Get material properties
const material = getMaterialDensity('gold');
// { density: 19.3, name: 'Gold', category: 'precious', baseValue: 2000 }

// Convert between weight and volume
const volume = weightToVolume('gold', 1); // 1 ton of gold = 0.052 m³
const weight = volumeToWeight('gold', 1); // 1 m³ of gold = 19.3 tons
```

### Enhanced Inventory
```typescript
// Create inventory with 20 m³ capacity
const inventory = createEnhancedInventorySystem(20);

// Add materials by weight or volume
inventory.addItem('gold', 1, 'tons');     // Adds 1 ton (0.052 m³)
inventory.addItem('lithium', 5, 'volume'); // Adds 5 m³ (2.5 tons)

// Get detailed capacity info
const info = inventory.getCapacityInfo();
// { volumeUsed: 5.052, volumeMax: 20, totalWeight: 3.5, totalValue: 3000 }
```

### Enhanced Mineable Component
```typescript
// Asteroid with material-specific properties
entity.mineable = {
    resourceType: 'platinum',
    maxYield: 2,           // 2 tons of platinum
    asteroidVolume: 5,     // 5 m³ physical asteroid size
    hardness: 3,           // Mining difficulty (1-5)
    
    // Automatic density calculations
    getVolumeFromWeight(2), // 2 tons = 0.093 m³ of platinum
    getMaterialDensity()    // { density: 21.5, name: 'Platinum', ... }
};
```

## 🎮 Gameplay Impact

### Strategic Decisions
1. **Volume vs Value**: Do you mine lightweight lithium (great volume efficiency) or dense platinum (high value)?
2. **Cargo Optimization**: Mix materials to maximize cargo hold efficiency
3. **Mining Difficulty**: Harder materials require more time/energy but offer better rewards

### Realistic Physics
- **1 ton of gold** = 0.052 m³ (very dense, small volume)
- **1 ton of lithium** = 2.0 m³ (light metal, large volume)
- **1 ton of antimatter** = 1000 m³ (almost weightless, huge volume)

### Economic Balance
- **Common materials**: Easy to mine, low value, varied efficiency
- **Rare materials**: Moderate difficulty, good value, decent efficiency  
- **Precious materials**: Hard to mine, high value, excellent space efficiency
- **Exotic materials**: Extreme difficulty, extreme value, special properties

## 🔄 Migration from Simple System

### Backward Compatibility
The enhanced system maintains compatibility with existing simple inventory:

```typescript
// Old system (volume-only)
inventory.addItem('asteroidMass', 5); // 5 m³

// New system (automatic conversion)
inventory.addItem('asteroidMass', 2, 'tons'); // 2 tons = 0.8 m³ (density 2.5)
```

### Gradual Adoption
1. **Phase 1**: Add material density data
2. **Phase 2**: Update mineable components with new fields
3. **Phase 3**: Migrate inventory to enhanced system
4. **Phase 4**: Update UI to show weight/volume/value

## 📈 Performance Considerations

- **Embedded Data**: Material densities embedded in generated code for runtime efficiency
- **Calculation Caching**: Density calculations cached where possible
- **Minimal Overhead**: Enhanced system adds ~2KB to generated code
- **Fallback Support**: Graceful degradation to simple system if needed

## 🎯 Future Enhancements

- **Alloy System**: Combine materials to create new alloys
- **Processing Plants**: Convert raw materials to refined products
- **Market Dynamics**: Dynamic pricing based on supply/demand
- **Research Tree**: Unlock new materials and processing techniques
- **Environmental Effects**: Material behavior in different space conditions
