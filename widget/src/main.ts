/**
 * widget.js entry point. A shop pastes one tag where the button should appear:
 *
 *   <script src="https://cdn.<domain>/widget.js" data-key="..."></script>
 *
 * The script inserts a launcher button right after itself (or inside the
 * element given by data-target) and opens the try-on in a modal.
 *
 * Attributes:
 *   data-key     tenant key (ADR-011); not used yet, the catalogue is built in (Fase 1)
 *   data-label   launcher text, default "Probátelos"
 *   data-target  CSS selector of the element to mount into, instead of after the script
 *   data-models  base URL of the GLB files; default: models-dev/ next to widget.js
 */
import { EspejoWidget } from './ui/widget';

const SCRIPT_MARKER = 'data-espejo-virtual';

function findOwnScript(): HTMLScriptElement | null {
    // A classic script (the built widget.js) knows itself while it runs. In dev it
    // is a module script, where currentScript is null, so it carries a marker.
    return (document.currentScript as HTMLScriptElement | null)
        ?? document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`);
}

function modelsBaseUrl(script: HTMLScriptElement | null): string {
    const explicit = script?.dataset.models;
    if (explicit) return new URL(explicit, document.baseURI).href;
    if (import.meta.env.DEV || !script?.src) return new URL('/models-dev/', location.href).href;
    return new URL('models-dev/', script.src).href;
}

function mount(script: HTMLScriptElement | null): void {
    const host = document.createElement('espejo-virtual');
    const target = script?.dataset.target ? document.querySelector(script.dataset.target) : null;
    if (target) target.appendChild(host);
    else if (script?.parentNode) script.parentNode.insertBefore(host, script.nextSibling);
    else document.body.appendChild(host);

    // Live tuning from the page URL: ?pitch=<degrees>, ?fade=<start>,<end> (mm), ?light=<n> (surroundings on the frame),
    // ?reflect=<sun>,<reading> (lens reflection by frame kind), ?debug=1
    const params = new URLSearchParams(location.search);
    const pitch = parseFloat(params.get('pitch') ?? '');
    const [fadeStart, fadeEnd] = (params.get('fade') ?? '').split(',').map(parseFloat);
    const light = parseFloat(params.get('light') ?? '');
    const [reflectSun, reflectReading] = (params.get('reflect') ?? '').split(',').map(parseFloat);
    new EspejoWidget(host, {
        modelsBaseUrl: modelsBaseUrl(script),
        label: script?.dataset.label || 'Probátelos',
        debug: params.has('debug'),
        pitchDeg: Number.isFinite(pitch) ? pitch : undefined,
        templeFade: Number.isFinite(fadeStart) && Number.isFinite(fadeEnd) ? { startMm: fadeStart, endMm: fadeEnd } : undefined,
        envIntensity: Number.isFinite(light) ? light : undefined,
        lensReflect: Number.isFinite(reflectSun) && Number.isFinite(reflectReading) ? { sun: reflectSun, reading: reflectReading } : undefined
    });
}

// Resolve the script now: currentScript is only set while the script first runs
const ownScript = findOwnScript();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(ownScript), { once: true });
} else {
    mount(ownScript);
}
