import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './css/main.css' // Import global styles
import './index.css'
import { BrowserRouter } from 'react-router-dom'

console.log('🚀 APP RELOADED v3.36 EMERGENCY ' + new Date().toISOString());

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
