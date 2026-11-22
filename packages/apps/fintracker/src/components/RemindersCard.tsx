import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, BellRing, CalendarClock, RefreshCw, Shield } from 'lucide-react'
import { SectionBlock, SectionChip } from '../ui'
import { ALERT_DAYS, dueLabel, type Reminders } from '../lib/reminders'

const NOTIFIED_KEY = 'ft_notified_v1'

type Fmt = (n: number) => string

function readNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

async function notify(title: string, body: string, tag: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const opts = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/monthly?tab=dash' } }
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
  } catch {
    /* notifications are a nicety; never break the dashboard over one */
  }
}

/**
 * Raise a system notification for each imminent due and each low-balance
 * account — at most once per item per day, and only after the user opted in.
 *
 * This runs when the app is opened, so it is a daily digest rather than a
 * background alarm; background delivery needs a push server (see the plan).
 */
function useDueNotifications(reminders: Reminders, fmt: Fmt) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const seen = readNotified()
    const today = todayKey()
    const fresh: Record<string, string> = {}
    // Keep only today's marks so the store never grows.
    for (const [k, v] of Object.entries(seen)) if (v === today) fresh[k] = v

    for (const a of reminders.lowBalance) {
      const key = `low:${a.account}`
      if (fresh[key]) continue
      fresh[key] = today
      void notify(
        `Low balance in ${a.account}`,
        `${fmt(a.balance)} available, ${fmt(a.due)} due soon (${a.items.map(i => i.name).join(', ')}). Short by ${fmt(a.shortfall)}.`,
        key,
      )
    }
    for (const i of reminders.imminent) {
      if (fresh[i.key]) continue
      fresh[i.key] = today
      void notify(
        `${i.name} ${i.daysLeft < 0 ? 'is overdue' : `due ${dueLabel(i.daysLeft)}`}`,
        `${fmt(i.amount)}${i.paymentMethod ? ` from ${i.paymentMethod}` : ''}`,
        i.key,
      )
    }
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(fresh))
    } catch {
      /* storage blocked */
    }
  }, [reminders, fmt])
}

/**
 * "Coming up": renewals and premiums in the next week, with a warning when the
 * account they are paid from cannot cover them. Renders nothing when there is
 * nothing to say.
 */
export function RemindersCard({ reminders, fmt }: { reminders: Reminders; fmt: Fmt }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  useEffect(() => {
    setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported')
  }, [])
  useDueNotifications(reminders, fmt)

  if (!reminders.items.length && !reminders.lowBalance.length) return null

  const overdue = reminders.items.filter(i => i.daysLeft < 0).length
  const chip = overdue ? `${overdue} overdue` : `${reminders.items.length} this week`

  return (
    <SectionBlock
      title="Coming up"
      icon={<CalendarClock size={16} />}
      right={<SectionChip tone={overdue || reminders.lowBalance.length ? 'red' : 'muted'}>{chip}</SectionChip>}
    >
      <div className="reminders">
        {reminders.lowBalance.map(a => (
          <div key={`low-${a.account}`} className="reminder reminder--alert" role="alert">
            <AlertTriangle size={16} aria-hidden />
            <div className="reminder-main">
              <div className="reminder-title">Top up {a.account}</div>
              <div className="reminder-sub">
                {fmt(a.balance)} available · {fmt(a.due)} due within {ALERT_DAYS} days · short {fmt(a.shortfall)}
              </div>
            </div>
          </div>
        ))}
        {reminders.items.map(i => (
          <div key={i.key} className={`reminder${i.daysLeft < 0 ? ' reminder--overdue' : i.daysLeft <= ALERT_DAYS ? ' reminder--soon' : ''}`}>
            {i.kind === 'insurance' ? <Shield size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
            <div className="reminder-main">
              <div className="reminder-title">{i.name}</div>
              <div className="reminder-sub">
                {i.kind === 'insurance' ? 'Premium' : 'Renewal'} {dueLabel(i.daysLeft)}
                {i.paymentMethod ? ` · ${i.paymentMethod}` : ''}
                {i.account ? ` (${fmt(i.account.balance)})` : ''}
              </div>
            </div>
            <div className="reminder-amt">{fmt(i.amount)}</div>
          </div>
        ))}
        {permission === 'default' && (
          <button
            type="button"
            className="reminder-enable"
            onClick={() => {
              void Notification.requestPermission().then(p => setPermission(p))
            }}
          >
            <Bell size={14} aria-hidden /> Notify me {ALERT_DAYS} days before dues
          </button>
        )}
        {permission === 'granted' && (
          <div className="reminder-note">
            <BellRing size={12} aria-hidden /> Alerts on — shown when you open the app
          </div>
        )}
      </div>
    </SectionBlock>
  )
}
