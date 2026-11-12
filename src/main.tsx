import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter with the optical-size axis, so it can be set to its Display cut.
import '@fontsource-variable/inter/opsz.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
