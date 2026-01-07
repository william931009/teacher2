import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose the API key safely to the client (only if necessary for this demo architecture)
      // Ideally, API calls should be proxied, but for a client-side demo using the SDK:
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    server: {
      port: 3000,
    },
  };
});