import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        target: 'esnext',
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
                            return 'vendor-react';
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                        if (id.includes('exceljs') || id.includes('xlsx')) {
                            return 'vendor-excel';
                        }
                        if (id.includes('jspdf') || id.includes('html2canvas')) {
                            return 'vendor-pdf';
                        }
                        if (id.includes('socket.io-client')) {
                            return 'vendor-socket';
                        }
                    }
                }
            }
        }
    },
    server: {
        host: true, // Listen on all IPs
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false
            },
            '/uploads': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false
            },
            '/socket.io': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        }
    }
})
