import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: прод-сборка живёт на GitHub Pages по адресу /trenirovki/,
// dev-сервер — как обычно в корне. `vite preview` (isPreview) обслуживает
// готовый dist, поэтому ему нужна та же база, что и сборке.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' || isPreview ? '/trenirovki/' : '/',
  // host: true — чтобы открывать dev-версию с телефона в той же Wi-Fi сети
  server: { host: true },
}))
