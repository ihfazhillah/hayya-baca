import { Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from '@/auth/SessionProvider'
import LoginPage from '@/routes/LoginPage'
import SetupPage from '@/routes/SetupPage'
import Lobby from '@/features/lobby/Lobby'
import ChildApp from '@/features/child/ChildApp'
import GuardianApp from '@/features/guardian/GuardianApp'

function Gate() {
  const { state } = useSession()
  if (!state.family) return <LoginPage /> // guardian unlock
  if (!state.active) return <Lobby /> // profile picker
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
