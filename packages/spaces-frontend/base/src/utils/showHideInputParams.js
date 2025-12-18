import { get, isEqual } from 'lodash'

const showHideOperation = (nodeData, inputParam, displayType, index) => {
    const displayOptions = inputParam[displayType]

    Object.keys(displayOptions).forEach((path) => {
        const comparisonValue = displayOptions[path]

        if (path.includes('$index') && typeof index === 'number') {
            path = path.replace('$index', index.toString())
        }

        let groundValue = get(nodeData.inputs, path, '')
        if (groundValue && typeof groundValue === 'string' && groundValue.startsWith('[') && groundValue.endsWith(']')) {
            groundValue = JSON.parse(groundValue)
        }

        if (Array.isArray(groundValue)) {
            if (Array.isArray(comparisonValue)) {
                const hasIntersection = comparisonValue.some((val) => groundValue.includes(val))
                if (displayType === 'show' && !hasIntersection) inputParam.display = false
                if (displayType === 'hide' && hasIntersection) inputParam.display = false
            } else if (typeof comparisonValue === 'string') {
                const matchFound = groundValue.some((val) => comparisonValue === val || new RegExp(comparisonValue).test(val))
                if (displayType === 'show' && !matchFound) inputParam.display = false
                if (displayType === 'hide' && matchFound) inputParam.display = false
            } else if (typeof comparisonValue === 'boolean' || typeof comparisonValue === 'number') {
                const matchFound = groundValue.includes(comparisonValue)
                if (displayType === 'show' && !matchFound) inputParam.display = false
                if (displayType === 'hide' && matchFound) inputParam.display = false
            } else if (typeof comparisonValue === 'object') {
                const matchFound = groundValue.some((val) => isEqual(comparisonValue, val))
                if (displayType === 'show' && !matchFound) inputParam.display = false
                if (displayType === 'hide' && matchFound) inputParam.display = false
            }
        } else {
            if (Array.isArray(comparisonValue)) {
                if (displayType === 'show' && !comparisonValue.includes(groundValue)) inputParam.display = false
                if (displayType === 'hide' && comparisonValue.includes(groundValue)) inputParam.display = false
            } else if (typeof comparisonValue === 'string') {
                const regexMatch = typeof groundValue === 'string' ? new RegExp(comparisonValue).test(groundValue) : false
                if (displayType === 'show' && !(comparisonValue === groundValue || regexMatch)) inputParam.display = false
                if (displayType === 'hide' && (comparisonValue === groundValue || regexMatch)) inputParam.display = false
            } else if (typeof comparisonValue === 'boolean') {
                if (displayType === 'show' && comparisonValue !== groundValue) inputParam.display = false
                if (displayType === 'hide' && comparisonValue === groundValue) inputParam.display = false
            } else if (typeof comparisonValue === 'object') {
                if (displayType === 'show' && !isEqual(comparisonValue, groundValue)) inputParam.display = false
                if (displayType === 'hide' && isEqual(comparisonValue, groundValue)) inputParam.display = false
            } else if (typeof comparisonValue === 'number') {
                if (displayType === 'show' && comparisonValue !== groundValue) inputParam.display = false
                if (displayType === 'hide' && comparisonValue === groundValue) inputParam.display = false
            }
        }
    })
}

export const showHideInputs = (nodeData, inputType, overrideParams, arrayIndex) => {
    const params = overrideParams ?? nodeData?.[inputType] ?? []

    for (let i = 0; i < params.length; i += 1) {
        const inputParam = params[i]
        inputParam.display = true

        if (inputParam.show) {
            showHideOperation(nodeData, inputParam, 'show', arrayIndex)
        }
        if (inputParam.hide) {
            showHideOperation(nodeData, inputParam, 'hide', arrayIndex)
        }
    }

    return params
}

export const showHideInputParams = (nodeData) => {
    return showHideInputs(nodeData, 'inputParams')
}
