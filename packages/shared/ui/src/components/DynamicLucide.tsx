import type { LucideIcon } from 'lucide-react'
import {
  Circle,
  CalendarDays,
  CreditCard,
  FileText,
  Gem,
  Grid2X2,
  History,
  Landmark,
  Layers3,
  LineChart,
  List,
  PieChart,
  PiggyBank,
  Repeat2,
  Scale,
  Settings,
  Shield,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Icons the menu catalog can name (`packages/shared/db/src/menuCatalogSeed.ts`).
 *
 * This used to be `import * as Icons from 'lucide-react'`, which put the entire
 * icon library (~1,500 icons) into every app's `_app` chunk — the biggest
 * single cost of a cold PWA launch. Add an icon here when the catalog gains
 * one; an unknown name falls back to a circle.
 */
const MENU_ICONS: Record<string, LucideIcon> = {
  CalendarDays,
  CreditCard,
  FileText,
  Gem,
  Grid2X2,
  History,
  Landmark,
  Layers3,
  LineChart,
  List,
  PieChart,
  PiggyBank,
  Repeat2,
  Scale,
  Settings,
  Shield,
  TrendingUp,
  User,
  Users,
  Wallet,
}

export function DynamicLucide({
  name,
  size = 18,
  className,
}: {
  name: string | null | undefined
  size?: number
  className?: string
}) {
  const Cmp = MENU_ICONS[name?.trim() || ''] ?? Circle
  return <Cmp size={size} className={className} aria-hidden />
}
