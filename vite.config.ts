import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Explicitly nullify the API_KEY environment variable in the build.
    // This guarantees that the application cannot accidentally use a build-time key
    // and must rely on the key provided by the user at runtime.
    'process.env.API_KEY': JSON.stringify(undefined),
  },
  server: {
    port: 3000,
  },
});