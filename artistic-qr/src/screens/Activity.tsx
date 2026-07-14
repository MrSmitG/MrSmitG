import { TxnRow } from './Home'
import { useApp } from '../lib/store'
import { formatINR } from '../lib/format'

export default function Activity() {
  const { txns } = useApp()

  const sent = txns.filter((t) => t.direction === 'sent').reduce((s, t) => s + t.amount, 0)
  const received = txns.filter((t) => t.direction === 'received').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="screen">
      <h1 className="screen-title">Activity</h1>

      <div className="stat-row">
        <div className="stat out">
          <p className="stat-label">Sent</p>
          <p className="stat-val">{formatINR(sent)}</p>
        </div>
        <div className="stat in">
          <p className="stat-label">Received</p>
          <p className="stat-val">{formatINR(received)}</p>
        </div>
      </div>

      <ul className="txn-list full">
        {txns.map((t) => (
          <TxnRow key={t.id} txn={t} />
        ))}
        {txns.length === 0 && <li className="empty">No transactions yet</li>}
      </ul>
    </div>
  )
}
