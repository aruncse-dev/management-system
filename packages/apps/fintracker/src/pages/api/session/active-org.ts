import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { listOrgsForUserEmail } from '@fintracker-vault/db'
import { getSessionOptions } from '../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const orgId = typeof (body as { orgId?: unknown }).orgId === 'string'
    ? (body as { orgId: string }).orgId.trim()
    : ''
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'Missing orgId' })
  }

  const orgs = await listOrgsForUserEmail(session.email.toLowerCase())
  if (!orgs.some((o) => o.id === orgId)) {
    return res.status(403).json({ ok: false, error: 'Not a member of this organization' })
  }

  session.activeOrgId = orgId
  await session.save()
  return res.status(200).json({ ok: true, activeOrgId: orgId })
}
