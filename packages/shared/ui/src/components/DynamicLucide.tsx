import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'

export function DynamicLucide({
  name,
  size = 18,
  className,
}: {
  name: string | null | undefined
  size?: number
  className?: string
}) {
  const key = name?.trim() || ''
  const Cmp = (Icons as unknown as Record<string, LucideIcon | undefined>)[key]
  if (!Cmp) return <Icons.Circle size={size} className={className} aria-hidden />
  return <Cmp size={size} className={className} aria-hidden />
}
