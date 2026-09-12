// Netlify Function: single catch-all at /.netlify/functions/api that we rewrite
// /api/* to (see netlify.toml). Because Netlify Functions receive Node
// IncomingMessage-like objects, we can hand the request straight to our
// shared router.

import { handleApi } from '../../server/api.js'

// Convert a Netlify-compatible event into a minimal Node req and capture
// the response via a res shim. This avoids pulling in the @netlify/functions
// helper and keeps the code portable with the Vite dev middleware.
export const handler = async (event) => {
  // Build a Node-style (req, res) pair we can hand to handleApi.
  let resolveResponse
  const responsePromise = new Promise((r) => { resolveResponse = r })

  const chunks = []
  const headers = {}
  let statusCode = 200

  const req = {
    method: event.httpMethod || 'GET',
    url: event.path + (event.rawQuery ? `?${event.rawQuery}` : ''),
    headers: event.headers || {},
    body: undefined,
    on(eventName, cb) {
      if (eventName === 'data' && event.body) {
        if (event.isBase64Encoded) {
          cb(Buffer.from(event.body, 'base64'))
        } else {
          cb(Buffer.from(event.body, 'utf8'))
        }
      }
      if (eventName === 'end') cb()
      return req
    },
  }

  const res = {
    statusCode,
    writableEnded: false,
    setHeader(name, value) { headers[name] = value },
    end(body) {
      chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body || ''))
      res.writableEnded = true
      resolveResponse({
        statusCode,
        headers,
        body: Buffer.concat(chunks).toString('utf8'),
      })
    },
  }
  Object.defineProperty(res, 'statusCode', {
    get() { return statusCode },
    set(v) { statusCode = v },
  })

  // Kick off async handler (it will call res.end).
  await handleApi(req, res)
  return responsePromise
}
