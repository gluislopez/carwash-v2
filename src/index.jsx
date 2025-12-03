import React from 'react'
import ReactDOM from 'react-dom/client'
import './css/global.css' // Import global styles
// import App from './AppRoot.jsx' // REMOVED FOR ISOLATION
import { BrowserRouter } from 'react-router-dom'

console.log('🚀 APP RELOADED v3.50 NO CONFIG ' + new Date().toISOString());
alert('SYSTEM CHECK: JS IS RUNNING (v3.76)');

// BYPASS APP ROOT FOR DIAGNOSTICS
const SimpleTest = () => (
    <div style={{ color: 'white', fontSize: '3rem', padding: '2rem', textAlign: 'center' }}>
        <h1>🧪 TEST MODE v3.78</h1>
        <p>Si ves esto, React funciona.</p>
        <p>El problema está en AppRoot/Router.</p>
    </div>
);

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <SimpleTest />
    </React.StrictMode>
)
