import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import App from './App.tsx'
import { ConvexDevBadge } from './components/ConvexDevBadge'
import { DemoPlaybackProvider } from './context/DemoPlaybackContext'
import { NoticeToastProvider } from './context/NoticeToastContext'
import './index.css'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <NoticeToastProvider>
          <DemoPlaybackProvider>
            <App />
          </DemoPlaybackProvider>
          <ConvexDevBadge />
        </NoticeToastProvider>
      </ConvexProvider>
    ) : (
      <NoticeToastProvider>
        <DemoPlaybackProvider>
          <App />
        </DemoPlaybackProvider>
      </NoticeToastProvider>
    )}
  </StrictMode>,
)
