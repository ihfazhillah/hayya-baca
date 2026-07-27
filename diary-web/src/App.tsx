import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { SessionProvider, useSession } from '@/auth/SessionProvider'
import SetupPage from '@/routes/SetupPage'
import Lobby from '@/features/lobby/Lobby'
import ChildApp from '@/features/child/ChildApp'
import GuardianApp from '@/features/guardian/GuardianApp'

function Gate() {
  const { state } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const pending = useRef<string | null>(null)

  // A deep link (e.g. /post/5 from a Telegram notification) opens on the unlock
  // or lobby screen first. Remember the target while we're pre-profile…
  if (!state.active && location.pathname.startsWith('/post/')) {
    pending.current = location.pathname + location.search
  }

  // …then jump straight to it once a profile is entered.
  useEffect(() => {
    if (state.active && pending.current) {
      const target = pending.current
      pending.current = null
      if (target !== location.pathname + location.search) {
        navigate(target, { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active])

  // Lobby is the entry + resting state (Spec 061 rev): the guardian login lives
  // on the "Orang Tua" tile, so there is no separate unlock screen.
  if (!state.active) return <Lobby />
  return state.active.kind === 'child' ? <ChildApp /> : <GuardianApp />
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/*" element={<Gate />} />
      </Routes>
    </SessionProvider>
  )
}
