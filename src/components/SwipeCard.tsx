import { motion, useMotionValue, useTransform, type PanInfo, type Variants } from 'motion/react'
import { useRef } from 'react'
import type { Decision } from '../state/swipeSession'
import type { Track } from '../types/music'
import { TrackCardFace } from './TrackCardFace'

/** Fraction of the card width the user must drag past to commit a swipe. */
const COMMIT_DISTANCE = 0.3
/** Px/s; a fast flick commits even if it is short. */
const COMMIT_VELOCITY = 600

/** Pass to the parent <AnimatePresence custom={direction}>: 1 = keep (right), -1 = skip (left). */
export const swipeCardVariants: Variants = {
  // Same pose as the peeking card behind, so the hand-over is seamless.
  enter: { scale: 0.94, y: 14, opacity: 0.55 },
  center: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
  exit: (direction: number) => ({
    x: direction * 560,
    opacity: 0,
    zIndex: 20,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  }),
}

interface SwipeCardProps {
  track: Track
  onDecide: (decision: Decision) => void
}

export function SwipeCard({ track, onDecide }: SwipeCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-11, 11])
  const keepOpacity = useTransform(x, [24, 110], [0, 1])
  const skipOpacity = useTransform(x, [-110, -24], [1, 0])

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const width = ref.current?.offsetWidth ?? 320
    const { offset, velocity } = info
    if (offset.x > width * COMMIT_DISTANCE || velocity.x > COMMIT_VELOCITY) onDecide('keep')
    else if (offset.x < -width * COMMIT_DISTANCE || velocity.x < -COMMIT_VELOCITY) onDecide('skip')
  }

  return (
    <motion.div
      ref={ref}
      className="relative z-10 min-w-0 cursor-grab touch-pan-y [grid-area:1/1] active:cursor-grabbing"
      style={{ x, rotate }}
      variants={swipeCardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      dragTransition={{ bounceStiffness: 320, bounceDamping: 24 }}
      onDragEnd={handleDragEnd}
    >
      <TrackCardFace track={track} />

      <motion.span
        style={{ opacity: keepOpacity }}
        className="pointer-events-none absolute top-7 left-6 -rotate-12 rounded-md border-2 border-champagne bg-ink/40 px-3 py-1 font-serif text-2xl tracking-[0.18em] text-champagne italic backdrop-blur-sm"
      >
        KEEP
      </motion.span>
      <motion.span
        style={{ opacity: skipOpacity }}
        className="pointer-events-none absolute top-7 right-6 rotate-12 rounded-md border-2 border-cream/70 bg-ink/40 px-3 py-1 font-serif text-2xl tracking-[0.18em] text-cream/80 italic backdrop-blur-sm"
      >
        SKIP
      </motion.span>
    </motion.div>
  )
}
