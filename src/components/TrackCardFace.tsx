import type { Track } from '../types/music'

/** Static visual of a track card. Used for the active card and the one peeking behind it. */
export function TrackCardFace({ track }: { track: Track }) {
  const cover = track.album.images[0]?.url
  const artists = track.artists.map((a) => a.name).join(', ')

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]">
      <div className="aspect-square w-full bg-raised">
        {cover && (
          <img
            src={cover}
            alt={`${track.album.name} cover`}
            draggable={false}
            className="h-full w-full object-cover select-none"
          />
        )}
      </div>
      <div className="px-6 pt-5 pb-6">
        <h2 className="truncate font-serif text-[1.75rem] leading-tight font-normal tracking-tight text-cream">
          {track.name}
        </h2>
        <p className="mt-1.5 truncate text-sm text-champagne">{artists}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{track.album.name}</p>
      </div>
    </div>
  )
}
