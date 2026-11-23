/**
 * Every Spotify permission Swipeify asks for, with a plain-language reason.
 * The Home screen shows this list before the user connects.
 */
export const SPOTIFY_PERMISSIONS = [
  {
    scope: 'playlist-read-private',
    label: 'See your private playlists',
    why: 'So you can pick any of your playlists to swipe through.',
  },
  {
    scope: 'playlist-read-collaborative',
    label: 'See your collaborative playlists',
    why: 'So playlists you build together with others show up too.',
  },
  {
    scope: 'user-library-read',
    label: 'See your Liked Songs',
    why: 'So your Liked Songs can be swiped like any other playlist.',
  },
  {
    scope: 'playlist-modify-private',
    label: 'Create private playlists',
    why: 'Your selection is saved as a new private playlist. Your original playlist is never changed.',
  },
  {
    scope: 'streaming',
    label: 'Play music in this browser',
    why: 'So you can hear each song while you decide. Requires Spotify Premium.',
  },
  {
    scope: 'user-modify-playback-state',
    label: 'Control playback',
    why: 'To start each song at its most recognisable part instead of a slow intro.',
  },
  {
    scope: 'user-read-private',
    label: 'Read your account details',
    why: "Needed by Spotify's in-browser player, and to only show songs available in your country.",
  },
  {
    scope: 'user-read-email',
    label: 'Read your email address',
    why: "Required by Spotify's in-browser player. Swipeify never stores or shows it.",
  },
] as const

export const SPOTIFY_SCOPES = SPOTIFY_PERMISSIONS.map((p) => p.scope)
