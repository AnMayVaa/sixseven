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

      {/*
        IMPORTANT: Both pages stay mounted at all times so GamePage state
        (camera, phase, score) is never destroyed when switching tabs.
        CSS `display:contents` passes through layout, `display:none` hides.
      */}
      <div style={{ display: activeTab === 'game' ? 'contents' : 'none' }}>
        <GamePage onShowLeaderboard={() => setActiveTab('leaderboard')} />
      </div>
      <div style={{ display: activeTab === 'leaderboard' ? 'contents' : 'none' }}>
        <LeaderboardPage />
      </div>
    </div>
  )
}
