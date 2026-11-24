import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useEffectEvent } from 'react'

const ease = [0.22, 1, 0.36, 1] as const

/** Total time the summary stays up before moving on to the results screen. */
const AUTO_CONTINUE_MS = 2800
const COUNT_UP_S = 1.2

interface DoneCardProps {
  kept: number
  total: number
  /** Play the summary animation and continue to results by itself. */
  autoContinue: boolean
  onReview: () => void
  onRestart: () => void
  onChooseAnother: () => void
}

const cardClass =
  'flex aspect-[4/5] flex-col items-center justify-center rounded-[28px] border border-line bg-surface px-8 text-center [grid-area:1/1]'

export function DoneCard({ kept, total, autoContinue, onReview, onRestart, onChooseAnother }: DoneCardProps) {
  if (autoContinue && kept > 0) return <FinishSummary kept={kept} total={total} onContinue={onReview} />

  const nothingKept = kept === 0

  return (
    <motion.div
      className={cardClass}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease }}
    >
      <p className="eyebrow">All done</p>

      {nothingKept ? (
        <>
          <h2 className="mt-4 font-serif text-4xl leading-tight font-light tracking-tight">
            Nothing made <em className="text-champagne">the cut.</em>
          </h2>
          <p className="mt-4 text-sm text-muted">You skipped all {total} tracks.</p>
          <button
            type="button"
            onClick={onRestart}
            className="mt-8 rounded-full bg-champagne px-7 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            Swipe again
          </button>
          <button
            type="button"
            onClick={onChooseAnother}
            className="mt-4 text-sm text-muted transition-colors hover:text-cream"
          >
            Choose another playlist
          </button>
        </>
      ) : (
        <>
          <h2 className="mt-4 font-serif text-4xl leading-tight font-light tracking-tight">
            That’s the <em className="text-champagne">whole</em> playlist.
          </h2>
          <p className="mt-4 text-sm text-muted">
            You kept <span className="text-cream">{kept}</span> of {total} tracks.
          </p>
          <button
            type="button"
            onClick={onReview}
            className="mt-8 rounded-full bg-champagne px-7 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            Review selection
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="mt-4 text-sm text-muted transition-colors hover:text-cream"
          >
            Start over
          </button>
        </>
      )}
    </motion.div>
  )
}

/** Ring fills and the kept count ticks up, then it moves on by itself. */
function FinishSummary({ kept, total, onContinue }: { kept: number; total: number; onContinue: () => void }) {
  const reduceMotion = useReducedMotion()
  const count = useMotionValue(reduceMotion ? kept : 0)
  const rounded = useTransform(count, (v) => Math.round(v))

  // Calls the latest callback without restarting the timer on every parent render.
  const continueNow = useEffectEvent(onContinue)

  useEffect(() => {
    const controls = reduceMotion ? null : animate(count, kept, { duration: COUNT_UP_S, delay: 0.3, ease })
    const timer = setTimeout(() => continueNow(), AUTO_CONTINUE_MS)
    return () => {
      controls?.stop()
      clearTimeout(timer)
    }
  }, [count, kept, reduceMotion])

  const share = total > 0 ? kept / total : 0
  const radius = 70

  return (
    <motion.div
      className={cardClass}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease }}
      role="status"
      aria-label={`You kept ${kept} of ${total} tracks`}
    >
      <p className="eyebrow">All done</p>

      <div className="relative mt-6 size-44">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="2" />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="var(--color-champagne)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: reduceMotion ? share : 0 }}
            animate={{ pathLength: share }}
            transition={{ duration: COUNT_UP_S, delay: 0.3, ease }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="font-serif text-6xl leading-none font-light tabular-nums tracking-tight text-cream">
            {rounded}
          </motion.span>
          <span className="mt-2 text-xs text-muted">of {total} kept</span>
        </div>
      </div>

      <motion.h2
        className="mt-6 font-serif text-3xl leading-tight font-light tracking-tight"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: COUNT_UP_S + 0.2, ease }}
      >
        Your <em className="text-champagne">selection</em> is ready.
      </motion.h2>

      {/* Fills up until the screen moves on. */}
      <div className="mt-8 h-px w-24 overflow-hidden bg-line">
        <motion.div
          className="h-full bg-champagne"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: AUTO_CONTINUE_MS / 1000, ease: 'linear' }}
        />
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="mt-3 text-xs text-muted transition-colors hover:text-cream"
      >
        Review now
      </button>
    </motion.div>
  )
}
