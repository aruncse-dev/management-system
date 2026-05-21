import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import type { FtSessionData } from '@fintracker-vault/auth'
import { completeIntegrationOAuth, requireOrgIdForIntegrations } from '../../../../lib/integrations'
import { verifyIntegrationOAuthState } from '../../../../lib/integrations/oauthState'
import { getSessionOptions } from '../../../../lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const session = await getIronSession<FtSessionData>(req, res, getSessionOptions())
  if (!session.email) {
    return res.redirect(302, '/')
  }

  const code = typeof req.query.code === 'string' ? req.query.code.trim() : ''
  const stateRaw = typeof req.query.state === 'string' ? req.query.state : ''
  const state = verifyIntegrationOAuthState(stateRaw)

  if (!code || !state) {
    return res.redirect(302, '/settings?integration_error=1')
  }

  const orgId = await requireOrgIdForIntegrations(session.email, session.activeOrgId)
  if (!orgId || orgId !== state.orgId) {
    return res.redirect(302, '/settings?integration_error=1')
  }

  try {
    await completeIntegrationOAuth({
      orgId: state.orgId,
      providerSlug: state.provider,
      code,
      connectedByEmail: session.email.toLowerCase(),
      headers: req.headers,
    })
    return res.redirect(302, '/settings#integrations')
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[integrations/oauth/callback]', e)
    }
    return res.redirect(302, '/settings?integration_error=1')
  }
}
