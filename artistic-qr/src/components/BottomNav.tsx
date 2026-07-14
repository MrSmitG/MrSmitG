export type Tab = 'home' | 'pay' | 'activity' | 'you'

type Props = {
  active: Tab
  onChange: (t: Tab) => void
}

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'activity', label: 'Activity', icon: 'M3 12h4l3 8 4-16 3 8h4' },
  { id: 'pay', label: 'Pay', icon: '' },
  { id: 'you', label: 'You', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
]

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((it) =>
        it.id === 'pay' ? (
          <button
            key={it.id}
            className="nav-scan"
            onClick={() => onChange('pay')}
            aria-label="Scan or pay"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" strokeLinecap="round" />
              <path d="M4 12h16" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <button
            key={it.id}
            className={active === it.id ? 'nav-item on' : 'nav-item'}
            onClick={() => onChange(it.id)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.icon} />
            </svg>
            <span>{it.label}</span>
          </button>
        ),
      )}
    </nav>
  )
}
