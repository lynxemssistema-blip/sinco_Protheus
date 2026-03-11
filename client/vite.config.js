import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true, // Listen on all IPs
        proxy: {
            '/api': {
                target: 'http://192.168.1.77:3001',
                changeOrigin: true,
                secure: false
            },
            '/socket.io': {
                target: 'http://192.168.1.77:3001',
                ws: true
            }
        }
    }
})
