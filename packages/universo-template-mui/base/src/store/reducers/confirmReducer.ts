import { SHOW_CONFIRM, HIDE_CONFIRM, ConfirmAction, ConfirmPayload } from '../actions'

export interface ConfirmState extends ConfirmPayload {
    show: boolean
}

export const initialState: ConfirmState = {
    show: false,
    title: '',
    description: '',
    confirmButtonName: 'OK',
    cancelButtonName: 'Cancel',
    customBtnId: ''
}

const confirmReducer = (state: ConfirmState = initialState, action: ConfirmAction): ConfirmState => {
    switch (action.type) {
        case SHOW_CONFIRM:
            return {
                show: true,
                title: action.payload.title,
                description: action.payload.description,
                confirmButtonName: action.payload.confirmButtonName,
                cancelButtonName: action.payload.cancelButtonName,
                customBtnId: action.payload.customBtnId || 'btn_confirm'
            }
        case HIDE_CONFIRM:
            return initialState
        default:
            return state
    }
}

export default confirmReducer
