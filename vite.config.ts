/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const HOST = '127.0.0.1'
const PORT = 5173

/**
 * Adds a Content-Security-Policy <meta> tag. The Spotify tokens live in
 * localStorage, so this limits what an injected script could load or where it
 * could send them. Inline scripts Vite adds in dev (React refresh) are allowed
 * by their hash, not with 'unsafe-inline'.
 */
function contentSecurityPolicy(): Plugin {
  let isDev = false
  return {
    name: 'swipeify-csp',
    configResolved(config) {
      isDev = config.command === 'serve' && !config.isProduction
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
        const hashes = await Promise.all(inlineScripts.map(sha256))
        const policy = {
          'default-src': ["'self'"],
          // The Web Playback SDK loader; it only adds an iframe from the same host.
          'script-src': ["'self'", 'https://sdk.scdn.co', ...hashes.map((h) => `'sha256-${h}'`)],
          // Vite and motion inject styles at runtime.
          'style-src': ["'self'", "'unsafe-inline'"],
          // Album and playlist art; generated covers are data: URIs.
          'img-src': ["'self'", 'data:', 'https://*.scdn.co', 'https://*.spotifycdn.com'],
          'font-src': ["'self'", 'data:'],
          'connect-src': [
            "'self'",
            'https://api.spotify.com',
            'https://accounts.spotify.com',
            ...(isDev ? [`ws://${HOST}:${PORT}`] : []),
          ],
          'frame-src': ['https://sdk.scdn.co'],
          'object-src': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'none'"],
        }
        const content = Object.entries(policy)
          .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
          .join('; ')
        // Must come before any script so it applies to all of them.
        return html.replace(/<head>/, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${content}" />`)
      },
    },
  }
}

/**
 * GitHub Pages has no fallback to index.html, so `/callback` (where Spotify
 * sends the user after login) and refreshes on other screens would show
 * GitHub's 404 page. Pages serves `404.html` for unknown paths, so make it a
 * copy of the app.
 */
function spaFallback(): Plugin {
  return {
    name: 'swipeify-spa-fallback',
    apply: 'build',
    // After Vite has emitted index.html (and the CSP tag is in it).
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset') this.error('index.html missing from the bundle')
        this.emitFile({ type: 'asset', fileName: '404.html', source: index.source })
      },
    },
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

export default defineConfig(({ mode }) => ({
  // The path the app is served under: `/` locally, `/swipeify/` on GitHub Pages
  // (the deploy workflow sets BASE_PATH).
  base: loadEnv(mode, '.', 'BASE_PATH').BASE_PATH || '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), spaFallback()],
  // Spotify requires a loopback IP (not `localhost`) in http redirect URIs, and the
  // registered redirect URI includes the port, so it must not drift.
  server: { host: HOST, port: PORT, strictPort: true },
  preview: { host: HOST, port: PORT, strictPort: true },
  test: {
    environment: 'node',
  },
}))
