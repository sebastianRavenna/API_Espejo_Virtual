/**
 * Virtual Try-On Engine
 *
 * Orchestrates the Three.js scene, MediaPipe face tracking, and per-frame
 * glasses placement. All shared state lives in this module; sub-modules
 * (glasses, occluder, scene, helpers) are stateless factories.
 *
 * Public API:
 *   initializeThreejs(objName) — set up scene, camera, models
 *   initializeEngine()         — load MediaPipe and start prediction loop
 */

import * as THREE from 'three';
import { CFG, LM, IRIS, FACE_OVAL } from './constants';
import { clamp, toV, eyeMid, qDelta, toPixels } from './helpers';
import { loadGlasses, FRAMES } from './glbGlasses';
import { createDynamicFaceMesh, createHeadOccluder } from './occluder';
import { createCamera, createVideoBackground, createLights, createRenderer, handleResize } from './scene';

export { FRAMES };

// ── Private State ────────────────────────────────────────────────────────────
var faceLandmarker;
var glassesObj;
var faceObj;
var bg;
var video;
var renderer;
var camera;
var scene;
let predictionInFlight = false;

// Recent face size samples in mm (iris ruler); the median rejects blinks and outliers
const faceWidthMmSamples = [];
const faceHeightMmSamples = [];

const sm = {
    ready: false,
    gPos: new THREE.Vector3(),
    gQuat: new THREE.Quaternion(),
    gScale: new THREE.Vector3(1, 1, 1),
    prev: new THREE.Vector3()
};

// ── Scale Ruler ──────────────────────────────────────────────────────────────
// Pixels per real millimetre. The iris (11.7 mm) calibrates the person's face
// width and upper-face height in mm, which do not change with distance, so they
// can be slow medians, sampled only while the face looks at the camera.
// Each frame then measures both in pixels with no lag. Turning the head
// shortens the width and nodding shortens the height, never both lengthen,
// so the larger of the two estimates is the one not foreshortened.
// Falls back to average face sizes when the model returns no iris landmarks.
function median(samples, fallback) {
    if (!samples.length) return fallback;
    var sorted = samples.slice().sort(function(a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
}

function pushSample(samples, value) {
    samples.push(value);
    if (samples.length > CFG.rulerWindow) samples.shift();
}

function dist(pts, a, b) {
    return toV(pts, a).distanceTo(toV(pts, b));
}

/** Mean iris diameter in pixels (two diameters per eye), or 0 without iris points. */
function irisDiameterPx(pts) {
    if (pts.length <= IRIS.rightBottom) return 0;
    return (dist(pts, IRIS.leftRight, IRIS.leftLeft) + dist(pts, IRIS.leftTop, IRIS.leftBottom) +
            dist(pts, IRIS.rightRight, IRIS.rightLeft) + dist(pts, IRIS.rightTop, IRIS.rightBottom)) / 4;
}

/** |z| of the eye line: 0 when the face looks straight at the camera. */
function eyeLineTilt(pts) {
    return Math.abs(toV(pts, LM.rightEyeOuter).sub(toV(pts, LM.leftEyeOuter)).normalize().z);
}

function measurePxPerMm(pts) {
    var faceWidthPx = dist(pts, LM.leftCheek, LM.rightCheek);
    var faceHeightPx = dist(pts, LM.forehead, LM.subnasale);
    var irisPx = irisDiameterPx(pts);

    if (irisPx > 0 && eyeLineTilt(pts) < CFG.frontalMaxEyeZ) {
        pushSample(faceWidthMmSamples, faceWidthPx * CFG.irisDiameterMm / irisPx);
        pushSample(faceHeightMmSamples, faceHeightPx * CFG.irisDiameterMm / irisPx);
    }

    var faceWidthMm = median(faceWidthMmSamples, CFG.faceWidthMm);
    var faceHeightMm = median(faceHeightMmSamples, CFG.faceHeightMm);
    var pxPerMm = Math.max(faceWidthPx / faceWidthMm, faceHeightPx / faceHeightMm);

    // Diagnostics for ?debug=1: is the iris ruler giving plausible face sizes?
    debugInfo = {
        irisPx: irisPx,
        faceWidthPx: faceWidthPx,
        faceWidthMm: faceWidthMm,
        faceHeightMm: faceHeightMm,
        pxPerMm: pxPerMm,
        eyeTilt: eyeLineTilt(pts),
        samples: faceWidthMmSamples.length,
        videoSize: video.videoWidth + '×' + video.videoHeight,
        videoWidth: video.videoWidth,
        pupilPx: pts.length > IRIS.rightCenter ? dist(pts, IRIS.leftCenter, IRIS.rightCenter) : 0
    };
    return pxPerMm;
}

// While frozen, tracking and drawing stop, so the last frame and its
// diagnostics stay on screen for measuring a reference card (?debug=1).
var frozen = false;

export function setFrozen(value) {
    frozen = value;
}

var debugInfo = null;

/** Latest scale-ruler values, or null when no face is tracked. */
export function getDebugInfo() {
    return debugInfo;
}

// ── Pupillary Distance (estimate, ADR-010) ───────────────────────────────────
// Distance between iris centres measured with the iris itself as the ruler,
// so it does not depend on camera distance. Only frames where the face looks
// at the camera and is close enough count; the result is their median.
//
// Looking at the camera, the eyes converge and the pupils move closer than
// when looking far away, which is the PD opticians report. Each eye turns
// about a centre ~10 mm behind the pupil, so the near PD at distance D is
// farPd − 2·r·sin(θ), with sin(θ) = (farPd/2) / √(D² + (farPd/2)²).
// D comes from the pixel scale and the camera's assumed field of view.
var pd = null;

/** Camera focal length in pixels, from the assumed field of view of the long side. */
function focalLengthPx() {
    var longSidePx = Math.max(video.videoWidth, video.videoHeight);
    return (longSidePx / 2) / Math.tan(CFG.pd.cameraFovDeg * Math.PI / 360);
}

/** Far PD from a PD measured while converging on the camera. */
function farPdFromNear(nearPdMm, pxPerMm) {
    var r = CFG.pd.pupilToRotationMm;
    var distanceMm = focalLengthPx() / pxPerMm + r;  // camera to the eyes' rotation centres
    // Solve near = far − 2·r·(far/2)/√(D² + (far/2)²) for far; a few fixed-point steps converge
    var far = nearPdMm;
    for (var i = 0; i < 4; i++) {
        var half = far / 2;
        far = nearPdMm + 2 * r * half / Math.sqrt(distanceMm * distanceMm + half * half);
    }
    return { farMm: far, distanceMm: distanceMm };
}

export function measurePd(onProgress) {
    if (pd) pd.reject(new Error('restarted'));
    return new Promise(function(resolve, reject) {
        pd = {
            samples: [], nearSamples: [], distanceSamples: [],  // samples = far PD
            startedAt: performance.now(), onProgress: onProgress, resolve: resolve, reject: reject
        };
    });
}

/** Value at fraction q (0–1) of the sorted samples. */
function quantile(samples, q) {
    var sorted = samples.slice().sort(function(a, b) { return a - b; });
    return sorted[Math.floor((sorted.length - 1) * q)];
}

// pts is null when no face is tracked in this frame.
// onProgress(progress 0–1, status) with status 'ok' | 'noface' | 'far' | 'turned'.
function samplePd(pts) {
    if (!pd) return;
    var irisPx = pts ? irisDiameterPx(pts) : 0;
    var elapsed = performance.now() - pd.startedAt;
    var status = !pts ? 'noface'
        : irisPx < CFG.pd.minIrisPx ? 'far'
        : eyeLineTilt(pts) >= CFG.pd.maxEyeTilt ? 'turned'
        : 'ok';
    if (status === 'ok') {
        var pxPerMm = irisPx / CFG.irisDiameterMm;
        var nearMm = dist(pts, IRIS.leftCenter, IRIS.rightCenter) / pxPerMm;
        var corrected = farPdFromNear(nearMm, pxPerMm);
        pd.samples.push(corrected.farMm);
        pd.nearSamples.push(nearMm);
        pd.distanceSamples.push(corrected.distanceMm);
    }

    var progress = pd.samples.length / CFG.pd.frames;
    if (pd.onProgress) pd.onProgress(Math.min(progress, 1), status);

    if (pd.samples.length >= CFG.pd.frames) {
        var done = pd; pd = null;
        // Spread between the 25th and 75th percentile: if the frames disagree,
        // the median is not trustworthy and the person should get closer and retry
        var spreadMm = quantile(done.samples, 0.75) - quantile(done.samples, 0.25);
        if (spreadMm > CFG.pd.maxSpreadMm) {
            done.reject(new Error('unstable'));
        } else {
            done.resolve({
                pdMm: median(done.samples, 0),             // far PD, what opticians report
                nearPdMm: median(done.nearSamples, 0),     // as measured, converging on the camera
                distanceMm: median(done.distanceSamples, 0),
                spreadMm: spreadMm,
                frames: done.samples.length
            });
        }
    } else if (elapsed > CFG.pd.timeoutMs) {
        var failed = pd; pd = null;
        failed.reject(new Error('timeout'));
    }
}

// ── Animation Loop ───────────────────────────────────────────────────────────
// Until tracking is ready this loop shows the camera. After that, each frame is
// drawn by renderPrediction, right after placing the glasses, so the video
// frame on screen is the one the landmarks came from (no glasses lagging behind).
function animate() {
    if (faceLandmarker) return;
    requestAnimationFrame(animate);
    drawFrame();
}

function drawFrame() {
    bg.needsUpdate = true;
    renderer.render(scene, camera);
}

// ── Public: Initialize Three.js Scene ────────────────────────────────────────
export function initializeThreejs(objName) {
    video = document.getElementById('tryon-video');
    var container = document.getElementById('threejsContainer');

    // Camera
    camera = createCamera(video);

    // Video background
    var bgResult = createVideoBackground(video, camera);
    bg = bgResult.bg;

    // Renderer (created early so PMREMGenerator can use it)
    renderer = createRenderer(video);
    container.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.add(bgResult.sprite);

    // Environment map for realistic reflections on clearcoat / metallic surfaces
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    var neutralEnv = pmrem.fromScene(new THREE.Scene()).texture;
    scene.environment = neutralEnv;
    pmrem.dispose();

    // Lights
    createLights().forEach(function(light) { scene.add(light); });

    // Face mesh occluder
    faceObj = createDynamicFaceMesh();
    faceObj.visible = false;
    scene.add(faceObj);

    // Glasses model (GLB in ADR-015 convention: mm, origin at the bridge)
    selectFrame(FRAMES[0].id);

    window.addEventListener('resize', function() {
        handleResize(camera, renderer, video);
    }, false);

    animate();
}

// ── Public: Frame Selection ──────────────────────────────────────────────────
// Each GLB loads once and is cached. The new frame takes over the current pose,
// so switching while the face is tracked does not jump.
var frameCache = {};
var selectedFrameId = null;

export function selectFrame(id) {
    selectedFrameId = id;
    if (!frameCache[id]) {
        var spec = FRAMES.find(function(f) { return f.id === id; });
        frameCache[id] = loadGlasses(spec).then(function(g) {
            g.add(createHeadOccluder(CFG.headOccluder));  // follows the glasses' pose and mm scale
            return g;
        });
    }
    return frameCache[id].then(function(g) {
        if (selectedFrameId !== id || glassesObj === g) return;
        if (glassesObj) {
            g.position.copy(glassesObj.position);
            g.quaternion.copy(glassesObj.quaternion);
            g.scale.copy(glassesObj.scale);
            g.visible = glassesObj.visible;
            scene.remove(glassesObj);
        } else {
            g.visible = false;
        }
        scene.add(g);
        glassesObj = g;
    }).catch(function(err) {
        console.error('[glasses] could not load model ' + id, err);
    });
}

// ── Public: Initialize MediaPipe Face Tracking ───────────────────────────────
export async function initializeEngine() {
    var vision = await import(
        /* webpackIgnore: true */
        'https://unpkg.com/@mediapipe/tasks-vision@0.10.7/vision_bundle.mjs'
    );
    var fileset = await vision.FilesetResolver.forVisionTasks(
        'https://unpkg.com/@mediapipe/tasks-vision@0.10.7/wasm'
    );
    faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-assets/face_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
    });
    scheduleNextPrediction();
}

// Backward-compatible aliases (legacy function names)
export { initializeThreejs as IntializeThreejs };
export { initializeEngine as IntializeEngine };

// ── Prediction Scheduling ────────────────────────────────────────────────────
function scheduleNextPrediction() {
    if (!video) {
        requestAnimationFrame(scheduleNextPrediction);
        return;
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(function() { renderPrediction(); });
    } else {
        requestAnimationFrame(renderPrediction);
    }
}

// ── Per-Frame Prediction ─────────────────────────────────────────────────────
function renderPrediction() {
    if (predictionInFlight || frozen) {
        scheduleNextPrediction();
        return;
    }
    predictionInFlight = true;

    if (!faceLandmarker) {
        predictionInFlight = false;
        scheduleNextPrediction();
        return;
    }

    var results = faceLandmarker.detectForVideo(video, performance.now());

    if (results.faceLandmarks && results.faceLandmarks.length > 0 && glassesObj) {
        glassesObj.visible = true;
        if (faceObj) faceObj.visible = true;

        var pts = toPixels(results.faceLandmarks[0], video);
        samplePd(pts);

        // ── Key landmarks ──
        var pxPerMm = measurePxPerMm(pts);
        var lEye = eyeMid(pts, LM.leftEyeInner, LM.leftEyeOuter);
        var rEye = eyeMid(pts, LM.rightEyeInner, LM.rightEyeOuter);
        var nose = toV(pts, LM.noseBridge);
        var fHead = toV(pts, LM.forehead);
        var chn = toV(pts, LM.chin);
        var lTmp = toV(pts, LM.leftTemple);
        var rTmp = toV(pts, LM.rightTemple);
        var lChk = toV(pts, LM.leftCheek);
        var rChk = toV(pts, LM.rightCheek);

        // ── Face measurements ──
        var tW = lTmp.distanceTo(rTmp);
        var cW = lChk.distanceTo(rChk);
        var fW = Math.max(tW, cW);

        // ── Orientation (landmark-based) ──
        var xAxis = rEye.clone().sub(lEye).normalize();
        var yRaw = fHead.clone().sub(chn).normalize();
        var zAxis = xAxis.clone().cross(yRaw).normalize();

        if (zAxis.z < 0) zAxis.negate();

        var yAxis = zAxis.clone().cross(xAxis).normalize();

        var rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        var targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

        // Z-flip (model faces +Z but scene uses -Z for "behind")
        var flipZ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), Math.PI
        );
        targetQuat.multiply(flipZ);

        // ── Position (model origin = bridge, so anchor it on the nose bridge) ──
        var tGPos = nose.clone()
            .addScaledVector(xAxis, CFG.bridgeSideMm * pxPerMm)
            .addScaledVector(yAxis, CFG.bridgeDropMm * pxPerMm)
            .addScaledVector(zAxis, CFG.bridgeGapMm * pxPerMm);

        // ── Scale (model is in mm, so one model unit = one real mm) ──
        var gS = pxPerMm * CFG.glassesScale;
        var tGScale = new THREE.Vector3(gS, gS, gS);

        // ── Adaptive smoothing ──
        var mov = tGPos.distanceTo(sm.prev);
        var aDelta = qDelta(sm.gQuat, targetQuat);

        // Higher floors than upstream (0.15–0.20), which lagged on fast moves;
        // fast motion pushes alpha towards 0.9 so the frame catches up.
        var aP = clamp(0.35 + mov * 0.05, 0.35, 0.9);
        var aR = clamp(0.40 + aDelta * 2.0, 0.40, 0.9);
        var aS = clamp(0.35 + mov * 0.05, 0.35, 0.9);

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
        glassesObj.position.copy(sm.gPos);
        glassesObj.quaternion.copy(sm.gQuat);
        glassesObj.scale.copy(sm.gScale);
        glassesObj.updateWorldMatrix(true, true);

        // ── Update face mesh occluder ──
        if (faceObj) {
            var posAttr = faceObj.geometry.getAttribute('position');
            var cx = 0, cy = 0, cz = 0;
            var fwdOff = 8;
            for (var fi = 0; fi < FACE_OVAL.length; fi++) {
                var fv = toV(pts, FACE_OVAL[fi]);
                fv.addScaledVector(zAxis, fwdOff);
                posAttr.setXYZ(fi + 1, fv.x, fv.y, fv.z);
                cx += fv.x; cy += fv.y; cz += fv.z;
            }
            cx /= FACE_OVAL.length;
            cy /= FACE_OVAL.length;
            cz /= FACE_OVAL.length;

            var coneD = fW * 0.5;
            posAttr.setXYZ(0,
                cx - zAxis.x * coneD,
                cy - zAxis.y * coneD,
                cz - zAxis.z * coneD
            );
            posAttr.needsUpdate = true;
        }

    } else {
        if (glassesObj) glassesObj.visible = false;
        if (faceObj) faceObj.visible = false;
        sm.ready = false;
        faceWidthMmSamples.length = 0;
        faceHeightMmSamples.length = 0;
        debugInfo = null;
        samplePd(null);
    }

    // Same task as detectForVideo, so the texture uploads the frame just tracked
    drawFrame();

    predictionInFlight = false;
    scheduleNextPrediction();
}
