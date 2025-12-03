// Redux action types
export const SET_DIRTY = 'SET_DIRTY'
export const REMOVE_DIRTY = 'REMOVE_DIRTY'
export const SET_CANVAS = 'SET_CANVAS'
export const SET_COMPONENT_NODES = 'SET_COMPONENT_NODES'
export const enqueueSnackbar = (notification) => ({
    type: 'ENQUEUE_SNACKBAR',
    notification
})
export const closeSnackbar = (key) => ({
    type: 'CLOSE_SNACKBAR',
    dismissAll: !key,
    key
})
