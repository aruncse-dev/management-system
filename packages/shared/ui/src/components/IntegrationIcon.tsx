import { Plug } from 'lucide-react'
import { UpstoxIcon } from './UpstoxIcon'

function normalizeIntegrationName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function IntegrationIcon({
  name,
  size = 20,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const key = normalizeIntegrationName(name)
  if (key === 'upstox' || key === 'upstock') return <UpstoxIcon size={size} className={className} />
  return <Plug size={size} className={className} aria-hidden />
}
