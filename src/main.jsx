import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './css/main.css' // Import global styles

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
