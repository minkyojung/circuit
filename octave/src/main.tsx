// StrictMode temporarily disabled to avoid double-mounting issues with IPC event listeners
// TODO: Re-enable StrictMode after ensuring proper cleanup in all components
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Load development tools (exposes window.devTools)
import './lib/devTools'

createRoot(document.getElementById('root')!).render(
  <App />,
)
