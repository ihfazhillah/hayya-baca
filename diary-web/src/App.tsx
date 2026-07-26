import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from '@/auth/SessionProvider'
import LoginPage from '@/routes/LoginPage'
import LockScreen from '@/routes/LockScreen'
import SetupPage from '@/routes/SetupPage'
import ChildApp from '@/features/child/ChildApp'
import GuardianApp from '@/features/guardian/GuardianApp'

function AuthGate() {
  const { state } = useSession()
  if (state.locked) return <LockScreen />
  if (!state.token || !state.me) return <LoginPage />
  return state.me.role === 'child' ? <ChildApp /> : <GuardianApp />
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/*" element={<AuthGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
