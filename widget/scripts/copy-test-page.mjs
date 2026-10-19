// Puts the plain-HTML test page (repo root test-pages/index.html) next to the
// built widget.js, so `vite preview` serves both from dist/ over HTTPS.
import fs from 'node:fs';

fs.copyFileSync('../test-pages/index.html', 'dist/index.html');
console.log('Copied test-pages/index.html to dist/index.html');
