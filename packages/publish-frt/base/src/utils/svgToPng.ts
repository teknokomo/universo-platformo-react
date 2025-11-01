// Universo Platformo | SVG to PNG Conversion Utility
// Converts SVG elements to PNG images with high quality and error handling

/**
 * Options for SVG to PNG conversion
 */
interface ConversionOptions {
    /** Output width in pixels (default: 512) */
    width?: number
    /** Output height in pixels (default: 512) */
    height?: number
    /** PNG quality 0-1 (default: 1.0) */
    quality?: number
    /** Background color (default: 'white') */
    backgroundColor?: string
}

/**
 * Converts an SVG element to PNG data URL with configurable options
 * @param svgElement - The SVG element to convert
 * @param options - Conversion options
 * @returns Promise resolving to PNG data URL
 * @throws Error if conversion fails
 */
export async function convertSvgToPng(svgElement: SVGElement, options: ConversionOptions = {}): Promise<string> {
    const { width = 512, height = 512, quality = 1.0, backgroundColor = 'white' } = options

    // Validate input
    if (!svgElement || svgElement.tagName !== 'svg') {
        throw new Error('Invalid SVG element provided')
    }

    if (width <= 0 || height <= 0) {
        throw new Error('Width and height must be positive numbers')
    }

    if (quality < 0 || quality > 1) {
        throw new Error('Quality must be between 0 and 1')
    }

    try {
        // Step 1: Serialize SVG to string
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`

        // Step 2: Load SVG as Image
        const img = new Image()
        img.src = svgUrl

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('Failed to load SVG image'))
        })

        // Step 3: Create Canvas and draw image
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get canvas context')
        }

        // Set high-quality rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Fill background
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, width, height)

        // Draw SVG image
        ctx.drawImage(img, 0, 0, width, height)

        // Step 4: Convert to PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png', quality)

        // Clean up
        canvas.width = 0
        canvas.height = 0

        return pngDataUrl
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`SVG to PNG conversion failed: ${errorMessage}`)
    }
}

/**
 * Downloads a data URL as a file
 * @param dataUrl - The data URL to download
 * @param filename - The filename for the downloaded file
 * @throws Error if download fails
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
    if (!dataUrl || typeof dataUrl !== 'string') {
        throw new Error('Invalid data URL provided')
    }

    if (!filename || typeof filename !== 'string') {
        throw new Error('Invalid filename provided')
    }

    try {
        // Create download link
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.style.display = 'none'

        // Trigger download
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`File download failed: ${errorMessage}`)
    }
}

/**
 * Generates a filename for QR code download
 * @param url - The URL encoded in the QR code
 * @param extension - File extension (default: 'png')
 * @returns Generated filename
 */
export function generateQRCodeFilename(url: string, extension: string = 'png'): string {
    try {
        // Extract domain from URL for filename
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace(/^www\./, '')
        const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

        return `qr-code-${domain}-${timestamp}.${extension}`
    } catch {
        // Fallback for invalid URLs
        const timestamp = new Date().toISOString().slice(0, 10)
        return `qr-code-${timestamp}.${extension}`
    }
}

/**
 * Complete QR code download workflow
 * @param svgElement - SVG element containing QR code
 * @param originalUrl - Original URL encoded in QR code
 * @param options - Conversion options
 * @returns Promise that resolves when download is complete
 */
export async function downloadQRCode(svgElement: SVGElement, originalUrl: string, options: ConversionOptions = {}): Promise<void> {
    try {
        // Convert SVG to PNG with high quality
        const pngDataUrl = await convertSvgToPng(svgElement, {
            width: 512,
            height: 512,
            quality: 1.0,
            backgroundColor: 'white',
            ...options
        })

        // Generate appropriate filename
        const filename = generateQRCodeFilename(originalUrl)

        // Download the file
        downloadDataUrl(pngDataUrl, filename)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`QR code download failed: ${errorMessage}`)
    }
}
