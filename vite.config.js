import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // FORCE BUILD UPDATE: v4.02
    build: {
        sourcemap: true,
    }
})
