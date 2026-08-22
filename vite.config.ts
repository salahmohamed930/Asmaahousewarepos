import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ilyxhubihdqjbvkkpalx.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w'),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
