#!/usr/bin/env node
import { createServer } from 'node:http'
import handler from './dist/server/server.js'

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    // Create a Fetch API Request from Node.js IncomingMessage
    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
        if (value) acc[key] = Array.isArray(value) ? value.join(', ') : value
        return acc
      }, {}),
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? await new Promise((resolve) => {
            const chunks = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', () => resolve(Buffer.concat(chunks)))
          })
        : undefined,
    })

    // Call the TanStack Start fetch handler
    const response = await handler.fetch(request)

    // Write response
    res.writeHead(response.status, response.statusText, Object.fromEntries(response.headers))

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
