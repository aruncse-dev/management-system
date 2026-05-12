import { getFtSessionOptions, type FtSessionData } from '@fintracker-vault/auth'

export type { FtSessionData }

export function getSessionOptions() {
  return getFtSessionOptions('ft_session_admin')
}
