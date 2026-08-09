import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RunApp from './RunApp'

createRoot(document.getElementById('root')!).render(<StrictMode><RunApp /></StrictMode>)
