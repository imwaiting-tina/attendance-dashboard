import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 部署在 /<repo>/ 子路径下，通过 BASE_PATH 注入
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
