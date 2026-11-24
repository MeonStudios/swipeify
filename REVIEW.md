# Open review findings

Remaining items from the November 2026 review of Swipeify by three reviewers: a security expert, a senior engineer and a critical user. Everything else from that review has been fixed. Tick items off or delete them as they're done.

## Accepted risks (no action planned)

- **Spotify tokens stay in localStorage** so the login survives between visits. The Content-Security-Policy in `vite.config.ts` is the protection instead. Moving them to sessionStorage would mean logging in again in every new tab.
- **The Spotify SDK script has no Subresource Integrity check.** `sdk.scdn.co/spotify-player.js` is unversioned and changes, so it can't be pinned. The CSP limits scripts to that host.
- **The CSP allows inline styles** (`style-src 'unsafe-inline'`), because Vite and the animation library inject styles at runtime.

## To verify

- [ ] **Playback under the CSP with a real login.** Swipe a few songs, seek, change the volume, and check the browser console for "Refused … Content Security Policy".
- [ ] **The first GitHub Actions run passes** (lint, typecheck, test, build).

## Known gaps in recent fixes

- [ ] **A failed save isn't remembered across a reload.** If adding tracks fails and the user reloads before retrying, the retry creates a second playlist. Store the save progress (`SaveProgress`) with the session to fix this.

## Code quality

### Medium

- [ ] **Rate limits and network errors** (`src/services/spotify/client.ts`).
  - `Retry-After` has no cap, so a long value leaves the app on "Loading…" for minutes. Cap it at about 30 s, then fail with the friendly 429 message.
  - Network failures surface as a raw "Failed to fetch". Wrap them in a readable message.
  - A second 401 after a successful refresh becomes a generic error. It should be a `SpotifyAuthError` ("please log in again").
- [ ] **A direct `/swipe/B` URL silently replaces the session for playlist A** (`src/pages/Swipe.tsx`). The "discard progress?" question only exists in `Playlists.choose`. Ask first, or redirect to `/playlists`.
- [ ] **The whole Swipe page re-renders 4 times a second during playback.** The position timer lives in `useTrackPlayback`. Move it into `MusicPlayer` (or a small child component) so only the player re-renders. As a side effect, the Swipe keyboard handler is also re-registered on every tick.
- [ ] **The `MusicService` abstraction only covers data.** Login and playback are Spotify singletons imported directly by pages and hooks. Either add `Auth`/`Playback` interfaces provided through React context, which makes them testable, or drop the abstraction.

### Low

- [ ] **"Continue where you left off" still shows after saving.** `clearSession()` runs but the in-memory state keeps the playlist. Dispatch `reset` or mark the session as saved.
- [ ] **API responses are cast with `as T` and never validated.** A `null` entry in a track page would crash `toPlayableTracks` (`src/services/spotify/mapping.ts`).
- [ ] **Liked Songs loads 50 songs per request, one after another**, so 5,000 songs means 100 requests in a row. Once `total` is known, fetch a few pages in parallel.
- [ ] **The JS bundle is a single ~480 kB file.** Lazy-load the Swipe and Results routes.
- [ ] **Removing a row on Results animates every row** (`layout` on each `<li>`).
- [ ] **`PlaybackController.pause()` is only used in tests.**
- [ ] **No component or hook tests.** Vitest runs in a Node environment. Add jsdom and Testing Library for the swipe flow (`SessionPersistence`, `useTrackPlayback`, the pages).

## User experience

### Annoying

- [ ] **Playlist list:** no search or sort for long lists, and empty playlists are greyed out without saying why (`src/pages/Playlists.tsx`).
- [ ] **Hidden tracks aren't explained.** Local files, episodes, unavailable songs and duplicates are dropped silently, so "500 tracks" becomes 471. Show "29 hidden: unavailable or duplicates".
- [ ] **Error screens are dead ends.**
  - Playlists and Swipe have no Retry button.
  - An expired session says "connect again" without a button to do it.
  - The 403 message always blames the developer-dashboard user list, even when that's not the cause.
- [ ] **The Premium and desktop-only requirements only appear after login.** Show them on the landing page. On a phone every card shows "Open in Spotify", which is useless for 500 songs.
- [ ] **Only one swipe session at a time.** Choosing another playlist discards the current progress, behind a native `confirm()`.
- [ ] **Screen readers:**
  - aren't told when the card changes;
  - don't hear the player status ("Connecting…", unavailable), which isn't a live region;
  - can't focus the swipe card.
- [ ] **Reduced motion is only respected on the finish screen** (`DoneCard`). The home covers, the playlist list, the card fly-out and the springs ignore it.
- [ ] **Faint text fails WCAG AA contrast:** 11 px text at 70–80% opacity (`Swipe.tsx`, `Home.tsx`) and followed playlists at `opacity-45` (`Playlists.tsx`).
- [ ] **The finish screen moves on to Results by itself after 2.8 s** (`DoneCard.tsx`). Users may want to look at the summary.

### Nice-to-have

- [ ] Statistics, "keep all from this artist", filters, and making several playlists from one source (all listed in `PROJECT_IDEA.md`).
- [ ] Show the original position ("#212 in playlist") when swiping shuffled, and say on the shuffle option that the saved playlist keeps the original order.
- [ ] Tap the card to open the song in Spotify, and show long titles in full (`TrackCardFace.tsx` truncates them).
- [ ] Choose public or private, and add a description, when saving.
- [ ] Keyboard hints on Results, and Enter to save.
- [ ] After saving, offer "Swipe the leftovers" (the skipped songs).

## Suggested next batch

1. Error recovery: Retry and log-in-again buttons, a `Retry-After` cap, readable network errors.
2. Show the Premium and desktop requirements on the landing page.
3. Guard direct `/swipe/B` URLs, and clear "Continue" after a save.
4. Accessibility: live regions, reduced motion, contrast.
