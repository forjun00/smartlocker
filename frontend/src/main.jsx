import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { LangProvider } from './i18n'
import './index.css'

// HashRouter: routes live in the URL hash (#/locker/1), so the server only ever
// serves the real index.html. Works in any subfolder with no rewrite rules.
ReactDOM.createRoot(document.getElementById('root')).render(
  <LangProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </LangProvider>
)
