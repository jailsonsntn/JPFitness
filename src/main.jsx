import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { bootstrapNativePersistence } from './services/nativePersistence'

async function bootstrapApp() {
  await bootstrapNativePersistence()

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrapApp().catch((error) => {
  console.error('Falha ao inicializar o app', error)
})

if ('serviceWorker' in navigator) {
  // Evita cache offline durante desenvolvimento para não causar tela branca com assets antigos.
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {})
  }
}
