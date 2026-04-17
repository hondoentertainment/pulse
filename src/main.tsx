import { createRoot } from 'react-dom/client'
import '@github/spark/spark'

import App from './App.tsx'

import './main.css'
import './styles/theme.css'
import './index.css'

/**
 * Entry point.
 *
 * All cross-cutting concerns (providers, routing, Sentry, global error
 * listeners) live inside `<App />`. Keeping main.tsx empty of side-effects
 * means the smallest possible amount of code has to parse + evaluate before
 * React can render the first frame.
 */
createRoot(document.getElementById('root')!).render(<App />)
