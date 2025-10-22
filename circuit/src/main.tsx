import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PeekPanel from './components/PeekPanel.tsx'

// Check if this is the peek panel window (hash-based routing)
const isPeekPanel = window.location.hash === '#/peek'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPeekPanel ? <PeekPanel /> : <App />}
  </StrictMode>,
)
