import { MotionConfig } from 'framer-motion'
import VenueApp from '@/VenueApp'

/**
 * Root app entry — Pulse is the nightlife venue + map PWA.
 * The former Pulse Signal check-in shell was removed (no app-mode switch).
 */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <VenueApp />
    </MotionConfig>
  )
}
