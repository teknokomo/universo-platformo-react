import moment from 'moment'

export const formatDate = (date, format = 'YYYY-MM-DD HH:mm') => {
    if (!date) return ''
    try {
        return moment(date).format(format)
    } catch (e) {
        return String(date)
    }
}

export default formatDate
