import Avatar from '../components/Avatar'
import { formatINR, relativeTime } from '../lib/format'
import { useApp, type Contact, type Txn } from '../lib/store'
import type { PayTarget } from '../components/PaySheet'

type Props = {
  onPay: (t: PayTarget) => void
  onScan: () => void
  onSeeAll: () => void
}

export default function Home({ onPay, onScan, onSeeAll }: Props) {
  const { account, contacts, txns } = useApp()

  const startPay = (c: Contact) =>
    onPay({ name: c.name, vpa: c.vpa, method: 'upi' })

  return (
    <div className="screen home">
      <header className="home-head">
        <div>
          <p className="hello">Hello,</p>
          <p className="hello-name">{account.name.split(' ')[0]}</p>
        </div>
        <Avatar name={account.name} color="#e07a3d" size={42} />
      </header>

      <div className="balance-card">
        <div className="bal-shine" aria-hidden />
        <p className="bal-label">VEIL balance</p>
        <p className="bal-value">{formatINR(account.balance)}</p>
        <p className="bal-vpa">{account.vpa}</p>
      </div>

      <div className="quick-actions">
        <button className="qa" onClick={onScan}>
          <span className="qa-ic scan">⌣</span>
          Scan &amp; pay
        </button>
        <button className="qa" onClick={() => onPay({ name: '', vpa: '', method: 'upi' })}>
          <span className="qa-ic send">↗</span>
          Pay UPI ID
        </button>
        <button className="qa" onClick={onSeeAll}>
          <span className="qa-ic req">↙</span>
          Receive
        </button>
      </div>

      <section className="people">
        <h2 className="section-title">People</h2>
        <div className="people-row">
          {contacts.map((c) => (
            <button key={c.id} className="person" onClick={() => startPay(c)}>
              <Avatar name={c.name} color={c.color} size={54} />
              <span>{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="recent">
        <div className="section-head">
          <h2 className="section-title">Recent activity</h2>
          <button className="link-btn" onClick={onSeeAll}>
            See all
          </button>
        </div>
        <ul className="txn-list">
          {txns.slice(0, 4).map((t) => (
            <TxnRow key={t.id} txn={t} />
          ))}
        </ul>
      </section>
    </div>
  )
}

export function TxnRow({ txn }: { txn: Txn }) {
  const sent = txn.direction === 'sent'
  return (
    <li className="txn-row">
      <Avatar name={txn.name} color="#5e7a92" size={40} />
      <div className="txn-mid">
        <p className="txn-name">{txn.name}</p>
        <p className="txn-sub">
          {sent ? 'Paid' : 'Received'} · {relativeTime(txn.ts)}
          {txn.method === 'veil' && <span className="veil-tag"> · VEIL</span>}
        </p>
      </div>
      <p className={sent ? 'txn-amt out' : 'txn-amt in'}>
        {sent ? '−' : '+'}
        {formatINR(txn.amount)}
      </p>
    </li>
  )
}
