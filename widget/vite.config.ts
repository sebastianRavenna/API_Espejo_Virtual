import { defineConfig } from 'vite';
import fs from 'node:fs';

// HTTPS with a self-signed certificate (ADR-024): the camera needs a secure
// context, also from a phone on the LAN. Create it once with `npm run cert`.
// NO_HTTPS=1 serves plain HTTP (localhost is still a secure context), for
// browsers that reject the self-signed certificate, such as Claude Code's pane.
const https = !process.env.NO_HTTPS && fs.existsSync('.cert/cert.pem')
    ? { key: fs.readFileSync('.cert/key.pem'), cert: fs.readFileSync('.cert/cert.pem') }
    : undefined;

export default defineConfig({
    server: { host: true, port: 3000, https },
    preview: { host: true, port: 4173, https },
    build: {
        // One self-contained script that any site can include (ADR-016)
        lib: {
            entry: 'src/main.ts',
            name: 'EspejoVirtual',
            formats: ['iife'],
            fileName: () => 'widget.js'
        },
        outDir: 'dist',
        emptyOutDir: true
    }
});
