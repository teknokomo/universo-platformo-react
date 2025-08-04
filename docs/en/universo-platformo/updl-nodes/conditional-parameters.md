# Conditional Parameter Display in UPDL Nodes

## Overview

UPDL nodes support conditional parameter display, allowing you to show only relevant fields in the "Additional Parameters" dialog based on the values of other fields. This feature significantly improves the user experience by reducing interface clutter and showing only the parameters that are applicable to the current configuration.

## How It Works

The conditional display system uses a `show` property in parameter definitions to specify when a parameter should be visible. The system evaluates these conditions in real-time as users change field values.

### Basic Syntax

```javascript
{
    name: 'parameterName',
    label: 'Parameter Label',
    type: 'string',
    additionalParams: true,
    show: {
        'inputs.fieldName': ['value1', 'value2']
    }
}
```

### Supported Condition Types

#### Single Value Condition
```javascript
show: {
    'inputs.componentType': ['render']
}
```
Shows the parameter only when `componentType` equals `'render'`.

#### Multiple Value Condition (OR Logic)
```javascript
show: {
    'inputs.objectType': ['sphere', 'cylinder']
}
```
Shows the parameter when `objectType` equals either `'sphere'` OR `'cylinder'`.

#### Boolean Condition
```javascript
show: {
    'inputs.fog': [true]
}
```
Shows the parameter only when `fog` is `true`.

#### Legacy Data Syntax (Compatibility)
```javascript
show: {
    'data.cameraType': ['perspective']
}
```
Alternative syntax for backward compatibility.

## UPDL Nodes with Conditional Parameters

### Component Node

The Component Node demonstrates the most extensive use of conditional parameters:

#### Render Component Parameters
- **primitive** - Shows for `componentType: 'render'`
- **color** - Shows for `componentType: 'render'`

#### Script Component Parameters
- **scriptName** - Shows for `componentType: 'script'`

#### Space MMO Component Parameters
- **maxCapacity, currentLoad** - Show for `componentType: 'inventory'`
- **fireRate, damage** - Show for `componentType: 'weapon'`
- **pricePerTon, interactionRange** - Show for `componentType: 'trading'`
- **resourceType, maxYield, asteroidVolume, hardness** - Show for `componentType: 'mineable'`
- **targetWorld, cooldownTime** - Show for `componentType: 'portal'`

### Object Node

Shape-specific parameters are shown based on the selected object type:

- **width** - Shows for `objectType: ['box', 'plane']`
- **height** - Shows for `objectType: ['box', 'plane', 'cylinder']`
- **depth** - Shows for `objectType: ['box']`
- **radius** - Shows for `objectType: ['sphere', 'cylinder']`

### Space Node

Environment-specific parameters:

- **fogDensity** - Shows only when `fog: true`

### Light Node

Light type-specific parameters:

- **positionZ, castShadow** - Show for `lightType: ['point', 'directional']`
- **groundColor** - Shows for `lightType: ['hemisphere']`

### Action Node

Action type-specific parameters:

- **vector, duration** - Show for `actionType: ['move', 'rotate']`
- **dataKey, dataValue** - Show for `actionType: ['setData']`
- **amount** - Shows for `actionType: ['mine', 'trade', 'addToInventory', 'removeFromInventory']`
- **targetWorldId** - Shows for `actionType: ['travel']`
- **stationId** - Shows for `actionType: ['dock', 'undock']`

### Data Node

Data type-specific parameters:

- **isCorrect** - Shows for `dataType: ['answer']`
- **nextSpace** - Shows for `dataType: ['transition', 'answer']`
- **userInputType** - Shows for `dataType: ['intro', 'transition']`
- **pointsValue** - Shows when `enablePoints: true`

### Camera Node

Camera type-specific parameters:

- **fieldOfView** - Shows for `cameraType: ['perspective']`

## Implementation Details

### Technical Architecture

The conditional display system is implemented using a centralized function `shouldShowInputParam()` that:

1. Evaluates `show` conditions for each parameter
2. Supports both `inputs.fieldName` and `data.fieldName` syntax
3. Handles array and single value conditions
4. Provides real-time updates when field values change

### UI Integration

The system integrates with two main UI components:

1. **CanvasNode** - Controls the visibility of the "Flow Control" button
2. **AdditionalParamsDialog** - Filters parameters shown in the dialog

### Performance Considerations

- Conditions are evaluated in real-time without performance impact
- Simple boolean logic ensures fast evaluation
- No complex computations or external dependencies

## Best Practices

### When to Use Conditional Parameters

Use conditional parameters when:
- Parameters are only relevant for specific configurations
- The interface becomes cluttered with too many options
- Different parameter sets apply to different modes or types

### Designing Conditions

1. **Keep conditions simple** - Use straightforward value matching
2. **Group related parameters** - Apply the same condition to related fields
3. **Use descriptive field names** - Make conditions self-documenting
4. **Test all combinations** - Ensure all parameter combinations work correctly

### Example Implementation

```javascript
// In your UPDL node definition
inputs: [
    {
        name: 'nodeType',
        label: 'Node Type',
        type: 'options',
        options: [
            { label: 'Basic', name: 'basic' },
            { label: 'Advanced', name: 'advanced' }
        ],
        default: 'basic'
    },
    {
        name: 'advancedOption1',
        label: 'Advanced Option 1',
        type: 'string',
        additionalParams: true,
        show: {
            'inputs.nodeType': ['advanced']
        }
    },
    {
        name: 'advancedOption2',
        label: 'Advanced Option 2',
        type: 'number',
        additionalParams: true,
        show: {
            'inputs.nodeType': ['advanced']
        }
    }
]
```

## Troubleshooting

### Common Issues

1. **Parameters not hiding/showing**
   - Check that the field name in the condition matches exactly
   - Verify that `additionalParams: true` is set
   - Ensure the condition values match the actual field values

2. **Condition not updating**
   - Confirm that the controlling field triggers UI updates
   - Check for typos in the `show` condition syntax

3. **Multiple conditions not working**
   - Remember that multiple conditions use AND logic
   - Use array values for OR logic within a single condition

### Debugging Tips

1. Use browser developer tools to inspect the node data structure
2. Check that field values match the expected types (string, boolean, number)
3. Verify that the `show` condition syntax is correct

## Future Enhancements

The conditional parameter system may be extended in the future to support:

- Complex AND/OR logic between multiple conditions
- Computed conditions based on expressions
- Cross-node dependencies
- Dynamic condition evaluation based on external data

This system provides a powerful foundation for creating intuitive and context-aware user interfaces in UPDL nodes.
