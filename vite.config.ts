import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // We intentionally do NOT expose process.env.API_KEY here.
    // This ensures the app relies strictly on the user-inputted key via the UI.
  },
  server: {
    port: 3000,
  },
});