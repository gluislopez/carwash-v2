import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.jpg'],
            manifest: {
                name: 'Express CarWash System',
                short_name: 'CarWash',
                description: 'Sistema de Gestión de CarWash',
                theme_color: '#4F46E5',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                    {
                        src: 'logo.jpg',
                        sizes: '192x192',
                        type: 'image/jpeg',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'logo.jpg',
                        sizes: '512x512',
                        type: 'image/jpeg',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    // FORCE BUILD UPDATE: v4.02
    build: {
        sourcemap: true,
    }
})
