import PropTypes from 'prop-types'
import DOMPurify from 'dompurify'

/**
 * SafeHTML component renders sanitized HTML content.
 * Uses DOMPurify to prevent XSS attacks.
 */
export const SafeHTML = ({ html }) => {
    if (!html) return null

    const sanitizedHtml = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target']
    })

    return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
}

SafeHTML.propTypes = {
    html: PropTypes.string
}
