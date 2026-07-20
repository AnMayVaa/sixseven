import { useState } from 'react'
import './index.css'
import GamePage from './pages/GamePage'
import LeaderboardPage from './pages/LeaderboardPage'

const TABS = [
  { id: 'game',        label: '🎮 Play' },
  { id: 'leaderboard', label: '🏆 Leaderboard' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('game')

  return (
    <div className="app">
      {/* Tab navigation */}
      <nav className="tab-nav" role="navigation" aria-label="Main navigation">
        <div className="tab-nav-inner">
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      {activeTab === 'game'        && <GamePage />}
      {activeTab === 'leaderboard' && <LeaderboardPage />}
    </div>
  )
}
