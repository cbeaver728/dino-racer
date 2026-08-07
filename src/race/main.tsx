import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RaceWorldApp from './RaceWorldApp'

createRoot(document.getElementById('root')!).render(<StrictMode><RaceWorldApp /></StrictMode>)
