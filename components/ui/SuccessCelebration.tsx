'use client'

import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

const PARTICLES = [
  { emoji: '💰', x: '-40%', delay: '0ms' },
  { emoji: '🎉', x: '40%', delay: '80ms' },
  { emoji: '✨', x: '-60%', delay: '160ms' },
  { emoji: '🪙', x: '60%', delay: '240ms' },
  { emoji: '💚', x: '-20%', delay: '100ms' },
  { emoji: '🎊', x: '20%', delay: '200ms' },
  { emoji: '⭐', x: '-50%', delay: '50ms' },
  { emoji: '🌟', x: '50%', delay: '140ms' },
]

export default function SuccessCelebration({ onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1400)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-coin-rain"
          style={{
            left: `calc(50% + ${p.x})`,
            top: '50%',
            animationDelay: p.delay,
          }}
        >
          {p.emoji}
        </span>
      ))}
      <span className="text-5xl animate-sparkle-pop">✅</span>
    </div>
  )
}
