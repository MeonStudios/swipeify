/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
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

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  // Spotify requires a loopback IP (not `localhost`) in http redirect URIs, and the
  // registered redirect URI includes the port, so it must not drift.
  server: { host: HOST, port: PORT, strictPort: true },
  preview: { host: HOST, port: PORT, strictPort: true },
  test: {
    environment: 'node',
  },
})
