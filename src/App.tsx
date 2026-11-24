import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useLogoutInOtherTabs } from './hooks/useLogout'
import Callback from './pages/Callback'
import Home from './pages/Home'
import Playlists from './pages/Playlists'
import Results from './pages/Results'
import Swipe from './pages/Swipe'
import { auth } from './services'
import { SessionPersistence } from './state/SessionPersistence'
import { SwipeSessionProvider } from './state/SwipeSessionContext'

/** Screens that need a Spotify login send logged-out visitors to Home. */
function RequireAuth({ children }: { children: ReactNode }) {
  return auth.isLoggedIn() ? children : <Navigate to="/" replace />
}

function LogoutSync() {
  useLogoutInOtherTabs()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SwipeSessionProvider>
        <SessionPersistence />
        <LogoutSync />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/playlists" element={<RequireAuth><Playlists /></RequireAuth>} />
          <Route path="/swipe/:playlistId" element={<RequireAuth><Swipe /></RequireAuth>} />
          <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SwipeSessionProvider>
    </BrowserRouter>
  )
}
