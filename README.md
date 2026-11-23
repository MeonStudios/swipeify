# Swipeify

Tinder for Spotify playlists. Pick one of your playlists, hear each song, swipe right to keep it or left to drop it, and save the keepers as a new private playlist. Your original playlist is never changed.

Built with React, Vite, Tailwind and TypeScript. Runs locally.

## Requirements

- Node.js and npm
- A Spotify Premium account (in-browser playback uses the Web Playback SDK, desktop browsers only)
- An app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Setup

1. In your Spotify app settings, add the redirect URI `http://127.0.0.1:5173/callback` (Spotify does not accept `localhost`).
2. Create `.env.local` in the project root:

   ```
   VITE_SPOTIFY_CLIENT_ID=your-client-id
   # Optional, defaults to <origin>/callback
   VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
   ```

3. Install and run:

   ```
   npm install
   npm run dev
   ```

4. Open http://127.0.0.1:5173.

## Scripts

| Command           | What it does                  |
| ----------------- | ----------------------------- |
| `npm run dev`     | Start the dev server          |
| `npm run build`   | Type-check and build to `dist` |
| `npm run preview` | Serve the production build    |
| `npm test`        | Run the tests (Vitest)        |

## Limitations

The Spotify app runs in Development Mode, so:

- Only playlists you own or collaborate on can be swiped. Followed and Spotify-made playlists (e.g. Release Radar) can't be read; copy them into your own playlist first.
- At most 5 Spotify users can be allow-listed on the app.
