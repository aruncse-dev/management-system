/** Upstox brand icon (`public/integrations/upstock.jpeg` in each Next app). */
export const UPSTOX_ICON_SRC = '/integrations/upstock.jpeg'

export function UpstoxIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src={UPSTOX_ICON_SRC}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ flexShrink: 0, display: 'block', objectFit: 'contain', borderRadius: 4 }}
    />
  )
}
