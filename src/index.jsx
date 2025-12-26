import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppRoot.jsx'
import './css/global.css' // Import global styles
import { BrowserRouter } from 'react-router-dom'

console.log('🚀 APP RELOADED v4.62 CACHE BUSTER ' + new Date().toISOString());
// alert('SYSTEM CHECK: PIPELINE RESTORED (v3.83)'); // Removed alert for production

// Manual PWA update check
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm("Nueva versión disponible. ¿Recargar?")) {
            updateSW(true);
        }
    },
    onOfflineReady() {
        console.log('App lista para usar offline');
    },
})

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)
