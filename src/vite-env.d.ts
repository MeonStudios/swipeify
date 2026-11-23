/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string
  /** Optional override; defaults to `<origin>/callback`. */
  readonly VITE_SPOTIFY_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
