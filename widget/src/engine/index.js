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
import { loadGlasses, SUN_GLASSES } from './glbGlasses';
import { createDynamicFaceMesh, createHeadOccluder } from './occluder';
import { createCamera, createVideoBackground, createLights, createRenderer, handleResize } from './scene';

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

function measurePxPerMm(pts) {
    var d = function(a, b) { return toV(pts, a).distanceTo(toV(pts, b)); };
    var faceWidthPx = d(LM.leftCheek, LM.rightCheek);
    var faceHeightPx = d(LM.forehead, LM.subnasale);

    var eyeLine = toV(pts, LM.rightEyeOuter).sub(toV(pts, LM.leftEyeOuter)).normalize();
    var frontal = Math.abs(eyeLine.z) < CFG.frontalMaxEyeZ;

    if (frontal && pts.length > IRIS.rightBottom) {
        var irisPx = (d(IRIS.leftRight, IRIS.leftLeft) + d(IRIS.leftTop, IRIS.leftBottom) +
                      d(IRIS.rightRight, IRIS.rightLeft) + d(IRIS.rightTop, IRIS.rightBottom)) / 4;
        pushSample(faceWidthMmSamples, faceWidthPx * CFG.irisDiameterMm / irisPx);
        pushSample(faceHeightMmSamples, faceHeightPx * CFG.irisDiameterMm / irisPx);
    }

    return Math.max(
        faceWidthPx / median(faceWidthMmSamples, CFG.faceWidthMm),
        faceHeightPx / median(faceHeightMmSamples, CFG.faceHeightMm)
    );
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
    loadGlasses(SUN_GLASSES).then(function(g) {
        g.visible = false;
        g.add(createHeadOccluder(CFG.headOccluder));  // follows the glasses' pose and mm scale
        scene.add(g);
        glassesObj = g;
    }).catch(function(err) {
        console.error('[glasses] could not load model', err);
    });

    window.addEventListener('resize', function() {
        handleResize(camera, renderer, video);
    }, false);

    animate();
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
    if (predictionInFlight) {
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
    }

    // Same task as detectForVideo, so the texture uploads the frame just tracked
    drawFrame();

    predictionInFlight = false;
    scheduleNextPrediction();
}
