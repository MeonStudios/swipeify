# Swipeify

Tinder for Spotify playlists. Pick one of your playlists, hear each song, swipe right to keep it or left to drop it, and save the keepers as a new private playlist. Your original playlist is never changed.

Built with React, Vite, Tailwind and TypeScript. Runs locally in your browser; there is no server.

## What you need

- **Node.js 20.19+ or 22.12+** (includes npm). Check with `node --version`; download from [nodejs.org](https://nodejs.org).
- **Spotify Premium.** Spotify only allows in-browser playback for Premium accounts.
- **A desktop browser** (Chrome, Edge, Firefox or Safari). Spotify's player does not work in mobile browsers.
- About 10 minutes for the one-time setup below.

## Setup

### 1. Create a Spotify app

Swipeify talks to Spotify through an "app" that you register yourself. It's free.

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in with your Spotify account. Accept the developer terms if asked.
2. Click **Create app** and fill in:
   - **App name** and **App description**: anything, e.g. `Swipeify`.
   - **Redirect URIs**: type `http://127.0.0.1:5173/callback` and click **Add**. Copy it exactly: `127.0.0.1`, not `localhost`, which Spotify rejects.
   - **Which API/SDKs are you planning to use?**: tick **Web API** and **Web Playback SDK**.
3. Accept the terms and click **Save**.

### 2. Allow your account to use the app

New Spotify apps run in *Development Mode* and only work for accounts you add explicitly.

1. Open your app in the dashboard and go to **Settings → User Management**.
2. Add the name and the **email address of your Spotify account**, then save.

Repeat this for anyone else who should use your copy (up to 5 people).

### 3. Copy the Client ID

1. In your app, open **Settings → Basic Information** and copy the **Client ID**.
2. In the project folder, copy `.env.example` to a new file named `.env.local`:

   ```sh
   cp .env.example .env.local        # macOS / Linux / Git Bash
   copy .env.example .env.local      # Windows Command Prompt
   ```

3. Paste the Client ID after `VITE_SPOTIFY_CLIENT_ID=`:

   ```
   VITE_SPOTIFY_CLIENT_ID=0123456789abcdef0123456789abcdef
   ```

You don't need the **Client secret**. Never put it in this file.

### 4. Install and run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**, not `localhost:5173`, and click **Connect Spotify**.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Home screen says "Add `VITE_SPOTIFY_CLIENT_ID` to `.env.local`" | Check that `.env.local` exists in the project root (next to `package.json`) and contains `VITE_SPOTIFY_CLIENT_ID=…`. Then stop the dev server (Ctrl+C) and run `npm run dev` again; changes to `.env.local` are only picked up on start. |
| Spotify shows **INVALID_CLIENT: Invalid redirect URI** | The redirect URI in your app settings must be exactly `http://127.0.0.1:5173/callback`, and you must open the app on `http://127.0.0.1:5173`, not `localhost`. |
| Spotify shows **INVALID_CLIENT: Invalid client** | The Client ID in `.env.local` is wrong or has extra characters. Copy it again and restart the dev server. |
| "Spotify refused this request…" / "user not registered" | Your Spotify account isn't on the app's user list. See step 2; use the email of the account you log in with. |
| "Port 5173 is in use" | Another program (maybe a second `npm run dev`) is using the port. Close it; Swipeify needs exactly port 5173 because that's in the redirect URI. |
| Songs don't play / "Listening in Swipeify needs Spotify Premium" | Browser playback needs Spotify Premium. You can still swipe and open each song in Spotify. |
| "Spotify doesn’t support listening in this browser" | You're on a phone or tablet. Use a desktop browser. |
| A playlist is greyed out | Spotify only lets Development Mode apps read playlists you own or collaborate on. Copy the songs into a playlist of your own first. |

## Limitations

The Spotify app runs in Development Mode, so:

- Only playlists you own or collaborate on (and your Liked Songs) can be swiped. Followed and Spotify-made playlists (e.g. Release Radar) can't be read; copy them into your own playlist first.
- At most 5 Spotify users can be allow-listed on the app.

Local files, podcast episodes, songs unavailable in your country and duplicates are left out of a swipe session.

## Scripts

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server on http://127.0.0.1:5173  |
| `npm run build`     | Type-check and build to `dist`                 |
| `npm run preview`   | Serve the production build                     |
| `npm test`          | Run the tests (Vitest)                         |
| `npm run lint`      | Lint with [oxlint](https://oxc.rs)             |
| `npm run typecheck` | Type-check without building                    |
| `npm run check`     | Lint, type-check and test, as CI does          |

CI (GitHub Actions) runs lint, type-check, tests and build on every push to `main` and on pull requests.

The project lints with oxlint instead of ESLint because typescript-eslint doesn't support TypeScript 7 yet.

## Privacy

Everything stays in your browser. The Spotify login and your swipe progress are kept in the browser's local storage. **Log out** removes them. To revoke Swipeify's access to your account entirely, remove it at [spotify.com/account/apps](https://www.spotify.com/account/apps/).
