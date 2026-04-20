import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type FtSessionData } from '../../../lib/session'

function resolveGasUrl(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readMergedDotenv } = require('../../../../../resolve-google-env.cjs') as {
    readMergedDotenv: (appDir: string) => Record<string, string>
  }
  const fileEnv = readMergedDotenv(process.cwd())
  return (
    process.env.NEXT_PUBLIC_GAS_URL ||
    process.env.GAS_EXEC_URL ||
    process.env.VITE_GAS_URL ||
    fileEnv.VITE_GAS_URL ||
    fileEnv.NEXT_PUBLIC_GAS_URL ||
    undefined
  )
}

function resolveServerToken(): string | undefined {
  const t = process.env.VITE_API_TOKEN || process.env.NEXT_PUBLIC_API_TOKEN
  return t && String(t).trim() ? String(t).trim() : undefined
}

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function buildUpstreamHeaders(req: NextApiRequest): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const name of ['user-agent', 'accept', 'accept-language']) {
    const v = req.headers[name]
    if (typeof v === 'string' && v) out[name] = v
  }
  const ct = req.headers['content-type']
  if (typeof ct === 'string' && ct) out['content-type'] = ct
  return Object.keys(out).length > 0 ? out : undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let sessionOptions
  try {
    sessionOptions = getSessionOptions()
  } catch {
    sessionOptions = undefined
  }
  if (sessionOptions) {
    const session = await getIronSession<FtSessionData>(req, res, sessionOptions)
    if (!session.email) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
  }

  const gasUrl = resolveGasUrl()
  if (!gasUrl) {
    res.status(500).json({ ok: false, error: 'GAS URL is not configured' })
    return
  }

  const serverToken = resolveServerToken()

  const pathParts = Array.isArray(req.query.path) ? req.query.path : []
  const target = new URL(gasUrl)
  if (pathParts.length > 0) {
    target.pathname = `${target.pathname.replace(/\/$/, '')}/${pathParts.join('/')}`
  }

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue
    if (key === 'token') continue
    if (Array.isArray(value)) value.forEach(v => target.searchParams.append(key, v))
    else if (value !== undefined) target.searchParams.set(key, value)
  }
  if (serverToken) target.searchParams.set('token', serverToken)

  const method = req.method || 'GET'
  const bodyAllowed = method !== 'GET' && method !== 'HEAD'
  let bodyBuffer = bodyAllowed ? await readBody(req) : undefined
  const ct = String(req.headers['content-type'] || '')
  if (bodyBuffer && bodyBuffer.length > 0 && ct.includes('application/json')) {
    try {
      const parsed = JSON.parse(bodyBuffer.toString('utf8')) as Record<string, unknown>
      delete parsed.token
      if (serverToken) parsed.token = serverToken
      bodyBuffer = Buffer.from(JSON.stringify(parsed), 'utf8')
    } catch {
      // use original bodyBuffer
    }
  }
  const body = bodyBuffer && bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined

  const upstream = await fetch(target.toString(), {
    method,
    headers: buildUpstreamHeaders(req),
    body,
    redirect: 'follow',
  })

  res.status(upstream.status)
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('content-type', contentType)
  const text = await upstream.text()
  res.send(text)
}
