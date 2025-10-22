import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PeekPanel from './components/PeekPanel.tsx'

// Check if this is the peek panel window (hash-based routing)
const isPeekPanel = window.location.hash === '#/peek'

console.log('[main.tsx] Window hash:', window.location.hash, 'isPeekPanel:', isPeekPanel)

// Add peek-panel class to html element for CSS styling
if (isPeekPanel) {
  console.log('[main.tsx] Loading Peek Panel')
  document.documentElement.classList.add('peek-panel')
} else {
  console.log('[main.tsx] Loading Main App')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPeekPanel ? <PeekPanel /> : <App />}
  </StrictMode>,
)
