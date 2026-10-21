import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Rolls a number up to its new value, like a scoreboard flipping.
export default function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0)
  const from = useRef(shown)

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); from.current = value; return }
    const start = from.current
    const began = performance.now()
    let frame = 0
    const step = (time: number) => {
      const progress = Math.min(1, (time - began) / 650)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(start + (value - start) * eased)
      setShown(next)
      from.current = next
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className="count-up">{shown}</span>
}
