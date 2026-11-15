import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' agar hasil build (dist/) bisa dibuka dari file:// maupun di-hosting statis.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: false },
});
