import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth, RequireCompleteProfile } from './components/Guards'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import { AuthProvider } from './context/AuthContext'
import { InboxProvider } from './context/InboxContext'
import { RealtimeProvider } from './context/RealtimeContext'
import { AuthPage } from './pages/AuthPage'
import { ChatPage } from './pages/ChatPage'
import { ChatsPage } from './pages/ChatsPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { ProfilePage } from './pages/ProfilePage'
import { RequestsPage } from './pages/RequestsPage'
import { UserPage } from './pages/UserPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <InboxProvider>
            <Routes>
              <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />

              <Route element={<RequireAuth><Layout /></RequireAuth>}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/" element={<RequireCompleteProfile><DiscoverPage /></RequireCompleteProfile>} />
                <Route path="/requests" element={<RequireCompleteProfile><RequestsPage /></RequireCompleteProfile>} />
                <Route path="/connections" element={<RequireCompleteProfile><ConnectionsPage /></RequireCompleteProfile>} />
                <Route path="/users/:id" element={<RequireCompleteProfile><UserPage /></RequireCompleteProfile>} />
                <Route path="/chats" element={<RequireCompleteProfile><ChatsPage /></RequireCompleteProfile>} />
                <Route path="/chats/:id" element={<RequireCompleteProfile><ChatPage /></RequireCompleteProfile>} />
                <Route path="*" element={<EmptyState title="Page not found" />} />
              </Route>
            </Routes>
          </InboxProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
