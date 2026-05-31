#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const packageRoot = path.resolve(currentDir, '..')
export const artifactRoot = path.join(packageRoot, 'dist', 'editor')

const contentTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.wasm', 'application/wasm'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.svg', 'image/svg+xml'],
    ['.map', 'application/json; charset=utf-8']
])

export const readArg = (args, name, fallback) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] ?? fallback : fallback
}

export const resolveArtifactRequest = (pathname, root = artifactRoot) => {
    const resolvedRoot = path.resolve(root)
    const realRoot = fs.realpathSync(resolvedRoot)
    const rawPath = pathname === '/' ? '/index.html' : pathname
    let requested

    try {
        requested = decodeURIComponent(rawPath)
    } catch {
        return { status: 400, requested: rawPath, absolutePath: resolvedRoot }
    }

    const absolutePath = path.resolve(resolvedRoot, `.${requested}`)
    const relativePath = path.relative(resolvedRoot, absolutePath)
    const insideRoot = relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
    let realPath = null

    if (insideRoot && fs.existsSync(absolutePath)) {
        realPath = fs.realpathSync(absolutePath)
        const realRelativePath = path.relative(realRoot, realPath)
        const realInsideRoot = realRelativePath === '' || (!realRelativePath.startsWith('..') && !path.isAbsolute(realRelativePath))
        if (!realInsideRoot) {
            return { status: 403, requested, absolutePath, realPath }
        }
    }

    return {
        status: insideRoot ? 200 : 403,
        requested,
        absolutePath,
        realPath
    }
}

export const getContentType = (filePath) => contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'

export const createArtifactServer = ({ host = '127.0.0.1', port = 3487, root = artifactRoot } = {}) => {
    if (!fs.existsSync(path.join(root, 'index.html'))) {
        throw new Error('PlayCanvas Editor artifact is missing. Run editor:build first.')
    }

    return http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://${host}:${port}`)
        const resolved = resolveArtifactRequest(url.pathname, root)

        if (resolved.status === 400) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
            res.end('Bad request')
            return
        }

        if (resolved.status === 403) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
            res.end('Forbidden')
            return
        }

        if (!fs.existsSync(resolved.absolutePath) || !fs.statSync(resolved.absolutePath).isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
            res.end('Not found')
            return
        }

        res.writeHead(200, {
            'Content-Type': getContentType(resolved.absolutePath),
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': resolved.requested.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
        })
        fs.createReadStream(resolved.absolutePath).pipe(res)
    })
}

export const startArtifactServer = ({ host = '127.0.0.1', port = 3487, root = artifactRoot } = {}) => {
    const server = createArtifactServer({ host, port, root })
    server.listen(port, host, () => {
        console.log(`PlayCanvas Editor artifact server listening at http://${host}:${port}`)
    })
    return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
    const args = process.argv.slice(2)
    const host = readArg(args, '--host', '127.0.0.1')
    const port = Number(readArg(args, '--port', '3487'))
    startArtifactServer({ host, port })
}
