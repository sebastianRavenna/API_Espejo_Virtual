// Creates a self-signed certificate in .cert/ for the HTTPS dev and preview servers
// (ADR-024). It covers localhost and this machine's LAN addresses, so a phone on
// the same Wi-Fi can open the widget. Uses the openssl that ships with Git for Windows.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const candidates = ['openssl', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'];
const openssl = candidates.find((bin) => {
    try { execFileSync(bin, ['version'], { stdio: 'ignore' }); return true; } catch { return false; }
});
if (!openssl) {
    console.error('openssl not found. Install Git for Windows or add openssl to PATH.');
    process.exit(1);
}

const ips = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',');

fs.mkdirSync('.cert', { recursive: true });
execFileSync(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '825',
    '-keyout', '.cert/key.pem', '-out', '.cert/cert.pem',
    '-subj', '/CN=localhost', '-addext', `subjectAltName=${san}`
], { stdio: 'inherit' });
console.log(`Certificate created in .cert/ for: ${san}`);
