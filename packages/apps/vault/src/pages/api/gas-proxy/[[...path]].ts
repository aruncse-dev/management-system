import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

function resolveGasUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_GAS_URL || process.env.GAS_EXEC_URL || process.env.VITE_GAS_URL || ''
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
  const gasUrl = resolveGasUrl()
  if (!gasUrl) {
    res.status(500).json({ ok: false, error: 'GAS URL is not configured' })
    return
  }

  const pathParts = Array.isArray(req.query.path) ? req.query.path : []
  const target = new URL(gasUrl)
  if (pathParts.length > 0) {
    target.pathname = `${target.pathname.replace(/\/$/, '')}/${pathParts.join('/')}`
  }

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue
    if (Array.isArray(value)) value.forEach(v => target.searchParams.append(key, v))
    else if (value !== undefined) target.searchParams.set(key, value)
  }

  const method = req.method || 'GET'
  const bodyAllowed = method !== 'GET' && method !== 'HEAD'
  const bodyBuffer = bodyAllowed ? await readBody(req) : undefined
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
