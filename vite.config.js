import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
    server: { watch: { ignored: ['**/src-tauri/**'] } },
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('hyperformula'))
                        return 'hyperformula';
                    if (id.includes('xlsx'))
                        return 'xlsx';
                    if (id.includes('@tanstack'))
                        return 'tanstack';
                },
            },
        },
    },
});
