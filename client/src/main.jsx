import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Higienização preventiva do localStorage para sessões corrompidas e caches legados
['@Lynx:user', '@Lynx:token', '@LynxEMS:user', '@LynxEMS:token'].forEach(key => {
    try {
        const val = localStorage.getItem(key);
        if (!val || val === 'undefined' || val === 'null' || val === '') {
            localStorage.removeItem(key);
        } else if (key.endsWith('user')) {
            JSON.parse(val); // Verifica se o JSON é válido
        }
    } catch {
        localStorage.removeItem(key);
    }
});

// Limpeza de caches pesados que não devem persistir entre sessões
try {
    localStorage.removeItem('@lynxems:matrix_data');
    sessionStorage.removeItem('@lynxems:matrix_data');
} catch (_) {}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
