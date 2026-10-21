/**
 * Virtual try-on engine.
 *
 * Orchestrates the Three.js scene, MediaPipe face tracking and per-frame
 * glasses placement. One instance lives for the whole page; start() and
 * stop() run once per opening of the modal, so the camera and the WebGL
 * context only exist while the try-on is open. GLB models and the MediaPipe
 * landmarker are loaded once and reused.
 */
import * as THREE from 'three';
import { CFG, LM, IRIS, FACE_OVAL } from './constants';
import { clamp, toV, eyeMid, qDelta, toPixels, median, quantile, type Points } from './helpers';
import { FRAMES, loadGlasses, type TempleFade } from './frames';
import { createDynamicFaceMesh, createHeadOccluder } from './occluder';
import { createCamera, createVideoBackground, createLights, createRenderer, createScreenEnvironment } from './scene';
import { getFaceLandmarker, type FaceLandmarker } from './mediapipe';

export interface DebugInfo {
    irisPx: number;
    faceWidthPx: number;
    faceWidthMm: number;
    faceHeightMm: number;
    pxPerMm: number;
    eyeTilt: number;
    samples: number;
    videoSize: string;
    videoWidth: number;
    pupilPx: number;
}

/** What the person is doing wrong while the PD is measured, or 'ok'. */
export type PdStatus = 'ok' | 'noface' | 'far' | 'turned';

export interface PdResult {
    pdMm: number;        // far PD, what opticians report
    nearPdMm: number;    // as measured, converging on the camera
    distanceMm: number;
    spreadMm: number;
    frames: number;
}

interface PdMeasurement {
    samples: number[];
    nearSamples: number[];
    distanceSamples: number[];
    startedAt: number;
    onProgress?: (progress: number, status: PdStatus) => void;
    resolve: (r: PdResult) => void;
    reject: (e: Error) => void;
}

interface Session {
    video: HTMLVideoElement;
    renderer: THREE.WebGLRenderer;
    camera: THREE.OrthographicCamera;
    scene: THREE.Scene;
    bg: THREE.Texture;
    faceObj: THREE.Mesh;
    landmarker: FaceLandmarker | null;
    running: boolean;
}

export class TryOnEngine {
    private readonly modelsBaseUrl: string;
    private readonly pitchCorrection: THREE.Quaternion;
    private readonly templeFade: TempleFade;
    private readonly screenLight: number;
    private readonly frameCache = new Map<string, Promise<THREE.Group>>();
    private selectedFrameId = FRAMES[0].id;
    private glassesObj: THREE.Group | null = null;
    private session: Session | null = null;
    private predictionInFlight = false;
    private frozen = false;
    private debugInfo: DebugInfo | null = null;
    private pd: PdMeasurement | null = null;

    // Recent face size samples in mm (iris ruler); the median rejects blinks and outliers
    private readonly faceWidthMmSamples: number[] = [];
    private readonly faceHeightMmSamples: number[] = [];

    private readonly sm = {
        ready: false,
        gPos: new THREE.Vector3(),
        gQuat: new THREE.Quaternion(),
        gScale: new THREE.Vector3(1, 1, 1),
        prev: new THREE.Vector3()
    };

    constructor(opts: { modelsBaseUrl: string; pitchDeg?: number; templeFade?: TempleFade; screenLight?: number }) {
        this.modelsBaseUrl = opts.modelsBaseUrl;
        this.screenLight = opts.screenLight ?? CFG.screenLight;
        this.templeFade = opts.templeFade ?? CFG.templeFade;
        // Pitch correction: the forehead–chin line leans back compared with the head's
        // real vertical, so without this the temples rise towards the back of the head.
        // Rotates around the model's X axis at the bridge; positive lowers the temples.
        const pitchDeg = opts.pitchDeg ?? CFG.pitchCorrectionDeg;
        this.pitchCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitchDeg * Math.PI / 180);
    }

    get canvas(): HTMLCanvasElement | null {
        return this.session ? this.session.renderer.domElement : null;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * Build the scene for a playing video, append the canvas to the container
     * and start tracking. Resolves once face tracking is running.
     */
    async start(video: HTMLVideoElement, container: HTMLElement): Promise<void> {
        this.stop();
        const camera = createCamera(video);
        const { bg, sprite } = createVideoBackground(video, camera);
        const renderer = createRenderer(video);
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(sprite);

        // Reflections: a dim room with the screen's light in front of the face
        scene.environment = createScreenEnvironment(renderer, this.screenLight);

        createLights().forEach((light) => scene.add(light));

        // Face mesh occluder
        const faceObj = createDynamicFaceMesh();
        faceObj.visible = false;
        scene.add(faceObj);

        const session: Session = { video, renderer, camera, scene, bg, faceObj, landmarker: null, running: true };
        this.session = session;
        this.resetTracking();

        if (this.glassesObj) {
            this.glassesObj.visible = false;
            scene.add(this.glassesObj);
        }
        void this.selectFrame(this.selectedFrameId);

        // Until tracking is ready this loop shows the camera
        const animate = () => {
            if (!session.running || session.landmarker) return;
            requestAnimationFrame(animate);
            this.drawFrame(session);
        };
        animate();

        session.landmarker = await getFaceLandmarker();
        if (!session.running) return;
        this.scheduleNextPrediction(session);
    }

    /** Stop tracking and free the WebGL context. The camera stream is the caller's. */
    stop(): void {
        const s = this.session;
        if (!s) return;
        s.running = false;
        this.session = null;
        if (this.pd) {
            this.pd.reject(new Error('stopped'));
            this.pd = null;
        }
        if (this.glassesObj) s.scene.remove(this.glassesObj);
        s.bg.dispose();
        s.renderer.dispose();
        s.renderer.domElement.remove();
        this.frozen = false;
        this.predictionInFlight = false;
    }

    // ── Frames ───────────────────────────────────────────────────────────────

    /**
     * Each GLB loads once and is cached. The new frame takes over the current
     * pose, so switching while the face is tracked does not jump.
     */
    selectFrame(id: string): Promise<void> {
        this.selectedFrameId = id;
        let pending = this.frameCache.get(id);
        if (!pending) {
            const spec = FRAMES.find((f) => f.id === id);
            if (!spec) return Promise.reject(new Error(`unknown frame ${id}`));
            pending = loadGlasses(spec, this.modelsBaseUrl, this.templeFade).then((g) => {
                g.add(createHeadOccluder(CFG.headOccluder));  // follows the glasses' pose and mm scale
                return g;
            });
            pending.catch(() => this.frameCache.delete(id));
            this.frameCache.set(id, pending);
        }
        return pending.then((g) => {
            const s = this.session;
            if (this.selectedFrameId !== id || this.glassesObj === g) return;
            const prev = this.glassesObj;
            if (prev) {
                g.position.copy(prev.position);
                g.quaternion.copy(prev.quaternion);
                g.scale.copy(prev.scale);
                g.visible = prev.visible;
                prev.parent?.remove(prev);
            } else {
                g.visible = false;
            }
            s?.scene.add(g);
            this.glassesObj = g;
        }).catch((err) => {
            console.error(`[glasses] could not load model ${id}`, err);
        });
    }

    // ── Diagnostics (?debug=1) ───────────────────────────────────────────────

    /** While frozen, tracking and drawing stop, so the last frame stays on screen. */
    setFrozen(value: boolean): void {
        this.frozen = value;
    }

    /** Latest scale-ruler values, or null when no face is tracked. */
    getDebugInfo(): DebugInfo | null {
        return this.debugInfo;
    }

    // ── Scale ruler ──────────────────────────────────────────────────────────
    // Pixels per real millimetre. The iris (11.7 mm) calibrates the person's face
    // width and upper-face height in mm, which do not change with distance, so they
    // can be slow medians, sampled only while the face looks at the camera.
    // Each frame then measures both in pixels with no lag. Turning the head
    // shortens the width and nodding shortens the height, never both lengthen,
    // so the larger of the two estimates is the one not foreshortened.
    // Falls back to average face sizes when the model returns no iris landmarks.

    private measurePxPerMm(pts: Points, video: HTMLVideoElement): number {
        const faceWidthPx = dist(pts, LM.leftCheek, LM.rightCheek);
        const faceHeightPx = dist(pts, LM.forehead, LM.subnasale);
        const irisPx = irisDiameterPx(pts);

        if (irisPx > 0 && eyeLineTilt(pts) < CFG.frontalMaxEyeZ) {
            pushSample(this.faceWidthMmSamples, faceWidthPx * CFG.irisDiameterMm / irisPx);
            pushSample(this.faceHeightMmSamples, faceHeightPx * CFG.irisDiameterMm / irisPx);
        }

        const faceWidthMm = median(this.faceWidthMmSamples, CFG.faceWidthMm);
        const faceHeightMm = median(this.faceHeightMmSamples, CFG.faceHeightMm);
        const pxPerMm = Math.max(faceWidthPx / faceWidthMm, faceHeightPx / faceHeightMm);

        this.debugInfo = {
            irisPx, faceWidthPx, faceWidthMm, faceHeightMm, pxPerMm,
            eyeTilt: eyeLineTilt(pts),
            samples: this.faceWidthMmSamples.length,
            videoSize: `${video.videoWidth}×${video.videoHeight}`,
            videoWidth: video.videoWidth,
            pupilPx: pts.length > IRIS.rightCenter ? dist(pts, IRIS.leftCenter, IRIS.rightCenter) : 0
        };
        return pxPerMm;
    }

    // ── Pupillary distance (estimate, ADR-010 / ADR-027) ─────────────────────
    // Distance between iris centres measured with the iris itself as the ruler,
    // so it does not depend on camera distance. Only frames where the face looks
    // at the camera and is close enough count; the result is their median.
    //
    // Looking at the camera, the eyes converge and the pupils move closer than
    // when looking far away, which is the PD opticians report. Each eye turns
    // about a centre ~10 mm behind the pupil, so the near PD at distance D is
    // farPd − 2·r·sin(θ), with sin(θ) = (farPd/2) / √(D² + (farPd/2)²).
    // D comes from the pixel scale and the camera's assumed field of view.

    measurePd(onProgress?: (progress: number, status: PdStatus) => void): Promise<PdResult> {
        if (this.pd) this.pd.reject(new Error('restarted'));
        return new Promise((resolve, reject) => {
            this.pd = { samples: [], nearSamples: [], distanceSamples: [], startedAt: performance.now(), onProgress, resolve, reject };
        });
    }

    // pts is null when no face is tracked in this frame
    private samplePd(pts: Points | null, video: HTMLVideoElement): void {
        const pd = this.pd;
        if (!pd) return;
        const irisPx = pts ? irisDiameterPx(pts) : 0;
        const elapsed = performance.now() - pd.startedAt;
        const status: PdStatus = !pts ? 'noface'
            : irisPx < CFG.pd.minIrisPx ? 'far'
            : eyeLineTilt(pts) >= CFG.pd.maxEyeTilt ? 'turned'
            : 'ok';
        if (pts && status === 'ok') {
            const pxPerMm = irisPx / CFG.irisDiameterMm;
            const nearMm = dist(pts, IRIS.leftCenter, IRIS.rightCenter) / pxPerMm;
            const corrected = farPdFromNear(nearMm, pxPerMm, video);
            pd.samples.push(corrected.farMm);
            pd.nearSamples.push(nearMm);
            pd.distanceSamples.push(corrected.distanceMm);
        }

        pd.onProgress?.(Math.min(pd.samples.length / CFG.pd.frames, 1), status);

        if (pd.samples.length >= CFG.pd.frames) {
            this.pd = null;
            // Spread between the 25th and 75th percentile: if the frames disagree,
            // the median is not trustworthy and the person should get closer and retry
            const spreadMm = quantile(pd.samples, 0.75) - quantile(pd.samples, 0.25);
            if (spreadMm > CFG.pd.maxSpreadMm) {
                pd.reject(new Error('unstable'));
            } else {
                pd.resolve({
                    pdMm: median(pd.samples, 0),
                    nearPdMm: median(pd.nearSamples, 0),
                    distanceMm: median(pd.distanceSamples, 0),
                    spreadMm,
                    frames: pd.samples.length
                });
            }
        } else if (elapsed > CFG.pd.timeoutMs) {
            this.pd = null;
            pd.reject(new Error('timeout'));
        }
    }

    // ── Per-frame loop ───────────────────────────────────────────────────────
    // Each frame is drawn right after placing the glasses, in the same task as
    // detectForVideo, so the video frame on screen is the one the landmarks
    // came from (no glasses lagging behind).

    private drawFrame(s: Session): void {
        s.bg.needsUpdate = true;
        s.renderer.render(s.scene, s.camera);
    }

    private scheduleNextPrediction(s: Session): void {
        if (!s.running) return;
        const v = s.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
        if (typeof v.requestVideoFrameCallback === 'function') {
            v.requestVideoFrameCallback(() => this.renderPrediction(s));
        } else {
            requestAnimationFrame(() => this.renderPrediction(s));
        }
    }

    private resetTracking(): void {
        this.sm.ready = false;
        this.faceWidthMmSamples.length = 0;
        this.faceHeightMmSamples.length = 0;
        this.debugInfo = null;
    }

    private renderPrediction(s: Session): void {
        if (!s.running) return;
        if (this.predictionInFlight || this.frozen || !s.landmarker) {
            this.scheduleNextPrediction(s);
            return;
        }
        this.predictionInFlight = true;

        const video = s.video;
        const results = s.landmarker.detectForVideo(video, performance.now());
        const glasses = this.glassesObj;
        const faces = results.faceLandmarks;

        if (faces && faces.length > 0 && glasses) {
            glasses.visible = true;
            s.faceObj.visible = true;

            const pts = toPixels(faces[0], video);
            this.samplePd(pts, video);

            // ── Key landmarks ──
            const pxPerMm = this.measurePxPerMm(pts, video);
            const lEye = eyeMid(pts, LM.leftEyeInner, LM.leftEyeOuter);
            const rEye = eyeMid(pts, LM.rightEyeInner, LM.rightEyeOuter);
            const nose = toV(pts, LM.noseBridge);
            const fHead = toV(pts, LM.forehead);
            const chn = toV(pts, LM.chin);

            // ── Face width (for the occluder cone depth) ──
            const fW = Math.max(
                toV(pts, LM.leftTemple).distanceTo(toV(pts, LM.rightTemple)),
                toV(pts, LM.leftCheek).distanceTo(toV(pts, LM.rightCheek))
            );

            // ── Orientation (landmark-based) ──
            const xAxis = rEye.clone().sub(lEye).normalize();
            const yRaw = fHead.clone().sub(chn).normalize();
            const zAxis = xAxis.clone().cross(yRaw).normalize();
            if (zAxis.z < 0) zAxis.negate();
            const yAxis = zAxis.clone().cross(xAxis).normalize();

            const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
            const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

            // Z-flip (model faces +Z but scene uses -Z for "behind")
            targetQuat.multiply(FLIP_Z);
            targetQuat.multiply(this.pitchCorrection);

            // ── Position (model origin = bridge, so anchor it on the nose bridge) ──
            const tGPos = nose.clone()
                .addScaledVector(xAxis, CFG.bridgeSideMm * pxPerMm)
                .addScaledVector(yAxis, CFG.bridgeDropMm * pxPerMm)
                .addScaledVector(zAxis, CFG.bridgeGapMm * pxPerMm);

            // ── Scale (model is in mm, so one model unit = one real mm) ──
            const gS = pxPerMm * CFG.glassesScale;
            const tGScale = new THREE.Vector3(gS, gS, gS);

            // ── Adaptive smoothing ──
            // Higher floors than upstream (0.15–0.20), which lagged on fast moves;
            // fast motion pushes alpha towards 0.9 so the frame catches up.
            const sm = this.sm;
            const mov = tGPos.distanceTo(sm.prev);
            const aDelta = qDelta(sm.gQuat, targetQuat);
            const aP = clamp(0.35 + mov * 0.05, 0.35, 0.9);
            const aR = clamp(0.40 + aDelta * 2.0, 0.40, 0.9);
            const aS = clamp(0.35 + mov * 0.05, 0.35, 0.9);

            if (!sm.ready) {
                sm.gPos.copy(tGPos);
                sm.gQuat.copy(targetQuat);
                sm.gScale.copy(tGScale);
                sm.ready = true;
            } else {
                sm.gPos.lerp(tGPos, aP);
                sm.gQuat.slerp(targetQuat, aR);
                sm.gScale.lerp(tGScale, aS);
            }
            sm.prev.copy(tGPos);

            // ── Apply to glasses ──
            glasses.position.copy(sm.gPos);
            glasses.quaternion.copy(sm.gQuat);
            glasses.scale.copy(sm.gScale);
            glasses.updateWorldMatrix(true, true);

            // ── Update face mesh occluder ──
            const posAttr = (s.faceObj.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
            let cx = 0, cy = 0, cz = 0;
            const fwdOff = 8;
            for (let fi = 0; fi < FACE_OVAL.length; fi++) {
                const fv = toV(pts, FACE_OVAL[fi]).addScaledVector(zAxis, fwdOff);
                posAttr.setXYZ(fi + 1, fv.x, fv.y, fv.z);
                cx += fv.x; cy += fv.y; cz += fv.z;
            }
            cx /= FACE_OVAL.length;
            cy /= FACE_OVAL.length;
            cz /= FACE_OVAL.length;
            const coneD = fW * 0.5;
            posAttr.setXYZ(0, cx - zAxis.x * coneD, cy - zAxis.y * coneD, cz - zAxis.z * coneD);
            posAttr.needsUpdate = true;
        } else {
            if (glasses) glasses.visible = false;
            s.faceObj.visible = false;
            this.resetTracking();
            this.samplePd(null, video);
        }

        // Same task as detectForVideo, so the texture uploads the frame just tracked
        this.drawFrame(s);

        this.predictionInFlight = false;
        this.scheduleNextPrediction(s);
    }
}

const FLIP_Z = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);

function pushSample(samples: number[], value: number): void {
    samples.push(value);
    if (samples.length > CFG.rulerWindow) samples.shift();
}

function dist(pts: Points, a: number, b: number): number {
    return toV(pts, a).distanceTo(toV(pts, b));
}

/** Mean iris diameter in pixels (two diameters per eye), or 0 without iris points. */
function irisDiameterPx(pts: Points): number {
    if (pts.length <= IRIS.rightBottom) return 0;
    return (dist(pts, IRIS.leftRight, IRIS.leftLeft) + dist(pts, IRIS.leftTop, IRIS.leftBottom) +
            dist(pts, IRIS.rightRight, IRIS.rightLeft) + dist(pts, IRIS.rightTop, IRIS.rightBottom)) / 4;
}

/** |z| of the eye line: 0 when the face looks straight at the camera. */
function eyeLineTilt(pts: Points): number {
    return Math.abs(toV(pts, LM.rightEyeOuter).sub(toV(pts, LM.leftEyeOuter)).normalize().z);
}

/** Camera focal length in pixels, from the assumed field of view of the long side. */
function focalLengthPx(video: HTMLVideoElement): number {
    const longSidePx = Math.max(video.videoWidth, video.videoHeight);
    return (longSidePx / 2) / Math.tan(CFG.pd.cameraFovDeg * Math.PI / 360);
}

/** Far PD from a PD measured while converging on the camera. */
function farPdFromNear(nearPdMm: number, pxPerMm: number, video: HTMLVideoElement): { farMm: number; distanceMm: number } {
    const r = CFG.pd.pupilToRotationMm;
    const distanceMm = focalLengthPx(video) / pxPerMm + r;  // camera to the eyes' rotation centres
    // Solve near = far − 2·r·(far/2)/√(D² + (far/2)²) for far; a few fixed-point steps converge
    let far = nearPdMm;
    for (let i = 0; i < 4; i++) {
        const half = far / 2;
        far = nearPdMm + 2 * r * half / Math.sqrt(distanceMm * distanceMm + half * half);
    }
    return { farMm: far, distanceMm };
}
