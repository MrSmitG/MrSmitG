import { useState } from 'react'
import BottomNav, { type Tab } from './components/BottomNav'
import PaySheet, { type PayTarget } from './components/PaySheet'
import Home from './screens/Home'
import PayScreen from './screens/PayScreen'
import Activity from './screens/Activity'
import Profile from './screens/Profile'
import './App.css'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)

  return (
    <div className="app-bg">
      <div className="phone">
        <div className="status-bar">
          <span>VEIL Pay</span>
          <span className="dot-live" aria-hidden />
        </div>

        <main className="app-scroll">
          {tab === 'home' && (
            <Home
              onPay={(t) => setPayTarget(t)}
              onScan={() => setTab('pay')}
              onSeeAll={() => setTab('activity')}
            />
          )}
          {tab === 'pay' && <PayScreen onPay={(t) => setPayTarget(t)} />}
          {tab === 'activity' && <Activity />}
          {tab === 'you' && <Profile />}
        </main>

        <BottomNav active={tab} onChange={setTab} />

        {payTarget && (
          <PaySheet
            target={payTarget}
            onClose={() => setPayTarget(null)}
            onDone={() => {
              setPayTarget(null)
              setTab('activity')
            }}
          />
        )}
      </div>
    </div>
  )
}
