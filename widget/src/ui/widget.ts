/**
 * Widget UI: a launcher button that opens the try-on in a modal (decided
 * 2026-10-19, ADR-029). Everything lives in a Shadow DOM so the shop's site
 * and the widget cannot break each other's styles. The camera is requested
 * only when the modal opens and is switched off when it closes.
 */
import { TryOnEngine, type PdResult, type PdStatus, type DebugInfo } from '../engine/engine';
import { FRAMES, type TempleFade } from '../engine/frames';
import { CFG } from '../engine/constants';
import css from './styles.css?inline';

const CARD_WIDTH_MM = 85.6;  // ISO/IEC 7810 ID-1 card (SUBE, debit, DNI)

// What to tell the person while the PD is being measured, by engine status
const PD_HINTS: Record<PdStatus, string> = {
    ok: 'Midiendo… quedate quieto mirando a la cámara.',
    noface: 'No vemos tu cara. Ponete frente a la cámara.',
    far: 'Acercate más a la cámara.',
    turned: 'Mirá derecho a la cámara, con la cara de frente.'
};

const LOADING_STEPS = ['Abriendo la cámara', 'Preparando el probador', 'Cargando el seguimiento de la cara'];

export interface WidgetOptions {
    modelsBaseUrl: string;
    label: string;
    debug: boolean;
    pitchDeg?: number;
    templeFade?: TempleFade;
    screenLight?: number;
}

interface CardClick { x: number; y: number; cssToVideo: number; }

export class EspejoWidget {
    private readonly root: ShadowRoot;
    private readonly engine: TryOnEngine;
    private readonly opts: WidgetOptions;
    private readonly el: Record<string, HTMLElement>;
    private readonly video: HTMLVideoElement;
    private stream: MediaStream | null = null;
    private openToken = 0;
    private frameId = FRAMES[0].id;
    private recorder: MediaRecorder | null = null;
    private debugTimer = 0;
    private frozen = false;
    private cardClicks: CardClick[] = [];

    constructor(host: HTMLElement, opts: WidgetOptions) {
        this.opts = opts;
        this.engine = new TryOnEngine({ modelsBaseUrl: opts.modelsBaseUrl, pitchDeg: opts.pitchDeg, templeFade: opts.templeFade, screenLight: opts.screenLight });
        // Diagnostics: reach the engine from the browser console
        if (opts.debug) (window as unknown as { __espejoEngine: TryOnEngine }).__espejoEngine = this.engine;
        this.root = host.attachShadow({ mode: 'open' });
        this.root.innerHTML = this.template();
        const q = (sel: string) => this.root.querySelector(sel) as HTMLElement;
        this.el = {
            launch: q('.ev-launch'), overlay: q('.ev-overlay'), close: q('.ev-close'),
            viewport: q('.ev-viewport'), stage: q('.ev-stage'), loading: q('.ev-loading'),
            steps: q('.ev-steps'), error: q('.ev-error'), errorText: q('.ev-error p'),
            frames: q('.ev-frames'), pdBtn: q('[data-action="pd"]'), recBtn: q('[data-action="record"]'),
            pd: q('.ev-pd'), debug: q('.ev-debug-info'), card: q('.ev-card'), freeze: q('[data-action="freeze"]')
        };
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.el.stage.appendChild(this.video);
        this.renderFrames();
        this.bind();
    }

    private template(): string {
        const debug = this.opts.debug;
        return `
<style>${css}</style>
<button class="ev-launch" type="button" aria-haspopup="dialog">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <circle cx="6" cy="13" r="4"/><circle cx="18" cy="13" r="4"/><path d="M10 13h4M2 13l1-5M22 13l-1-5"/>
  </svg>
  <span>${escapeHtml(this.opts.label)}</span>
</button>
<div class="ev-overlay" hidden>
  <div class="ev-modal" role="dialog" aria-modal="true" aria-label="Probador virtual">
    <div class="ev-header"><span>Probador virtual</span><button class="ev-close" type="button" aria-label="Cerrar">✕</button></div>
    <div class="ev-viewport">
      <div class="ev-stage"></div>
      <div class="ev-loading"><div class="ev-steps"></div></div>
      <div class="ev-error" hidden><p></p><button class="ev-btn" type="button" data-action="retry">Reintentar</button></div>
    </div>
    <div class="ev-row ev-frames"></div>
    <div class="ev-row">
      <button class="ev-btn" type="button" data-action="pd" disabled>Medir DP</button>
      <button class="ev-btn" type="button" data-action="photo">Foto</button>
      <button class="ev-btn" type="button" data-action="record">Grabar</button>
    </div>
    <div class="ev-pd" role="status" hidden></div>
    ${debug ? `<pre class="ev-debug ev-debug-info">sin cara</pre>
    <div class="ev-row"><button class="ev-btn" type="button" data-action="freeze">Congelar</button></div>
    <pre class="ev-debug ev-card" hidden></pre>` : ''}
    <p class="ev-privacy">La imagen de la cámara se procesa solo en tu dispositivo: no se sube ni se guarda.</p>
  </div>
</div>`;
    }

    private renderFrames(): void {
        this.el.frames.innerHTML = FRAMES.map((f) =>
            `<button class="ev-btn${f.id === this.frameId ? ' selected' : ''}" type="button" data-frame="${f.id}">${escapeHtml(f.name)}</button>`
        ).join('');
    }

    private bind(): void {
        this.el.launch.addEventListener('click', () => void this.open());
        this.el.close.addEventListener('click', () => this.close());
        this.el.overlay.addEventListener('click', (e) => { if (e.target === this.el.overlay) this.close(); });
        this.root.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') this.close(); });
        this.el.frames.addEventListener('click', (e) => {
            const id = (e.target as HTMLElement).closest('[data-frame]')?.getAttribute('data-frame');
            if (!id) return;
            this.frameId = id;
            this.renderFrames();
            void this.engine.selectFrame(id);
        });
        this.root.addEventListener('click', (e) => {
            const action = (e.target as HTMLElement).closest('[data-action]')?.getAttribute('data-action');
            if (action === 'pd') this.measurePd();
            else if (action === 'photo') this.photo();
            else if (action === 'record') this.toggleRecord();
            else if (action === 'retry') void this.open();
            else if (action === 'freeze') this.toggleFreeze();
        });
        this.el.stage.addEventListener('click', (e) => this.cardClick(e));
    }

    // ── Open / close ─────────────────────────────────────────────────────────

    private async open(): Promise<void> {
        const token = ++this.openToken;
        this.el.overlay.hidden = false;
        this.el.error.hidden = true;
        this.el.loading.hidden = false;
        this.el.pd.hidden = true;
        (this.el.pdBtn as HTMLButtonElement).disabled = true;
        this.el.close.focus();
        this.setStep(0);
        try {
            // 1280×720 doubles the iris size in pixels vs. the 640×480 default,
            // which halves the PD / scale error from one pixel of landmark noise
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            if (token !== this.openToken) { stream.getTracks().forEach((t) => t.stop()); return; }
            this.stream = stream;
            this.video.srcObject = stream;
            await this.video.play();
            if (!this.video.videoWidth) await new Promise((r) => this.video.addEventListener('loadedmetadata', r, { once: true }));
            if (token !== this.openToken) return;

            this.setStep(1);
            const started = this.engine.start(this.video, this.el.stage);
            this.setStep(2);   // the scene is built synchronously; what is left is MediaPipe
            await started;
            if (token !== this.openToken) return;
            this.el.loading.hidden = true;
            (this.el.pdBtn as HTMLButtonElement).disabled = false;
            if (this.opts.debug) this.startDebug();
        } catch (err) {
            if (token !== this.openToken) return;
            this.showError(err);
        }
    }

    private close(): void {
        if (this.el.overlay.hidden) return;
        this.openToken++;
        if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
        this.engine.stop();
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.video.srcObject = null;
        window.clearInterval(this.debugTimer);
        this.frozen = false;
        this.cardClicks = [];
        this.renderMarks();
        this.el.overlay.hidden = true;
        this.el.launch.focus();
    }

    private setStep(i: number): void {
        this.el.steps.innerHTML = LOADING_STEPS.map((label, k) =>
            `<div class="ev-step${k < i ? ' done' : k === i ? ' active' : ''}">${label}</div>`).join('');
    }

    private showError(err: unknown): void {
        console.error('[espejo] could not start', err);
        const name = (err as { name?: string })?.name;
        this.el.errorText.textContent =
            name === 'NotAllowedError' ? 'Para probarte los anteojos necesitamos permiso para usar la cámara. Habilitalo en el navegador y tocá Reintentar.'
            : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No encontramos una cámara en este dispositivo.'
            : !window.isSecureContext ? 'El probador necesita una conexión segura (https).'
            : 'No pudimos iniciar el probador. Revisá tu conexión y tocá Reintentar.';
        this.el.loading.hidden = true;
        this.el.error.hidden = false;
    }

    // ── PD estimate ──────────────────────────────────────────────────────────

    private measurePd(): void {
        const pd = this.el.pd;
        const btn = this.el.pdBtn as HTMLButtonElement;
        btn.disabled = true;
        pd.hidden = false;
        const notice = '<p class="ev-pd-notice">Es una estimación hecha con la cámara. No reemplaza la medición de tu óptico.</p>';
        const show = (html: string) => { pd.innerHTML = html + notice; };
        show(`<p>${PD_HINTS.noface} 0%</p>`);
        this.engine.measurePd((progress, status) => {
            show(`<p>${PD_HINTS[status]} ${Math.round(progress * 100)}%</p>`);
        }).then((r: PdResult) => {
            const detail = this.opts.debug
                ? `<p>de lejos ${r.pdMm.toFixed(1)} mm · de cerca (medida) ${r.nearPdMm.toFixed(1)} mm<br>distancia estimada ${(r.distanceMm / 10).toFixed(0)} cm · dispersión ${r.spreadMm.toFixed(1)} mm</p>`
                : '';
            show(`<p class="ev-pd-value">DP estimada: ${Math.round(r.pdMm)} mm <small>(de lejos)</small></p>${detail}`);
        }).catch((err: Error) => {
            if (err.message === 'timeout') show('<p>No se pudo medir. Acercate a la cámara, mirala de frente y probá de nuevo.</p>');
            else if (err.message === 'unstable') show('<p>La medición salió inestable. Acercate un poco más, quedate quieto y probá de nuevo.</p>');
        }).finally(() => { btn.disabled = false; });
    }

    // ── Photo and recording ──────────────────────────────────────────────────

    private photo(): void {
        const canvas = this.engine.canvas;
        if (canvas) download(canvas.toDataURL('image/png'), `probador-${Date.now()}.png`);
    }

    private toggleRecord(): void {
        const btn = this.el.recBtn;
        if (this.recorder && this.recorder.state !== 'inactive') {
            this.recorder.stop();
            return;
        }
        const canvas = this.engine.canvas;
        if (!canvas) return;
        const chunks: Blob[] = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType });
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            btn.textContent = 'Grabar';
            btn.classList.remove('recording');
            const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
            download(url, `probador-${Date.now()}.webm`);
            URL.revokeObjectURL(url);
        };
        recorder.start();
        this.recorder = recorder;
        btn.textContent = 'Detener';
        btn.classList.add('recording');
    }

    // ── Diagnostics (?debug=1) ───────────────────────────────────────────────

    private startDebug(): void {
        window.clearInterval(this.debugTimer);
        this.debugTimer = window.setInterval(() => {
            const d = this.engine.getDebugInfo();
            this.el.debug.textContent = d
                ? `cámara: ${d.videoSize}\niris: ${d.irisPx.toFixed(1)} px\n` +
                  `ancho de cara: ${d.faceWidthMm.toFixed(0)} mm (${d.faceWidthPx.toFixed(0)} px)\n` +
                  `alto superior: ${d.faceHeightMm.toFixed(0)} mm\nescala: ${d.pxPerMm.toFixed(2)} px/mm\n` +
                  `giro (|z| ojos): ${d.eyeTilt.toFixed(2)}  muestras: ${d.samples}  inclinación: ${this.opts.pitchDeg ?? CFG.pitchCorrectionDeg}°`
                : 'sin cara';
            if (this.frozen) this.el.card.textContent = cardReport(this.cardClicks, d);
        }, 250);
    }

    private toggleFreeze(): void {
        this.frozen = !this.frozen;
        this.engine.setFrozen(this.frozen);
        this.cardClicks = [];
        this.renderMarks();
        this.el.freeze.textContent = this.frozen ? 'Seguir' : 'Congelar';
        this.el.card.hidden = !this.frozen;
        this.el.stage.style.cursor = this.frozen ? 'crosshair' : '';
    }

    private cardClick(e: MouseEvent): void {
        const canvas = this.engine.canvas;
        if (!this.frozen || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        // The canvas uses object-fit: cover, so the image may be scaled past the
        // box and cropped; the visible scale is the larger of the two ratios
        const cssPerVideoPx = Math.max(rect.width / this.video.videoWidth, rect.height / this.video.videoHeight);
        const box = this.el.viewport.getBoundingClientRect();
        const click = { x: e.clientX - box.left, y: e.clientY - box.top, cssToVideo: 1 / cssPerVideoPx };
        this.cardClicks = this.cardClicks.length >= 2 ? [click] : this.cardClicks.concat([click]);
        this.renderMarks();
    }

    private renderMarks(): void {
        this.el.viewport.querySelectorAll('.ev-mark').forEach((m) => m.remove());
        for (const c of this.cardClicks) {
            const m = document.createElement('div');
            m.className = 'ev-mark';
            m.style.left = `${c.x}px`;
            m.style.top = `${c.y}px`;
            this.el.viewport.appendChild(m);
        }
    }
}

// Compares the card (known 85.6 mm) with the iris ruler on the frozen frame.
// The card must be flat on the forehead, at the same distance as the eyes.
function cardReport(clicks: CardClick[], info: DebugInfo | null): string {
    if (!info) return 'Sin cara en el cuadro congelado. Tocá "Seguir" y volvé a congelar.';
    if (clicks.length < 2) return `Hacé clic en el borde ${clicks.length ? 'derecho' : 'izquierdo'} de la tarjeta.`;
    const cssPx = Math.hypot(clicks[1].x - clicks[0].x, clicks[1].y - clicks[0].y);
    const cardScale = cssPx * clicks[1].cssToVideo / CARD_WIDTH_MM;
    const irisScale = info.irisPx / CFG.irisDiameterMm;
    const diff = (irisScale / cardScale - 1) * 100;
    return `tarjeta: ${(cardScale * CARD_WIDTH_MM).toFixed(0)} px → ${cardScale.toFixed(2)} px/mm\n` +
        `iris:    ${irisScale.toFixed(2)} px/mm (${diff >= 0 ? '+' : ''}${diff.toFixed(0)} % contra la tarjeta)\n` +
        `app:     ${info.pxPerMm.toFixed(2)} px/mm (escala del anteojo)\n` +
        `con la tarjeta → DP: ${(info.pupilPx / cardScale).toFixed(1)} mm · ancho de cara: ${(info.faceWidthPx / cardScale).toFixed(0)} mm\n` +
        `con el iris    → DP: ${(info.pupilPx / irisScale).toFixed(1)} mm · ancho de cara: ${(info.faceWidthPx / irisScale).toFixed(0)} mm`;
}

function download(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
