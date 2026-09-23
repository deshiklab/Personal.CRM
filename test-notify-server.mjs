/* Throwaway stand-in for a form/email service (Web3Forms, Formspree, …).
 * Used only by probe-verify.mjs to prove the notification + verification flow
 * works end to end. Not part of the app and never deployed. */
import http from 'node:http'

let last = null

http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      try { last = JSON.parse(body) } catch { last = { raw: body } }
      console.log('[notify]', JSON.stringify(last))
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    })
    return
  }
  if (req.url === '/last') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(last))
  }
  if (req.url === '/reset') { last = null; res.writeHead(200, cors); return res.end('ok') }
  res.writeHead(200, cors); res.end('notify-test-server')
}).listen(5199, '0.0.0.0', () => console.log('listening on 5199'))
