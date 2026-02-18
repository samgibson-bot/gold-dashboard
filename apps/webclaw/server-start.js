#!/usr/bin/env node
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import handler from './dist/server/server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'

// MIME types for common static assets
const mimeTypes = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    // Try to serve static files from dist/client first
    if (req.method === 'GET' || req.method === 'HEAD') {
      const pathname = url.pathname
      const clientPath = join(__dirname, 'dist', 'client', pathname)

      try {
        const content = await readFile(clientPath)
        const ext = extname(pathname)
        const contentType = mimeTypes[ext] || 'application/octet-stream'

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': content.length,
          'Cache-Control': pathname.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        })

        if (req.method === 'HEAD') {
          res.end()
        } else {
          res.end(content)
        }
        return
      } catch (err) {
        // File not found or error reading, fall through to fetch handler
      }
    }

    // Create a Fetch API Request from Node.js IncomingMessage
    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
        if (value) acc[key] = Array.isArray(value) ? value.join(', ') : value
        return acc
      }, {}),
      body:
        req.method !== 'GET' && req.method !== 'HEAD'
          ? await new Promise((resolve) => {
              const chunks = []
              req.on('data', (chunk) => chunks.push(chunk))
              req.on('end', () => resolve(Buffer.concat(chunks)))
            })
          : undefined,
    })

    // Call the TanStack Start fetch handler
    const response = await handler.fetch(request)

    // Write response
    res.writeHead(
      response.status,
      response.statusText,
      Object.fromEntries(response.headers),
    )

    if (response.body) {
      const reader = response.body.getReader()
      const pump = async () => {
        const { done, value } = await reader.read()
        if (done) {
          res.end()
          return
        }
        res.write(value)
        pump()
      }
      await pump()
    } else {
      res.end()
    }
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`)
})
