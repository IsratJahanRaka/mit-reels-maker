import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    base: '/mit-reels-maker/',
    plugins: [react()],
})
