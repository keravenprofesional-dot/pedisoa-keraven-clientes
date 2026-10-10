import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import AvisoVersion from './components/AvisoVersion'
import './index.css'

// Hay dos copias publicadas de la misma app: la de clientas y la del
// personal (en …/personal/). Esta última arranca directo en su entrada.
if (/\/personal\/?$/.test(window.location.pathname) && !window.location.hash) {
  window.location.hash = '#/personal'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <CartProvider>
          <App />
          <AvisoVersion />
        </CartProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
