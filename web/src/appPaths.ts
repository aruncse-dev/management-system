export type AppArea = 'finance' | 'vault'
export type AppKind = AppArea | 'auto'

export const APP_PATHS: Record<AppArea, string> = {
  finance: '/fintracker',
  vault: '/vault',
}

export function getAppArea(pathname = window.location.pathname): AppArea {
  return pathname.startsWith(APP_PATHS.vault) ? 'vault' : 'finance'
}

export function getDeploymentArea(): AppKind {
  const kind = (import.meta.env.VITE_APP_KIND as string | undefined)?.trim().toLowerCase()
  if (kind === 'vault') return 'vault'
  if (kind === 'fintracker' || kind === 'finance') return 'finance'
  return 'auto'
}

export function resolveAppArea(pathname = window.location.pathname): AppArea {
  const deployment = getDeploymentArea()
  if (deployment === 'auto') return getAppArea(pathname)
  return deployment
}

export function getAppPath(area: AppArea): string {
  return APP_PATHS[area]
}

export function getAppAssetUrl(_area: AppArea, asset: string): string {
  return `/${asset.replace(/^\//, '')}`
}

export function getAppManifestUrl(area: AppArea): string {
  return getAppAssetUrl(area, area === 'vault' ? 'manifest-vault.json' : 'manifest.json')
}

export function getAppDisplayName(area: AppArea): string {
  return area === 'vault' ? 'Vault' : 'FinTracker'
}

export function getAppShortName(area: AppArea): string {
  return area === 'vault' ? 'Vault' : 'FinTracker'
}

export function getAppIconAsset(area: AppArea): string {
  return area === 'vault' ? 'vault-192.png' : 'icon-192.png'
}
