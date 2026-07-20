import { useEffect } from 'react'

export default function Countdown({ value }) {
  // value: 3, 2, 1, 0 (0 = "GO!")
  const display  = value === 0 ? 'GO!' : String(value)
  const isGo     = value === 0
  const className = isGo ? 'countdown-go' : 'countdown-number'

  // Force re-animation on each value change by using key
  return (
    <div className="countdown-overlay">
      <span key={display} className={className}>
        {display}
      </span>
    </div>
  )
}
