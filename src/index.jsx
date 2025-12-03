import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppRoot.jsx'
import './css/global.css' // Import global styles
import { BrowserRouter } from 'react-router-dom'

console.log('🚀 APP RELOADED v3.50 NO CONFIG ' + new Date().toISOString());

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
