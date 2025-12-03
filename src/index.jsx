import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppRoot.jsx'
import './css/global.css' // Import global styles
import { BrowserRouter } from 'react-router-dom'

console.log('🚀 APP RELOADED v3.83 RECONNECT ' + new Date().toISOString());
alert('SYSTEM CHECK: PIPELINE RESTORED (v3.83)');

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)
