import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PeekPanel from './components/PeekPanel.tsx'

// Check if this is the peek panel window (hash-based routing)
const isPeekPanel = window.location.hash === '#/peek'

// Add peek-panel class to html element for CSS styling
if (isPeekPanel) {
  document.documentElement.classList.add('peek-panel')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPeekPanel ? <PeekPanel /> : <App />}
  </StrictMode>,
)
