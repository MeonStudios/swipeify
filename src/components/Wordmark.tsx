export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif text-lg tracking-tight text-cream ${className}`}>
      Swipe<em className="text-champagne">ify</em>
    </span>
  )
}
